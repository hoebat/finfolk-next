(ns finfolk-web.lib.account-pages
  "Account page composition; SDK and model lifetimes remain application-owned."
  (:require [lang.core :as l]))
(l/script :js)
(defn.js ^{:- [:async]} loadSiteReview [read inputs actor]
  (var data (await (read "sites" {})))
  (var batches [])
  (for:array [batch (. (. data ["imports"]) (filter (fn [item] (return (== (. item ["status"]) "draft")))))]
    (. batches (push (await (read "batch" {"id" (. batch ["id"])})))))
  (return (Object.assign {} data {"batches" batches})))

(defn.js ^{:- [:async]} loadPostManager [read inputs actor]
  (var posts (await (read "myPosts" {})))
  (try (return {"posts" posts "followed" (await (read "followedPosts" {}))})
    (catch error (return {"posts" posts "followedError" true}))))
(defn.js ^{:- [:async]} loadDiscovery [read inputs actor]
  (var state (await (read "instagramStatus" {})))
  (var data (await (read "instagramMyPosts" {})))
  (return {"data" data "admin" (. state ["admin"])}))
(defn.js ^{:- [:async]} loadMessaging [read inputs actor]
  (try
    (var state (await (read "state" {})))
    (var events (await (read "events" {})))
    (return {"state" state "events" (. events ["events"])})
    (catch error
      (when (. [401 403] (includes (. error ["status"]))) (return {"forbidden" true}))
      (throw error))))
