(ns finfolk-web.lib.supabase-client
  "Auth adapter and actor-scoped account model. Supabase SDK is injected by the browser boundary."
  (:require [lang.core :as l]))
(l/script :js {:require [[finfolk-web.lib.native-account-contracts :as contracts]]})
(defn.js checked [response]
  (when response.error (throw response.error))
  (return response.data))
(defn.js ^{:- [:async]} requestAccount [config operation values session check]
  (when (== operation "siteCatalog")
    (var response (await (fetch (new URL "/v1/sites/catalog" config.apiUrl) {"cache" "no-cache"})))
    (when (not response.ok) (throw (new Error "Dive sites unavailable.")))
    (return (await (response.json))))
  (:= values (contracts/compactRequest values))
  (var spec (. contracts/operations [operation]))
  (when (not spec)
    (throw (Object.assign (new Error "This feature is not available in this build.") {"status" 501 "code" "native_operation_unavailable"})))
  (try (contracts/validate spec.request values)
    (catch error (throw (Object.assign error {"status" 400 "code" "invalid_account_input"}))))
  (when (and (not session) (not spec.public)) (throw (Object.assign (new Error "Sign in first.") {"status" 401})))
  (check)
  (var headers {"Content-Type" "application/json"})
  (when (== operation "me") (:= (. headers ["X-FinFolk-Profile-Setup"]) "1"))
  (when session (:= headers.Authorization (+ "Bearer " session.access_token)))
  (var response (await (fetch (new URL "/v1/native/account" config.apiUrl)
    {"method" "POST" "headers" headers "body" (JSON.stringify {"operation" operation "values" values}) "cache" "no-store"})))
  (var body (await (response.json)))
  (check)
  (when (not response.ok)
    (throw (Object.assign (new Error body.error) {"status" response.status "dataDeleted" body.dataDeleted "code" body.code
      "mutationOutcomeUnknown" (and spec.write (>= response.status 500) (not body.dataDeleted))})))
  (contracts/validate spec.result body "result")
  (return body))
(defn.js socialRequestAllowed [path method]
  (:= path (. path (replace (new RegExp "^/v1/me/tiktok(?=/|$)") "/v1/me/instagram") (replace (new RegExp "^/v1/messaging/connections/finfolk-tiktok-comments/") "/v1/messaging/connections/finfolk-instagram/") (replace (new RegExp "^/v1/messaging/connections/finfolk-tiktok/") "/v1/messaging/connections/finfolk-instagram/")))
  (return (or
    (and (== method "GET") (or (== path "/v1/me/instagram")
      (== path "/v1/messaging/connections/finfolk-instagram/status")
      (. (new RegExp "^/v1/messaging/connections/finfolk-instagram/events/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$" "i") (test path))))
    (and (== method "POST") (. ["/v1/me/instagram/claim" "/v1/me/instagram/connect" "/v1/me/instagram/disconnect"
      "/v1/messaging/connections/finfolk-instagram/authorization" "/v1/messaging/connections/finfolk-instagram/activation"
      "/v1/messaging/connections/finfolk-instagram/pause" "/v1/messaging/connections/finfolk-instagram/disconnect"
      "/v1/messaging/connections/finfolk-instagram/acceptance"] (includes path))))))

(defn.js ^{:- [:async]} requestSocial [config path options session check]
  (var method (. (or options.method "GET") (toUpperCase)))
  (when (or (not= (typeof path) "string") (not (-/socialRequestAllowed path method)))
    (throw (Object.assign (new Error "This feature is not available in this build.") {"status" 501 "code" "native_operation_unavailable"})))
  (when (not session) (throw (Object.assign (new Error "Sign in first.") {"status" 401})))
  (check)
  ;; OAuth nonce cookies must belong to the canonical callback host, not the website proxy.
  (var base (:? (. ["/v1/messaging/connections/finfolk-instagram/authorization" "/v1/messaging/connections/finfolk-tiktok/authorization" "/v1/messaging/connections/finfolk-tiktok-comments/authorization"] (includes path)) "https://api.finfolk.com.au/" config.apiUrl))
  (var url (new URL path base))
  (when (not= url.origin (. (new URL base) origin)) (throw (new Error "Unexpected integration origin")))
  (var headers {"Content-Type" "application/json" "Authorization" (+ "Bearer " session.access_token)})
  (var response (await (fetch url {"method" method "headers" headers "credentials" "include" "cache" "no-store"
    "signal" (or options.signal (AbortSignal.timeout 30000))
    "body" (:? (== method "POST") (JSON.stringify (or options.body {})) nil)})))
  (var body (await (response.json)))
  (check)
  (when (not response.ok)
    (throw (Object.assign (new Error (or body.error "Social connection unavailable"))
      {"status" response.status "code" body.code "mutationOutcomeUnknown" (and (== method "POST") (>= response.status 500))})))
  (return body))

(defn.js createAccountClient [auth config app]
  (when (not app) (throw (new Error "An application backbone is required")))
  (:= app.authProvider "supabase") (:= app.configuration config)
  (var ctx {"revision" 0 "user" nil "session" nil "model" nil "listeners" (new Set) "closed" false "recovery" (== config.passwordRecovery true) "notice" ""})
  (var transition (fn [session (:= event nil)]
    (when ctx.closed (return nil))
    (var sameActor (and session ctx.user (== session.user.id ctx.user.uid)))
    (when (not sameActor) (:= ctx.revision (+ ctx.revision 1)))
    (when (== event "SIGNED_IN") (:= ctx.notice ""))
    (when (== event "PASSWORD_RECOVERY") (:= ctx.recovery true))
    (when (not session) (:= ctx.recovery false))
    (when (and ctx.model (not sameActor)) (app.clearMember) (:= ctx.model nil))
    (:= ctx.session session)
    (:= ctx.user (:? session {"uid" session.user.id "email" session.user.email "emailVerified" (not (not session.user.email_confirmed_at)) "recovery" ctx.recovery} nil))
    (when (and session (not ctx.model))
      (var revision ctx.revision)
      (var check (fn []
        (when (or (not= revision ctx.revision) ctx.closed) (throw (new Error "Account changed. Sign in again.")))))
      (:= ctx.model (app.member session.user.id
        (fn [operation values] (return (-/requestAccount config operation values ctx.session check))))))
    (. ctx.listeners (forEach (fn [listener] (listener ctx.user))))))
  (var registration (auth.onAuthStateChange (fn [event session] (transition session event))))
  (var ready (. (auth.getSession) (then (fn [response]
    (var data (-/checked response))
    (when (== ctx.revision 0) (transition data.session))))))
  (var client {"supports" (fn [operation] (return (not (not (. contracts/operations [operation])))))
    "featureHeaders" (async (fn []
      (var session (. (-/checked (await (auth.getSession))) session))
      (return (:? session {"Authorization" (+ "Bearer " session.access_token)} {}))))
    "featureFlags" (async (fn []
      (var response (await (auth.getSession)))
      (var session (. (-/checked response) session))
      (var headers {})
      (when session (:= headers.Authorization (+ "Bearer " session.access_token)))
      (var result (await (fetch (new URL "/v1/features" config.apiUrl) {"headers" headers "cache" "no-store" "signal" (AbortSignal.timeout 10000)})))
      (when (not result.ok) (throw (new Error "Feature settings unavailable")))
      (return (await (result.json)))))
    "ready" ready "authProvider" "supabase" "application" app
    "observe" (fn [listener]
      (. ctx.listeners (add listener))
      (. ready (then (fn [] (when (. ctx.listeners (has listener)) (listener ctx.user)))))
      (return (fn [] (. ctx.listeners (delete listener)))))
    "call" (fn [operation values]
      (when ctx.model (return (ctx.model.call operation (or values {}))))
      (var spec (. contracts/operations [operation]))
      (when (not spec) (throw (Object.assign (new Error "This feature is not available in this build.") {"status" 501 "code" "native_operation_unavailable"})))
      (when (not spec.public) (throw (new Error "Sign in first.")))
      (return (app.public.call operation (or values {}))))
    "subscribe" (fn [operation values listener]
      (when ctx.model (return (ctx.model.subscribe operation values listener)))
      (var spec (. contracts/operations [operation]))
      (when (not spec) (throw (Object.assign (new Error "This feature is not available in this build.") {"status" 501 "code" "native_operation_unavailable"})))
      (when (not spec.public) (throw (new Error "Sign in first.")))
      (return (app.public.subscribe operation values listener)))
    "request" (async (fn [path (:= options {})]
      (var revision ctx.revision)
      (var session ctx.session)
      (var check (fn []
        (when (or (not= revision ctx.revision) ctx.closed)
          (throw (new Error "Account changed. Sign in again.")))))
      (return (await (-/requestSocial config path options session check)))))
    "configuration" config
    "profile" (async (fn [target]
      (return (await (client.call (:? ctx.model "profile" "publicProfile") (:? target {"target" target} {}))))))
    "ensureProfile" (async (fn []
      (var me (await (client.call "me" {})))
      (return (Object.assign {} me.profile {"id" me.id "uid" me.id}))))
    "get" (fn [id] (return (client.call (:? ctx.model "session" "publicSession") {"id" id})))
    "list" (fn [values]
      (var input (Object.assign {} (or values {})))
      (. (Object.keys input) (forEach (fn [key] (when (== (. input [key]) nil) (delete (. input [key]))))))
      (return (client.call (:? ctx.model "sessions" "publicSessions") input)))
    "save" (async (fn [id values]
      (var input {"values" values}) (when id (:= input.id id))
      (var result (await (client.call "saveSession" input)))
      (return result.id)))
    "visibility" (fn [id visibility] (return (client.call "visibility" {"id" id "visibility" visibility})))
    "deleteSession" (fn [id] (return (client.call "deleteSession" {"id" id})))
    "email" (async (fn [email password] (return (-/checked (await (auth.signInWithPassword {"email" email "password" password}))))))
    "auth" {"signUp" {"email" (async (fn [input]
      (var response (await (auth.signUp {"email" input.email "password" input.password "options" {"data" {"displayName" input.name} "emailRedirectTo" config.authRedirectTo}})))
      (return (Object.assign {} response {"confirmationRequired" (and (not response.error) (not response.data.session))}))))}}
    "google" (async (fn [] (return (-/checked (await (auth.signInWithOAuth {"provider" "google" "options" {"redirectTo" config.authRedirectTo}}))))))
    "github" (async (fn [] (return (-/checked (await (auth.signInWithOAuth {"provider" "github" "options" {"redirectTo" config.authRedirectTo}}))))))
    "facebook" (async (fn [] (return (-/checked (await (auth.signInWithOAuth {"provider" "facebook" "options" {"redirectTo" config.authRedirectTo}}))))))
    "verify" (async (fn []
      (when (not ctx.user) (throw (new Error "Sign in first.")))
      (return (-/checked (await (auth.resend {"type" "signup" "email" ctx.user.email}))))))
    "verifyCode" (async (fn [code]
      (when (not ctx.user) (throw (new Error "Sign in first.")))
      (return (-/checked (await (auth.verifyOtp {"type" "signup" "email" ctx.user.email "token" code}))))))
    "reauthenticate" (async (fn [password]
      (when (not ctx.user) (throw (new Error "Sign in first.")))
      (return (-/checked (await (auth.signInWithPassword {"email" ctx.user.email "password" password}))))))
    "resetPassword" (async (fn [_token password]
      (when (or (not ctx.user) (not ctx.recovery)) (throw (new Error "Open a valid password recovery link first.")))
      (var data (-/checked (await (auth.updateUser {"password" password}))))
      (:= ctx.recovery false) (transition ctx.session) (return data)))
    "refresh" (async (fn []
      (var data (-/checked (await (auth.getSession))))
      (when (not data.session) (return nil))
      (return (-/checked (await (auth.refreshSession))))))
    "reset" (async (fn [email] (return (-/checked (await (auth.resetPasswordForEmail email {"redirectTo" config.authRedirectTo}))))))
    "signOut" (async (fn []
      (var result (-/checked (await (auth.signOut)))) (transition nil) (return result)))
    "deleteAccount" (async (fn [password]
      (var result nil)
      (try
        (:= result (await (client.call "deleteAccount" {"password" password})))
        (:= ctx.notice "Your account has been deleted.")
        (catch error
          (when (not error.dataDeleted) (throw error))
          (:= ctx.notice error.message)
          (:= result {"ok" false "pending" true})))
      (try (await (auth.signOut {"scope" "local"}))
        (catch error (:= ctx.session nil))
        (finally (transition nil)))
      (return result)))
    "close" (fn []
      (transition nil) (:= ctx.closed true) (. ctx.listeners (clear))
      (registration.data.subscription.unsubscribe))})
  (app.setPublicTransport (fn [operation values]
    (return (-/requestAccount config operation values ctx.session
      (fn [] (when ctx.closed (throw (new Error "Client closed."))))))))
  (Object.defineProperty client "notice" {"get" (fn [] (return ctx.notice))})
  (Object.defineProperty client "user" {"get" (fn [] (return ctx.user))})
  (return client))
