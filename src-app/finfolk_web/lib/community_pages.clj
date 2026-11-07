(ns finfolk-web.lib.community-pages
  "Profile composition and optional featured reads, authored in Clojure/XTalk."
  (:require [lang.core :as l]))
(l/script :js)
(defn.js approvedPosts [posts]
  (return (. posts (filter (fn [post] (return (and (== (. post ["status"]) "approved") (. post ["public_consent"]))))))))
(defn.js ^{:- [:async]} featuredExtras [read member listed]
  (var missing (. (or (. member ["featuredLogs"]) []) (filter (fn [id]
    (return (not (. (or (. listed ["sessions"]) []) (some (fn [row] (return (== (. row ["id"]) id)))))))))))
  (var results (await (Promise.allSettled (. missing (map (fn [id] (return (read "session" {"id" id}))))))))
  (return (. (. results (filter (fn [result] (return (== (. result ["status"]) "fulfilled")))))
             (map (fn [result] (return (. result ["value"])))))))
(defn.js publicLogs [rows selected owner]
  (var available (. rows (filter (fn [row] (return (and row (== (. row ["visibility"]) "public") (== (. row ["ownerId"]) owner)))))))
  (when (Array.isArray selected)
    (return (. (. selected (map (fn [id] (return (. available (find (fn [row] (return (== (. row ["id"]) id))))))))) (filter Boolean))))
  (return (. available (slice 0 6))))
(defn.js ^{:- [:async]} loadProfile [read inputs actor]
  (var own (not (. inputs ["target"])))
  (var me (await (read "me" {})))
  (var id (or (. inputs ["target"]) actor))
  (var [member connections] (await (Promise.all [(:? own (Object.assign {} (. me ["profile"]) {"id" id}) (read "profile" {"target" id})) (read "connections" {})])))
  (when (. member ["restricted"]) (return {"member" member}))
  (var sites (or (. inputs ["sites"]) []))
  (var selected (or (. sites (find (fn [site] (return (== (. site ["id"]) (. inputs ["location"]))))))
                   (. sites (find (fn [site] (return (== (. site ["id"]) (. (or (. me ["profile"] ["beaches"]) []) [0]))))))
                   (. sites (find (fn [site] (return (== (. site ["id"]) "bondi")))))
                   (. sites [0])))
  (var [posts listed blocks stats] (await (Promise.all
    [(:? own (read "posts" {}) (or (. member ["posts"]) []))
     (read "sessions" {"owner" id "publicOnly" true})
     (:? own (read "blocks" {}) [])
     (:? (and (not own) selected) (read "stats" {"target" id "beachId" (. selected ["id"])}) nil)])))
  (var extra (await (-/featuredExtras read member listed)))
  (return {"member" member "connections" connections "blocks" blocks "stats" (or (and stats (. stats ["stats"])) {})
           "selected" selected "posts" (:? own (-/approvedPosts posts) posts)
           "logs" (-/publicLogs (. (or (. listed ["sessions"]) []) (concat extra)) (. member ["featuredLogs"]) id)}))
(defn.js ^{:- [:async]} loadEditor [read inputs actor]
  (var [me listed posts] (await (Promise.all [(read "me" {}) (read "sessions" {}) (read "posts" {})])))
  (var profile (. me ["profile"]))
  (var extra (await (-/featuredExtras read profile listed)))
  (var logs (. (. (or (. listed ["sessions"]) []) (concat extra))
               (filter (fn [row] (return (and row (== (. row ["ownerId"]) actor) (== (. row ["visibility"]) "public")))))))
  (return {"profile" profile "logs" logs "posts" (-/approvedPosts posts)}))
(defn.js ^{:- [:async]} loadPeople [read inputs actor]
  (var [data me] (await (Promise.all [(read "people" (. inputs ["query"])) (read "me" {})])))
  (return {"people" (or (. data ["people"]) []) "cursor" (. data ["cursor"]) "open" (. me ["profile"] ["open"])}))
