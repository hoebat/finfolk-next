(ns finfolk-web.lib.preview-client
  "Development identity adapter. Reads and writes use the actual Substrate backbone."
  (:require [lang.core :as l]))
(l/script :js {:require [[finfolk-web.lib.application :as application]
                        [finfolk-web.lib.operations :as registry]]})
(defn.js createPreviewClient [config actor]
  (var app (application/createApplicationBackbone config))
  (:= app.authProvider "preview") (:= app.configuration config)
  (var user (:? (== actor "guest") nil {"uid" actor "email" "preview@example.test" "emailVerified" true}))
  (var selectActor (fn [nextActor]
    (sessionStorage.setItem "finfolk:preview:actor" nextActor)
    (var url (new URL location.href))
    (url.searchParams.delete "previewActor")
    (location.assign url.href)
    (return (Promise.resolve {}))))
  (var transport (async (fn [operation values]
    (var response (await (fetch "/api/preview/operation"
      {"method" "POST" "headers" {"Content-Type" "application/json"}
       "body" (JSON.stringify {"operation" operation "values" values "actor" actor})})))
    (var result (await (response.json)))
    (when (not response.ok) (throw (Object.assign (new Error result.error) {"status" response.status})))
    (return result))))
  (app.setPublicTransport transport)
  (var model (:? user (app.member actor transport) app.public))
  (var client {"authProvider" "preview" "configuration" config "application" app "user" user
    "ready" app.ready "supports" (fn [_] (return true))
    "observe" (fn [listener] (listener user) (return (fn [])))
    "call" (fn [name values] (return (model.call name (or values {}))))
    "subscribe" (fn [name values listener] (return (model.subscribe name values listener)))
    "request" (async (fn [path options]
      (var method (or (and options options.method) "GET"))
      (var pathname (. (new URL path "http://preview") ["pathname"]))
      (var name (. (Object.keys registry/operations) (find (fn [key]
        (var spec (. registry/operations [key]))
        (return (and (== spec.transport "rest") (== spec.method method)
          (. (new RegExp (+ "^" (. spec.path (replace (new RegExp ":[a-z]+" "g") "[^/]+")) "$")) (test pathname))))))))
      (when name
        (var values {"__rest" true "path" path})
        (when (not= method "GET") (:= values.body (or options.body {})))
        (return (await (model.call name values))))
      (var response (await (fetch (+ "/api/preview/request?path=" (encodeURIComponent path))
        {"method" "POST" "headers" {"Content-Type" "application/json"}
         "body" (JSON.stringify {"actor" actor "options" options})})))
      (var result (await (response.json)))
      (when (not response.ok) (throw (Object.assign (new Error result.error) {"status" response.status})))
      (return result)))
    "notice" (:? user "" "Mock preview: use any email and password to sign in as Alice. No real authentication or email delivery occurs.")
    "email" (fn [_email _password] (return (selectActor "alice")))
    "google" (fn [] (return (selectActor "alice")))
    "auth" {"signUp" {"email" (fn [_input] (return (selectActor "alice")))}}
    "reset" (fn [_email] (throw (new Error "Mock preview does not send password reset emails.")))
    "signOut" (fn [] (return (selectActor "guest")))
    "refresh" (fn [] (return (Promise.resolve)))})
  (:= client.ensureProfile (async (fn [] (var me (await (client.call "me" {}))) (return (Object.assign {} me.profile {"id" actor "uid" actor})))))
  (:= client.profile (fn [target] (return (client.call "profile" {"target" target}))))
  (:= client.list (fn [values] (return (client.call "sessions" (or values {})))))
  (:= client.get (fn [id] (return (client.call "session" {"id" id}))))
  (:= client.save (async (fn [id values] (var result (await (client.call "saveSession" {"id" id "values" values}))) (return result.id))))
  (:= client.visibility (fn [id visibility] (return (client.call "visibility" {"id" id "visibility" visibility}))))
  (:= client.deleteSession (fn [id] (return (client.call "deleteSession" {"id" id}))))
  (return client))
