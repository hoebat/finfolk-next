(ns finfolk-web.lib.supabase-auth
  "Supabase identity verification for trusted transports; no application authorization in JS."
  (:require [lang.core :as l]))
(l/script :js)
(defn.js profileSuggestions [user]
  ;; Advisory UI hints only. Never used for actor, verification, roles or permissions.
  (var provider (or (and user.app_metadata user.app_metadata.provider) "email"))
  (when (not (. ["google" "github" "facebook" "email"] (includes provider))) (return {}))
  (var identity (. (or user.identities []) (find (fn [item] (return (== item.provider provider))))))
  (var data (:? (== provider "email") (or user.user_metadata {})
               (or (and identity identity.identity_data) user.user_metadata {})))
  (var name (:? (== provider "email") data.displayName (or data.full_name data.name data.displayName data.user_name "")))
  (var result {"provider" provider})
  (when (== (typeof name) "string")
    (:= result.name (. name (replace (new RegExp "[\\u0000-\\u001f\\u007f]" "g") "") (trim) (slice 0 80))))
  (when (not= provider "email")
    (try
      (var photo (new URL (or data.avatar_url data.picture "")))
      (when (and (== photo.protocol "https:") (not photo.username) (not photo.password) (not photo.port)
                 (< photo.href.length 2048)
                 (. (new RegExp "(^|\\.)(googleusercontent\\.com|avatars\\.githubusercontent\\.com|fbcdn\\.net)$|^graph\\.facebook\\.com$") (test photo.hostname)))
        (:= result.photo photo.href))
      (catch error nil)))
  (return result))

(defn.js ^{:- [:async]} verifiedIdentity [config authorization]
  (when (or (not= (typeof authorization) "string") (not (authorization.startsWith "Bearer ")))
    (throw (Object.assign (new Error "Sign in first.") {"status" 401})))
  (var base (new URL config.supabaseUrl))
  (when (not (or (== base.protocol "https:")
                 (and (== base.protocol "http:") (. ["127.0.0.1" "localhost"] (includes base.hostname)))))
    (throw (new Error "Invalid Supabase Auth origin")))
  (var response (await (fetch (new URL "/auth/v1/user" base)
    {"headers" {"apikey" config.publishableKey "Authorization" authorization}
     "redirect" "manual" "signal" (AbortSignal.timeout 10000)})))
  (when (not response.ok)
    (throw (Object.assign (new Error "Your sign-in expired. Please sign in again.") {"status" (:? (. [401 403] (includes response.status)) 401 503)})))
  (var user (await (response.json)))
  (when (or (not user.id) (not (. (new RegExp "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$") (test user.id))))
    (throw (Object.assign (new Error "Account unavailable.") {"status" 401})))
  ;; Auth fields come exclusively from the verified Auth response. Suggestions are advisory.
  (return {"id" user.id "email" user.email "verified" (not (not user.email_confirmed_at))
           "profileSuggestions" (-/profileSuggestions user)}))
