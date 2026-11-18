(ns finfolk-web.lib.supabase-auth
  "Supabase identity verification for trusted transports; no application authorization in JS."
  (:require [lang.core :as l]))
(l/script :js)
(defn.js ^{:- [:async]} verifiedIdentity [config authorization]
  (when (or (not= (typeof authorization) "string") (not (authorization.startsWith "Bearer ")))
    (throw (Object.assign (new Error "Sign in first.") {"status" 401})))
  (var base (new URL config.supabaseUrl))
  (when (not (or (== base.protocol "https:")
                 (and (== base.protocol "http:") (. ["127.0.0.1" "localhost"] (includes base.hostname)))))
    (throw (new Error "Invalid Supabase Auth origin")))
  (var response (await (fetch (new URL "/auth/v1/user" base)
    {"headers" {"apikey" config.publishableKey "Authorization" authorization}
     "redirect" "error" "signal" (AbortSignal.timeout 10000)})))
  (when (not response.ok)
    (throw (Object.assign (new Error "Your sign-in expired. Please sign in again.") {"status" (:? (. [401 403] (includes response.status)) 401 503)})))
  (var user (await (response.json)))
  (when (or (not user.id) (not (. (new RegExp "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$") (test user.id))))
    (throw (Object.assign (new Error "Account unavailable.") {"status" 401})))
  ;; User-editable metadata is deliberately excluded from the trusted identity.
  (return {"id" user.id "email" user.email "verified" (not (not user.email_confirmed_at))}))
