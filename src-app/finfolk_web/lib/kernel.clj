(ns finfolk-web.lib.kernel
  "Single SQLite writer and substrate model owner. Ports never carry stored credentials."
  (:refer-clojure :exclude [send])
  (:require [lang.core :as l]))
(l/script :js {:require [[finfolk-web.lib.backbone :as backbone]
                        [finfolk-web.lib.sqlite :as sqlite]
                        [finfolk-web.lib.operations :as registry]]})
(def.js SCOPES (new Map))
(def.js CLIENTS (new Set))
(def.js HTTP (new Map))
(def.js STORE nil)
(def.js BOOT nil)
(def.js SEQUENCE 0)
(def.js Epoch (. crypto (randomUUID)))
(def.js Release nil)
(defn.js send [client message]
  (try (. (. client ["port"]) (postMessage message)) (catch error nil)))
(defn.js errorData [error]
  (return {"message" (or (. error ["message"]) "Worker request failed.")
           "status" (. error ["status"]) "code" (. error ["code"]) "name" (. error ["name"])
           "mutationCommitted" (. error ["mutationCommitted"]) "result" (. error ["result"])
           "mutationOutcomeUnknown" (. error ["mutationOutcomeUnknown"])
           "details" (. error ["details"]) "requestId" (. error ["requestId"])}))
(defn.js ^{:- [:async]} boot [ephemeral]
  (when (not -/BOOT)
    (:= -/BOOT (new Promise (fn [resolve reject]
      (var open (async (fn []
        (try
          (:= -/STORE (await (sqlite/openStore "/finfolk-next/application-cache" ephemeral)))
          (resolve -/STORE)
          (catch error (reject error))))))
      (if (and (not ephemeral) (. globalThis ["navigator"] ["locks"]))
        (. (. (. globalThis ["navigator"] ["locks"]) (request "finfolk-sqlite-writer"
          (async (fn []
            (await (open))
            (when (and -/STORE (== (. -/STORE ["mode"]) "persistent"))
              (await (new Promise (fn [hold] (:= -/Release hold)))))))))
          (catch reject))
        (open))))))
  (return (await -/BOOT)))
(defn.js transport [scope name values options]
  (var clients (. scope ["clients"]))
  (var client (. (Array.from clients) (find (fn [c] (return (== (. c ["id"]) (. options ["client"])))))))
  (:= client (or client (. (Array.from clients) [0])))
  (when (not client) (return (Promise.reject (new Error "No signed-in page is available to refresh this account."))))
  (:= -/SEQUENCE (+ 1 -/SEQUENCE))
  (var id (+ -/Epoch "-http-" -/SEQUENCE))
  (return (new Promise (fn [resolve reject]
    (var timer (setTimeout (fn []
      (. -/HTTP (delete id))
      (-/send client {"type" "http-abort" "id" id})
      (reject (new Error "Account request timed out."))) 30000))
    (. -/HTTP (set id {"resolve" resolve "reject" reject "timer" timer "client" client "scope" (. scope ["id"]) "request" (. options ["request"])}))
    (-/send client {"type" "http" "id" id "scope" (. scope ["id"]) "name" name "values" values
                   "request" (. options ["request"]) "options" {"idempotencyKey" (. options ["idempotencyKey"])}})))))
(defn.js scope [client actor]
  (var id (+ (. client ["environment"]) "|" actor))
  (var scope (. -/SCOPES (get id)))
  (when (not scope)
    (:= scope {"id" id "actor" actor "clients" (new Set)})
    (var onMutation (fn [domains]
      (var publicScope (. -/SCOPES (get (+ (. client ["environment"]) "|public"))))
      (when (and publicScope (not= actor "public"))
        (return (. (. publicScope ["backbone"]) (invalidate domains))))))
    (:= (. scope ["backbone"])
      (backbone/createBackbone actor
        (fn [name values options] (return (-/transport scope name values options)))
        {"space" id "storage" (sqlite/adapter -/STORE id) "offlineReads" true "onMutation" onMutation
         "onInvalidate" (fn [key] (for:iter [target (. scope ["clients"])]
           (-/send target {"type" "invalidated" "scope" id "key" key})))
         "onPublish" (fn [key state] (for:iter [target (. scope ["clients"])]
           (-/send target {"type" "snapshot" "scope" id "key" key "state" (Object.assign {} state {"error" nil})})))
         "onBlocked" (fn [domain] (for:iter [target (. scope ["clients"])]
           (-/send target {"type" "blocked" "scope" id "domain" domain})))
         "onCached" (fn [saved] (for:iter [target (. scope ["clients"])]
           (-/send target {"type" "cached" "savedAt" (. saved ["savedAt"])})))}))
    (. -/SCOPES (set id scope)))
  (. (. scope ["clients"]) (add client))
  (. (. client ["scopes"]) (add id))
  (return scope))
(defn.js purge [scope]
  (for:iter [client (. scope ["clients"])]
    (. (. client ["scopes"]) (delete (. scope ["id"])))
    (-/send client {"type" "cleared" "scope" (. scope ["id"]) "actor" (. scope ["actor"])}))
  (for:iter [[id task] -/HTTP]
    (when (== (. task ["scope"]) (. scope ["id"]))
      (clearTimeout (. task ["timer"]))
      ((. task ["reject"]) (new Error "Account context closed."))
      (-/send (. task ["client"]) {"type" "http-abort" "id" id})
      (. -/HTTP (delete id))))
  (. (. scope ["backbone"]) (close))
  (. -/SCOPES (delete (. scope ["id"]))))
(defn.js detach [client]
  (for:iter [scope-id (. client ["scopes"])]
    (var scope (. -/SCOPES (get scope-id)))
    (when scope (. (. scope ["clients"]) (delete client))))
  (for:iter [stop (. (. client ["subscriptions"]) (values))] (stop))
  (. (. client ["subscriptions"]) (clear))
  (. -/CLIENTS (delete client)))
(defn.js ^{:- [:async]} handle [client message]
  (var type (. message ["type"]))
  (when (== type "http-result")
    (var task (. -/HTTP (get (. message ["id"]))))
    (when (and task (== (. task ["client"]) client))
      (. -/HTTP (delete (. message ["id"]))) (clearTimeout (. task ["timer"]))
      (if (. message ["error"])
        ((. task ["reject"]) (Object.assign (new Error (. message ["error"] ["message"])) (. message ["error"])))
        ((. task ["resolve"]) (. message ["result"]))))
    (return))
  (when (== type "detach") (-/detach client) (return))
  (when (== type "cancel")
    (for:iter [[id task] -/HTTP]
      (when (and (== (. task ["client"]) client) (== (. task ["request"]) (. message ["request"])))
        (-/send client {"type" "http-abort" "id" id})))
    (return))
  (try
    (var result nil)
    (cond
      (== type "hello")
      (do
        (when (not= (. message ["protocol"]) 1) (throw (new Error "Reload FinFolk to update its cache connection.")))
        (:= (. client ["environment"]) (. message ["environment"]))
        (:= (. client ["id"]) (. message ["client"]))
        (:= result (sqlite/storageStats -/STORE)))
      (not (. client ["environment"])) (throw (new Error "Worker connection is not initialized."))
      (== type "attach")
      (do (var opened (-/scope client (. message ["actor"]))) (:= result (. opened ["id"])))
      (== type "stats") (:= result (sqlite/storageStats -/STORE))
      (== type "evict")
      (do
        (var allowed (. (sqlite/storageStats -/STORE) ["entries"]))
        (var ids (. (. message ["ids"]) (filter (fn [id] (return (. id (startsWith (+ (. client ["environment"]) "|"))))))))
        (sqlite/removeIds -/STORE ids)
        (for:iter [scope (. -/SCOPES (values))]
          (when (. (. scope ["id"]) (startsWith (+ (. client ["environment"]) "|")))
            (. (. scope ["backbone"]) (forget))
            (for:iter [target (. scope ["clients"])] (-/send target {"type" "evicted" "scope" (. scope ["id"])}))))
        (:= result true))
      :else
      (do
        (var scope (. -/SCOPES (get (. message ["scope"]))))
        (when (or (not scope) (not (. (. client ["scopes"]) (has (. scope ["id"])))))
          (throw (new Error "Account context closed.")))
        (var model (. scope ["backbone"]))
        (cond
          (== type "call") (:= result (await (. model (call (. message ["name"]) (. message ["values"])
            (Object.assign {} (. message ["options"]) {"client" (. client ["id"]) "request" (. message ["id"])})))))
          (== type "hydrate") (:= result (. model (hydrate (. message ["name"]) (. message ["values"]) (. message ["data"]) (. message ["stamp"]))))
          (== type "subscribe")
          (do
            (var sub (. message ["subscription"]))
            (var stop (. model (subscribe (. message ["name"]) (. message ["values"])
              (fn [state] (-/send client {"type" "state" "scope" (. scope ["id"]) "subscription" sub
                "key" (+ (. message ["name"]) ":" (backbone/stableKey (. message ["values"])))
                "state" (Object.assign {} state {"error" (:? (. state ["error"]) (-/errorData (. state ["error"])) nil)})})))))
            (. (. client ["subscriptions"]) (set sub stop)))
          (== type "unsubscribe")
          (do (var stop (. (. client ["subscriptions"]) (get (. message ["subscription"]))))
              (when stop (stop)) (. (. client ["subscriptions"]) (delete (. message ["subscription"]))))
          (== type "invalidate") (await (. model (invalidate (. message ["domains"]))))
          (== type "recover") (:= result (await (. model (recover))))
          (== type "clear-cache") (do
            (sqlite/clearScope -/STORE (. scope ["id"])) (. model (forget))
            (for:iter [target (. scope ["clients"])] (-/send target {"type" "evicted" "scope" (. scope ["id"])})))
          (== type "purge") (-/purge scope)
          :else (throw (new Error "Unknown worker operation.")))))
    (-/send client {"type" "result" "id" (. message ["id"]) "result" result})
    (when (. ["call" "hydrate"] (includes type))
      (for:iter [target -/CLIENTS] (when (== (. target ["environment"]) (. client ["environment"])) (-/send target {"type" "changed"}))))
    (catch error (-/send client {"type" "result" "id" (. message ["id"]) "error" (-/errorData error)}))))
(defn.js ^{:- [:async]} accept [port ephemeral]
  (try
    (await (-/boot ephemeral))
    (var client {"port" port "scopes" (new Set) "subscriptions" (new Map)})
    (. -/CLIENTS (add client))
    (:= (. port ["onmessage"]) (fn [event] (-/handle client (. event ["data"]))))
    (. port (start))
    (-/send client {"type" "ready" "protocol" 1 "epoch" -/Epoch})
    (catch error (. port (postMessage {"type" "fatal" "error" (-/errorData error)})))))
(defn.js start []
  (:= (. globalThis ["onmessage"])
      (fn [event]
        (when (== (. event ["data"] ["type"]) "broker")
          (var broker (. event ["ports"] [0]))
          (:= (. broker ["onmessage"]) (fn [request]
            (when (== (. request ["data"] ["type"]) "shutdown")
              (when -/STORE (. (. -/STORE ["db"]) (close)))
              (when -/Release (-/Release true))
              (setTimeout (fn [] (. globalThis (close))) 0))
            (when (== (. request ["data"] ["type"]) "connect") (-/accept (. request ["ports"] [0]) false))))
          (. broker (start)))
        (when (== (. event ["data"] ["type"]) "connect")
          (-/accept (. event ["ports"] [0]) (. event ["data"] ["ephemeral"]))))))
(def.js Started (-/start))
