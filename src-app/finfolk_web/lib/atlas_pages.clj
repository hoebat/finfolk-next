(ns finfolk-web.lib.atlas-pages
  "Place composition; geometry and map state remain in the persistent adapter."
  (:require [lang.core :as l]))
(l/script :js)
(defn.js ^{:- [:async]} loadSiteNotes [read inputs actor]
  (return (await (read (:? actor "member" "public") {}))))
(defn.js ^{:- [:async]} optionalRead [read name values fallback]
  (try (return (await (read name values))) (catch error (return fallback))))
(defn.js ^{:- [:async]} loadMedia [read sdk inputs actor]
  (var values {"beachId" (. inputs ["beachId"])})
  (var shared (:? actor (. (sdk "shared" [values]) (catch (fn [] (return [])))) []))
  (var [feed trips posts] (await (Promise.all [(-/optionalRead read "feed" values {"posts" []})
                                             (-/optionalRead read "trips" values {"trips" []}) shared])))
  (return {"feed" feed "trips" (or (. trips ["trips"]) []) "shared" (or posts [])}))
(defn.js ^{:- [:async]} loadTrips [read inputs actor]
  (return (await (-/optionalRead read "trips" {"beachId" (. inputs ["beachId"])} {"trips" []}))))
(defn.js ^{:- [:async]} loadFeed [read inputs actor]
  (var values {"beachId" (. inputs ["beachId"]) "cursor" (or (. inputs ["cursor"]) "") "postId" (or (. inputs ["postId"]) "")})
  (when actor (return (await (read "member" values))))
  (when (not (. values ["cursor"])) (delete (. values ["cursor"])))
  (when (not (. values ["postId"])) (delete (. values ["postId"])))
  (return (await (read "public" values))))
