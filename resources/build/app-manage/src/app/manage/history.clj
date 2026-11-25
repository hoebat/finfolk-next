(ns app.manage.history
  "Durable project-local execution journal. Contains no workbench session credentials."
  (:require [clojure.edn :as edn] [clojure.java.io :as io]
            [clojure.string :as str] [clojure.walk :as walk])
  (:import [java.sql DriverManager] [java.util UUID]))

(defn execute! [store sql & args]
  (with-open [s (.prepareStatement (:connection store) sql)]
    (doseq [[i value] (map-indexed vector args)] (.setObject s (inc i) value))
    (.execute s)))
(defn query [store sql & args]
  (with-open [s (.prepareStatement (:connection store) sql)]
    (doseq [[i value] (map-indexed vector args)] (.setObject s (inc i) value))
    (with-open [r (.executeQuery s)]
      (loop [out []]
        (if (.next r) (recur (conj out (.getString r 1))) out)))))
(defn redact [store value]
  (walk/postwalk
    (fn [v]
      (cond
        (map? v) (into {} (for [[k value] v]
                   [k (if (re-find #"(?i)^(password|secret|token|authorization|service.role.key|access.token|refresh.token)$" (if (keyword? k) (name k) (str k))) "[REDACTED]" value)]))
        (string? v) (reduce #(str/replace %1 %2 "[REDACTED]")
                       (str/replace v #"(?i)(Bearer\s+)[A-Za-z0-9._~+/=-]+" "$1[REDACTED]") (:secrets store))
        (or (nil? v) (number? v) (boolean? v) (keyword? v) (symbol? v) (coll? v)) v
        :else (str v))) value))
(defn summary [run]
  (-> run (dissoc :stdout :output :events :result)
      (assoc :result-summary (select-keys (:result run) [:status :pipeline :verification :message]))))
(defn expire-logs [run]
  (-> run (dissoc :stdout :output :events)
      (update :result #(walk/postwalk (fn [v] (if (map? v) (dissoc v :stdout :stderr :output) v)) %))
      (assoc :logs-expired true)))
(defn prune! [store]
  (let [cutoff (- (System/currentTimeMillis) (* 86400000 (:days store)))
        runs (map edn/read-string (query store "SELECT payload FROM runs ORDER BY ordinal DESC"))]
    (loop [remaining runs used 0]
      (when-let [run (first remaining)]
        (let [size (count (.getBytes (pr-str (select-keys run [:stdout :output :events :result])) "UTF-8"))
              terminal? (not (#{:queued :running} (:status run)))
              expired? (and terminal? (not (:logs-expired run))
                            (or (< (or (:finished run) (:started run) Long/MAX_VALUE) cutoff)
                                (> (+ used size) (:max-bytes store))))]
          (when expired?
            (execute! store "UPDATE runs SET payload=? WHERE id=?" (pr-str (expire-logs run)) (:id run))
            (swap! (:expired store) conj (:id run)))
          (recur (next remaining) (if expired? used (+ used size))))))))
(defn open! [root config]
  (when-not (and (pos-int? (or (:days config) 30)) (pos-int? (or (:max-bytes config) 2147483648)))
    (throw (ex-info "History retention requires positive days and byte limits" {})))
  (Class/forName "org.sqlite.JDBC")
  (let [file (io/file root ".app-manage/state/history.sqlite")
        _ (io/make-parents file)
        lock-channel (.getChannel (java.io.RandomAccessFile. (str file ".lock") "rw"))
        lock (try (.tryLock lock-channel) (catch Exception _ nil))]
    (when-not lock (.close lock-channel) (throw (ex-info "Another workbench owns this project's history" {})))
    (try
      (let [store {:connection (DriverManager/getConnection (str "jdbc:sqlite:" file))
                   :lock lock :lock-channel lock-channel :monitor (Object.) :expired (atom #{}) :last-pruned (atom 0)
                   :days (or (:days config) 30) :max-bytes (or (:max-bytes config) (* 2 1024 1024 1024))
                   :secrets (filter #(and (string? %) (>= (count %) 4)) (:secret-values config))}]
        (.setReadable file false false) (.setReadable file true true)
        (.setWritable file false false) (.setWritable file true true)
        (execute! store "PRAGMA journal_mode=WAL")
        (execute! store "PRAGMA synchronous=FULL")
        (execute! store "CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        (execute! store "INSERT OR IGNORE INTO metadata VALUES ('schema-version','1')")
        (when-not (= ["1"] (query store "SELECT value FROM metadata WHERE key='schema-version'"))
          (.close (:connection store)) (throw (ex-info "Unsupported history schema version" {})))
        (execute! store "INSERT OR IGNORE INTO metadata VALUES ('project-id',?)" (str (UUID/randomUUID)))
        (execute! store "CREATE TABLE IF NOT EXISTS runs (ordinal INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, payload TEXT NOT NULL)")
        store)
      (catch Throwable e (.release lock) (.close lock-channel) (throw e)))))
(defn load! [store]
  (locking (:monitor store)
    (let [runs (mapv edn/read-string (query store "SELECT payload FROM runs ORDER BY ordinal"))
          recovered (mapv #(if (#{:queued :running} (:status %))
                             (assoc % :status :interrupted :finished (System/currentTimeMillis)
                                    :interruption "Workbench stopped before completion; retry explicitly.") %) runs)]
      (doseq [run recovered] (execute! store "UPDATE runs SET payload=? WHERE id=?" (pr-str run) (:id run)))
      {:runs (into {} (map (juxt :id identity) recovered)) :order (mapv :id recovered)})))
(defn save! [store state]
  (locking (:monitor store)
    (let [c (:connection store)]
      (.setAutoCommit c false)
      (try
        (doseq [id (:order state) :let [run (redact store (get-in state [:runs id]))
                                       run (if (contains? @(:expired store) id) (expire-logs run) run)]]
          (execute! store "INSERT INTO runs(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE payload<>excluded.payload" id (pr-str run)))
        (.commit c)
        (when (> (- (System/currentTimeMillis) @(:last-pruned store)) 60000)
          (prune! store) (reset! (:last-pruned store) (System/currentTimeMillis)))
        (catch Throwable e (.rollback c) (throw e))
        (finally (.setAutoCommit c true))))))
(defn page [store offset limit]
  (when-not (and (integer? offset) (<= 0 offset) (integer? limit) (<= 1 limit 100))
    (throw (ex-info "Invalid history page" {:http-status 400})))
  (locking (:monitor store)
    (let [rows (mapv edn/read-string (query store "SELECT payload FROM runs ORDER BY ordinal DESC LIMIT ? OFFSET ?" (inc limit) offset))]
      {:runs (mapv summary (take limit rows)) :next (when (> (count rows) limit) (+ offset limit))})))
(defn close! [store]
  (locking (:monitor store)
    (try (.close (:connection store)) (finally (.release (:lock store)) (.close (:lock-channel store))))))

(defn process-event! [store id event]
  (locking (:monitor store)
    (let [old (some-> (first (query store "SELECT payload FROM runs WHERE id=?" id)) edn/read-string)
          run (-> (or old {:id id :operation "process" :status :running :started (System/currentTimeMillis) :events []})
                  (update :events conj (assoc event :sequence (count (:events old)) :time (System/currentTimeMillis))))
          run (if (:finished event) (assoc run :status (if (and (:exit event) (not= 0 (:exit event))) :error (if (#{:ok :error} (:status old)) (:status old) :ok)) :finished (System/currentTimeMillis)) run)]
      (save! store {:order [id] :runs {id run}}))))
(defn brief [run]
  (let [r (:result run)
        item #(select-keys % [:id :status :duration-ms :message :kind :blocked])
        result (cond-> (select-keys r [:status :pipeline :verification :message :namespaces :pages :findings :stale :fingerprint :pipeline-fingerprint :artifact-hashes])
                 (:stages r) (assoc :stages (mapv (fn [stage] (assoc (item stage) :steps (mapv item (:steps stage)))) (:stages r)))
                 (:cases r) (assoc :cases (mapv item (:cases r))))]
    (-> (summary run) (dissoc :result-summary)
        (assoc :result result :detail-url (str "/api/v1/runs/" (:id run))
               :events (mapv #(update % :text (fn [text] (when text (subs text (max 0 (- (count text) 4096)))))) (take-last 50 (:events run))))
        (cond-> (:output run) (assoc :output (subs (:output run) (max 0 (- (count (:output run)) 16384))))
                (:stdout run) (assoc :stdout (subs (:stdout run) (max 0 (- (count (:stdout run)) 16384))))))))
(defn recent [store]
  (locking (:monitor store)
    (let [runs (mapv #(brief (edn/read-string %)) (query store "SELECT payload FROM runs ORDER BY ordinal DESC LIMIT 50"))]
      {:runs (into {} (map (juxt :id identity) runs)) :order (vec (reverse (mapv :id runs)))})))
(defn find-run [store id]
  (locking (:monitor store)
    (some-> (first (query store "SELECT payload FROM runs WHERE id=?" id)) edn/read-string)))
(defn before [store cursor limit]
  (when-not (and (string? cursor) (<= (count cursor) 128) (integer? limit) (<= 1 limit 100))
    (throw (ex-info "Invalid history cursor" {:http-status 400})))
  (locking (:monitor store)
    (let [rows (mapv edn/read-string (query store "SELECT payload FROM runs WHERE ordinal < (SELECT ordinal FROM runs WHERE id=?) ORDER BY ordinal DESC LIMIT ?" cursor (inc limit)))
          selected (vec (take limit rows))]
      {:runs (mapv summary selected) :next (when (> (count rows) limit) (:id (last selected)))})))
(defn search [store text offset limit]
  (when-not (and (string? text) (<= (count text) 200) (integer? offset) (<= 0 offset) (integer? limit) (<= 1 limit 100))
    (throw (ex-info "Invalid history search" {:http-status 400})))
  (locking (:monitor store)
    (let [q (str/lower-case text)
          rows (->> (query store "SELECT payload FROM runs ORDER BY ordinal DESC")
                    (map edn/read-string)
                    (filter #(str/includes? (str/lower-case (str (:id %) " " (:operation %) " " (:target %) " " (:status %))) q))
                    (drop offset) (take (inc limit)) vec)]
      {:runs (mapv summary (take limit rows)) :next (when (> (count rows) limit) (+ offset limit))})))
(defn delete! [store id]
  (locking (:monitor store)
    (when-let [run (find-run store id)]
      (when (#{:running :queued} (:status run)) (throw (ex-info "Finish or cancel this run before deleting it" {:http-status 409})))
    (execute! store "DELETE FROM runs WHERE id=?" id)))
)
(defn recover! [store]
  "Recover in bounded batches; historical bodies are served by the read APIs."
  (locking (:monitor store)
    (loop [after ""]
      (let [batch (mapv edn/read-string (query store "SELECT payload FROM runs WHERE id>? ORDER BY id LIMIT 50" after))]
        (doseq [run batch :when (#{:queued :running} (:status run))]
          (execute! store "UPDATE runs SET payload=? WHERE id=?"
                    (pr-str (assoc run :status :interrupted :finished (System/currentTimeMillis)
                                   :interruption "Workbench stopped before completion; retry explicitly.")) (:id run)))
        (when (seq batch) (recur (:id (last batch))))))
    {:runs {} :order []}))
