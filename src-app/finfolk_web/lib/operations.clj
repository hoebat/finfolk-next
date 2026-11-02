(ns finfolk-web.lib.operations
  (:require [lang.core :as l]
            [finfolk-web.groups.admin :as admin]
            [finfolk-web.groups.directory :as directory]
            [finfolk-web.groups.events :as events]
            [finfolk-web.groups.community :as community]
            [finfolk-web.groups.instagram :as instagram]
            [finfolk-web.groups.invitations :as invitations]
            [finfolk-web.groups.logbook :as logbook]
            [finfolk-web.groups.member :as member]
            [finfolk-web.groups.posts :as posts]
            [finfolk-web.groups.trips :as trips]
            [finfolk-web.groups.sites :as sites]))

(def DEFINITIONS (merge events/OPERATIONS directory/OPERATIONS admin/OPERATIONS community/OPERATIONS instagram/OPERATIONS invitations/OPERATIONS logbook/OPERATIONS member/OPERATIONS posts/OPERATIONS trips/OPERATIONS sites/OPERATIONS))
(l/script :js)
(def.js operations (@! DEFINITIONS))
(defn.js operation [name]
  (var spec (. -/operations [name]))
  (when (not spec) (throw (new Error (+ "Unknown substrate operation: " name))))
  (return spec))
(defn.js restOperation [path method]
  (:= method (or method "GET"))
  (var pathname (. (new URL path "https://local.invalid") ["pathname"]))
  (for:array [spec (Object.values -/operations)]
    (when (and (== (. spec ["transport"]) "rest") (== (. spec ["method"]) method)
               (. (new RegExp (+ "^" (. (. spec ["path"]) (replace (new RegExp ":[a-z]+" "g") "[^/]+")) "$")) (test pathname)))
      (return spec)))
  (throw (new Error (+ "Unknown substrate endpoint: " method " " pathname))))
(def.js RELATED
  {"eventsMember" ["eventsPublic" "directoryPublic"]
   "directoryOwner" ["directoryPublic" "directoryAdmin"] "directoryAdmin" ["directoryPublic" "directoryOwner"]
   "siteAdmin" ["sites" "siteSubmissions"] "siteSubmissions" ["siteAdmin"]
   "member" ["community" "logbook" "posts" "trips"]
   "community" ["member" "logbook" "posts" "trips"]
   "logbook" ["community" "trips" "member" "instagram"]
   "posts" ["member"]
   "instagram" ["posts" "member" "admin" "logbook"]
   "admin" ["instagram" "posts" "member"] "invitations" ["member"]})
(defn.js affectedDomains [spec]
  (return (Array.from (new Set (. [(. spec ["domain"])] (concat (or (. -/RELATED [(. spec ["domain"])]) [])))))))
