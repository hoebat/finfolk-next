(ns app.manage.pipeline
  "Shared Web Pipeline v1. Project bindings supply work, never stage topology."
  (:refer-clojure :exclude [run!])
  (:require [app.manage :as manage] [app.manage.process :as process]
            [app.manage.slices :as slices] [clojure.java.io :as io] [clojure.string :as str]))
(def stages
  [{:id :database :label "Database SQL"}
   {:id :contracts :label "Contracts"}
   {:id :application :label "Application"}
   {:id :assets :label "Browser assets"}
   {:id :build :label "App build"}
   {:id :verification :label "Verification"}])
(defn definition [project]
  (when-let [bindings (:web-pipeline project)]
    (when-not (= (set (map :id stages)) (set (keys bindings)))
      (throw (ex-info "Web Pipeline v1 requires all six stage bindings" {})))
    (mapv (fn [index stage]
            (let [binding (get bindings (:id stage))]
              (doseq [target (:targets binding)]
                (when-not (get-in project [:targets target]) (throw (ex-info "Unknown pipeline target" {:target target}))))
              (when-not (or (seq (:targets binding)) (seq (:steps binding)))
                (throw (ex-info "Pipeline stage needs real work" {:stage (:id stage)})))
              (merge stage binding {:depends (if (zero? index) [] [(:id (nth stages (dec index)))])})))
          (range) stages)))
(defn digest [content]
  (format "%064x" (java.math.BigInteger. 1 (.digest (java.security.MessageDigest/getInstance "SHA-256") (if (string? content) (.getBytes ^String content "UTF-8") content)))))
(defonce file-digests (atom {}))
(defn file-digest [file]
  (let [path (str (.getCanonicalFile file))
        stamp [(str (java.nio.file.Files/getLastModifiedTime (.toPath file) (make-array java.nio.file.LinkOption 0))) (.length file)]
        old (get @file-digests path)]
    (if (= stamp (:stamp old)) (:hash old)
      (let [hash (digest (java.nio.file.Files/readAllBytes (.toPath file)))]
        (swap! file-digests assoc path {:stamp stamp :hash hash}) hash))))
(defn fingerprint [project]
  (let [steps (mapcat :steps (vals (:web-pipeline project)))
        outputs (concat (mapcat :outputs (vals (:targets project))) (mapcat :outputs steps))
        roots (concat (:project-sources project) (mapcat :sources (vals (:targets project))) (mapcat :sources steps))
        excluded? (fn [path] (some #(or (= path %) (str/starts-with? path (str % "/"))) outputs))
        files (sort-by str (distinct (mapcat (fn [path] (let [f (manage/project-file project path)] (if (.isDirectory f) (file-seq f) [f]))) roots)))
        root (.toPath (manage/project-root project))]
    (digest (apply str (for [f files :when (.isFile f)
                            :let [path (str (.relativize root (.toPath (.getCanonicalFile f))))]
                            :when (not (excluded? path))]
                        (str path "\n" (file-digest f) "\n"))))))
(defn stale? [project result]
  (boolean (or (not= (:pipeline-fingerprint result) (fingerprint project))
      (some (fn [[path hash]] (let [f (manage/project-file project path)] (or (not (.isFile f)) (not= hash (file-digest f))))) (:artifact-hashes result)))))
(defn- execute-step [project step]
  (let [result (cond
                 (:check step) (manage/verify project {:checks [(:check step)]})
                 (:command step) (process/run (assoc step :root (manage/project-root project)
                                                 :on-output (fn [stream text] (manage/emit! {:type :pipeline/output :target (:stage-id step) :step (:id step) :status :running :stream stream :text text}))))
                 (:run step) ((if (symbol? (:run step)) (requiring-resolve (:run step)) (:run step)) {:project project :root (manage/project-root project)})
                 :else (throw (ex-info "Pipeline step has no implementation" {:step (:id step)})))]
    (when-not (#{:ok :error} (:status result)) (throw (ex-info "Pipeline step must return an explicit status" {:step (:id step)})))
    result))
(defn run!
  ([project] (run! project {}))
  ([project {:keys [through tests?] :or {tests? true}}]
   (let [definitions (definition project)
         limit (if through (or (some #(when (= (keyword through) (:id (second %))) (first %)) (map-indexed vector definitions))
                               (throw (ex-info "Unknown pipeline stage" {:stage through}))) 5)
         limit (if (and (not tests?) (= limit 5)) 4 limit)
         before (fingerprint project)
         completed (atom #{}) results (atom {}) failed (atom false)
         reports
         (mapv (fn [index {:keys [id targets steps] :as stage}]
           (let [started (System/currentTimeMillis)
                 status (cond (> index limit) :not-run @failed :blocked :else :running)]
             (manage/emit! {:type :pipeline/started :target id :status status})
             (let [report
                   (if (not= :running status) {:id id :status status}
                     (try
                       (let [selected (vec (remove @completed (when (seq targets) (manage/plan project targets))))
                             p (-> project (assoc :pipeline-results @results :pipeline-project project)
                                   (update :targets #(into {} (for [[k v] %] [k (update v :depends (fn [deps] (vec (remove @completed deps))))]))))]
                         (when (seq selected)
                           (let [rendered (manage/render p selected)]
                             (let [expected (set (keys (:artifacts rendered)))
                                   root (.toPath (manage/project-root p))
                                   actual (for [target selected output (get-in p [:targets target :outputs])
                                                f (file-seq (manage/project-file p output)) :when (.isFile f)]
                                            (str (.relativize root (.toPath (.getCanonicalFile f)))))
                                   unexpected (vec (sort (remove expected actual)))]
                               (when (seq unexpected)
                                 (throw (ex-info "Unexpected files in generated outputs; inspect before removing" {:unexpected unexpected}))))
                             (doseq [[path content] (:artifacts rendered)]
                               (let [file (manage/project-file p path)] (io/make-parents file) (spit file content)))
                             (swap! results merge (:results rendered)) (swap! completed into selected)))
                         (loop [remaining steps out []]
                           (if-let [step (first remaining)]
                             (let [result (execute-step project (assoc step :stage-id id))
                                   entry {:id (:id step) :kind (:kind step) :status (:status result) :result result}]
                               (manage/emit! {:type :pipeline/step :target id :step (:id step) :status (:status result)})
                               (if (= :error (:status result)) {:id id :status :error :steps (into (conj out entry) (map (fn [pending] {:id (:id pending) :kind (:kind pending) :status :blocked}) (next remaining)))}
                                 (recur (next remaining) (conj out entry))))
                             {:id id :status :ok :targets selected :steps out})))
                       (catch Throwable error {:id id :status :error :message (.getMessage error) :data (ex-data error)})))
                   report (assoc report :duration-ms (- (System/currentTimeMillis) started))]
               (when (= :error (:status report)) (reset! failed true))
               (manage/emit! {:type :pipeline/finished :target id :status (:status report) :duration-ms (:duration-ms report)})
               report))) (range) definitions)]
     {:status (if @failed :error :ok) :pipeline "web-v1" :stages reports
      :verification (case (:status (last reports)) :ok :passed :error :failed :blocked :blocked :not-run)
      :artifact-hashes (into {} (for [files (vals @results) [path content] files] [path (digest content)]))
      :pipeline-fingerprint before :stale (not= before (fingerprint project))})))

(defn -main [project-var & [through]]
  (let [project (var-get (requiring-resolve (symbol project-var))) r (run! project {:through through})]
    (prn r) (shutdown-agents) (System/exit (if (= :ok (:status r)) 0 1))))
