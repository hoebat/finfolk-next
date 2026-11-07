(ns finfolk-web.lib.logbook-pages
  "Logbook composition with explicit SDK adapters and public-model services."
  (:require [lang.core :as l]))
(l/script :js)
(defn.js ^{:- [:async]} loadLogbook [read inputs actor]
  (var config (. inputs ["config"]))
  (when (. inputs ["session"])
    (var entry (await (read "session" {"id" (. inputs ["session"])})))
    (when (and (not= (. entry ["visibility"]) "public") (not= (. entry ["ownerId"]) actor))
      (throw (new Error "This session is private. Sign in with its owner account.")))
    (return {"config" config "entry" entry "profile" (await (read "profile" {"target" (. entry ["ownerId"])}))}))
  (when (. inputs ["profile"])
    (return {"config" config "profile" (await (read "profile" {"target" (. inputs ["profile"])}))}))
  (when actor (await (read "ensure" {})))
  (return {"config" config}))
(defn.js ^{:- [:async]} loadExtras [read sdk inputs actor]
  (var config (. inputs ["config"]))
  (var posts (:? (and (. config ["instagram"]) (. config ["instagram"] ["enabled"]))
                (await (sdk "social-posts" [{"owner" (. inputs ["owner"])}])) []))
  (var trips [])
  (when (. config ["apiUrl"])
    (try
      (var result (await (read "trips" {"ownerId" (. inputs ["owner"])})))
      (:= trips (or (. result ["trips"]) []))
      (catch error nil)))
  (return {"posts" posts "trips" trips}))
