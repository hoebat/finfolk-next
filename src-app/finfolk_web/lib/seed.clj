(ns finfolk-web.lib.seed
  "Application declarations, not database seed rows or inferred REST permissions."
  (:require [finfolk-web.lib.operations :as operations]
            [finfolkbuild.db.legacy :as schema]))
(def TABLES (schema/declarations))
(def OPERATIONS operations/DEFINITIONS)
(defn operation [name]
  (or (get OPERATIONS name) (throw (ex-info "Unknown page operation" {:operation name}))))
(defn read-model [name & [bindings]]
  (when (get (operation name) "write")
    (throw (ex-info "A mutation cannot be a page read" {:operation name})))
  {"operation" name "bindings" (or bindings {})})
(defn action [name & [bindings]]
  (operation name)
  {"operation" name "bindings" (or bindings {})})
