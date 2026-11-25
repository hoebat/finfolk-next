(ns app.manage.panels
  "Opt-in project panels: explicit assets and server-side handler allowlists."
  (:require [app.manage :as manage] [clojure.string :as str]))

(defn definitions [project]
  (let [panels (:project-panels project) ids (map #(some-> (:id %) name) panels)]
    (when-not (= (count ids) (count (distinct ids)))
      (throw (ex-info "Duplicate project panel id" {})))
    (doseq [{:keys [id label entry assets read actions]} panels]
      (when-not (and (or (keyword? id) (string? id)) (re-matches #"[a-z][a-z0-9-]*" (name id))
                     (string? label) (seq label) (map? assets) (contains? assets entry) (not-any? #(str/starts-with? % "api/") (keys assets))
                     (or (symbol? read) (fn? read)) (map? actions)
                     (= (count actions) (count (distinct (map (comp name key) actions))))
                     (every? #(and (re-matches #"[a-z][a-z0-9-]*" (name (key %)))
                                    (or (symbol? (val %)) (fn? (val %)))) actions))
        (throw (ex-info "Invalid project panel declaration" {})))
      (doseq [[asset path] assets]
        (when-not (and (string? asset) (re-matches #"[a-zA-Z0-9_./-]+" asset)
                       (not-any? #{".." "." ""} (str/split asset #"/")))
          (throw (ex-info "Invalid project panel asset" {})))
        (manage/project-file project path)))
    panels))

(defn index [project]
  (mapv (fn [{:keys [id label entry]}]
          {:id (name id) :label label :url (str "/project-panels/" (name id) "/" entry)})
        (definitions project)))

(defn resolve-panel [project id]
  (or (some #(when (= id (name (:id %))) %) (definitions project))
      (throw (ex-info "Unknown project panel" {:http-status 404}))))

(defn invoke [project panel action body]
  (let [handler (if action (or (get (:actions panel) (keyword action)) (get (:actions panel) action)) (:read panel))]
    (when-not handler (throw (ex-info "Unknown project panel action" {:http-status 404})))
    ((if (symbol? handler) (requiring-resolve handler) handler) {:project project :input body})))
