(ns finfolk-web.lib.directory-discovery
  "Pure provider-to-candidate projection. Publication and deduplication belong to the database."
  (:require [lang.core :as l]))
(l/script :js)
(defn.js text [value limit]
  (return (:? (== (typeof value) "string") (. (value.trim) (slice 0 limit)) "")))
(defn.js searchQuery [request]
  (return (+ "freediving " request.category " " (-/text request.region 100) " "
             (:? (== request.category "Freediver") (-/text request.country 100) "Australia") " " (-/text request.seed 100))))
(defn.js candidate [request result]
  (try
    (when (or (not result) (not (-/text result.title 160)) (not= (typeof result.url) "string") (> result.url.length 2048)) (return nil))
    (var url (new URL result.url))
    (when (or (not= url.protocol "https:") url.username url.password) (return nil))
    (:= url.hash "")
    (var host (. url.hostname (toLowerCase) (replace (new RegExp "^www[.]") "")))
    (var social "")
    (when (. ["instagram.com" "tiktok.com"] (includes host))
      (var match (. url.pathname (match (new RegExp (:? (== host "instagram.com") "^/([a-zA-Z0-9._]{1,30})/?$" "^/@([a-zA-Z0-9._]{1,30})/?$")))))
      (when (or (not match) (. ["p" "reel" "explore" "stories" "accounts"] (includes (. match [1] (toLowerCase))))) (return nil))
      (:= social (+ (:? (== host "instagram.com") "instagram:" "tiktok:") (. match [1] (toLowerCase)))))
    (return {"identity" (:? social social (+ "website:" (. url.href (replace (new RegExp "/$") ""))))
             "document" {"name" (-/text result.title 160) "category" request.category "state" (or request.state "")
                         "country" (or (-/text request.country 100) "Australia") "locality" (-/text request.region 100)
                         "description" "" "image" "" "website" (:? social "" url.href)
                         "socials" (:? social [social] []) "sources" [url.href]}
             "notes" (-/text result.description 2000)})
    (catch error (return nil))))
(defn.js collectCandidates [request pages]
  (var result [])
  (for:array [page (. pages (slice 0 3))]
    (when (and page.web (Array.isArray page.web.results))
      (for:array [item (. page.web.results (slice 0 20))]
        (var value (-/candidate request item))
        (when value (. result (push value))))))
  (return result))
