(ns finfolk-web.lib.supabase-client
  "Auth adapter and actor-scoped account model. Supabase SDK is injected by the browser boundary."
  (:require [lang.core :as l]))
(l/script :js {:require [[finfolk-web.lib.native-account-contracts :as contracts]]})
(defn.js checked [response]
  (when response.error (throw response.error))
  (return response.data))
(defn.js ^{:- [:async]} requestAccount [config operation values session check]
  (:= values (contracts/compactRequest values))
  (var spec (. contracts/operations [operation]))
  (when (not spec)
    (throw (Object.assign (new Error "This feature is not available in this build.") {"status" 501 "code" "native_operation_unavailable"})))
  (try (contracts/validate spec.request values)
    (catch error (throw (Object.assign error {"status" 400 "code" "invalid_account_input"}))))
  (when (and (not session) (not spec.public)) (throw (Object.assign (new Error "Sign in first.") {"status" 401})))
  (check)
  (var headers {"Content-Type" "application/json"})
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
(defn.js createAccountClient [auth config app]
  (when (not app) (throw (new Error "An application backbone is required")))
  (:= app.authProvider "supabase") (:= app.configuration config)
  (var ctx {"revision" 0 "user" nil "session" nil "model" nil "listeners" (new Set) "closed" false "recovery" false "notice" ""})
  (var transition (fn [session (:= event nil)]
    (when ctx.closed (return nil))
    (:= ctx.revision (+ ctx.revision 1))
    (when (== event "SIGNED_IN") (:= ctx.notice ""))
    (when (== event "PASSWORD_RECOVERY") (:= ctx.recovery true))
    (when (not session) (:= ctx.recovery false))
    (when ctx.model (app.clearMember))
    (:= ctx.model nil) (:= ctx.session session)
    (:= ctx.user (:? session {"uid" session.user.id "email" session.user.email "emailVerified" (not (not session.user.email_confirmed_at)) "recovery" ctx.recovery} nil))
    (when session
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
    "request" (async (fn [_path _options]
      (throw (Object.assign (new Error "This feature is not available in this build.")
                            {"status" 501 "code" "native_operation_unavailable"}))))
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
      (var response (await (auth.signUp {"email" input.email "password" input.password "options" {"data" {"displayName" input.name}}})))
      (return (Object.assign {} response {"confirmationRequired" (and (not response.error) (not response.data.session))}))))}}
    "google" (async (fn [] (return (-/checked (await (auth.signInWithOAuth {"provider" "google" "options" {"redirectTo" config.authRedirectTo}}))))))
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
    (return (-/requestAccount config operation values nil
      (fn [] (when ctx.closed (throw (new Error "Client closed."))))))))
  (Object.defineProperty client "notice" {"get" (fn [] (return ctx.notice))})
  (Object.defineProperty client "user" {"get" (fn [] (return ctx.user))})
  (return client))
