(ns finfolk-web.lib.backbone
  "Actor-scoped substrate models with an injectable xt.db cache. This is authored source."
  (:require [lang.core :as l]))
(l/script :js
  {:require [[xt.substrate :as substrate]
             [xt.substrate.page-core :as page]
             [xt.event.base-model :as events]
             [xt.db.system.impl-memory :as memory]
             [xt.db.system.memory-util :as cache-util]
             [finfolk-web.lib.operations :as registry]]})

(defn.js stableKey [value]
  (when (Array.isArray value)
    (return (+ "[" (. (. value (map -/stableKey)) (join ",")) "]")))
  (when (and value (== (typeof value) "object"))
    (var keys (. (Object.keys value) (sort)))
    (var allowed (. keys (filter (fn [key] (return (not (=== (. value [key]) undefined)))))))
    (var pairs (. allowed (map (fn [key] (return (+ (JSON.stringify key) ":" (-/stableKey (. value [key]))))))))
    (return (+ "{" (. pairs (join ",")) "}")))
  (return (JSON.stringify value)))

(defn.js publish [ctx entry state]
  (:= (. entry ["state"]) (Object.assign {} (. entry ["state"]) state))
  (when (and (not (. entry ["spec"] ["write"])) (== (. entry ["state"] ["status"]) "ready"))
    ((. ctx ["onPublish"]) (. entry ["key"]) (. entry ["state"])))
  (events/set-output (. entry ["model"]) (. entry ["state"]) (not (not (. entry ["state"] ["error"]))) nil nil nil))

(defn.js ensureOpen [ctx]
  (when (. ctx ["closed"]) (throw (new Error "Account context closed."))))

(defn.js ensureModel [ctx name values]
  (var spec (registry/operation name))
  (when (and (. spec ["auth"]) (== (. ctx ["actor"]) "public")) (throw (new Error "Sign in again.")))
  (var key (:? (. spec ["write"]) name (+ name ":" (-/stableKey values))))
  (var entries (. ctx ["entries"]))
  (var entry (. entries (get key)))
  (when (not entry)
    (when (>= (. entries ["size"]) 256)
      (var old (. (Array.from (. entries (values)))
                  (find (fn [e] (return (and (not (. e ["spec"] ["write"])) (== (. e ["listeners"] ["size"]) 0)
                                            (not (. (. ctx ["pending"]) (has (. e ["key"]))))))))))
      (when old
        (. entries (delete (. old ["key"])))
        ((. ctx ["storage"] ["remove"]) (. old ["key"]))
        (page/model-remove (. ctx ["node"]) (. ctx ["space"]) (. old ["group"]) (. old ["id"]))
        (delete (. (page/group-get (. ctx ["node"]) (. ctx ["space"]) (. old ["group"])) ["specs"] [(. old ["id"])]))))
    (:= (. ctx ["sequence"]) (+ 1 (. ctx ["sequence"])))
    (var id (+ "model-" (. ctx ["sequence"])))
    (var group (:? (. spec ["admin"]) "admin" (. spec ["domain"])))
    (:= entry {"key" key "name" name "values" (:? (. spec ["write"]) {} values)
               "spec" spec "id" id "group" group "listeners" (new Set) "state" {"status" "idle"} "revision" 0})
    (when (not (. spec ["write"]))
      (var saved ((. ctx ["storage"] ["get"]) key))
      (when saved (:= (. entry ["state"]) {"status" "stale" "data" (. saved ["data"]) "cached" true "savedAt" (. saved ["savedAt"])})))
    (. entries (set key entry))
    (var definition {"defaults" {"args" [{}] "output" nil}
                    "handler" (fn [_context input]
                                (return (. (Promise.resolve ((. ctx ["transport"]) name input (or (. entry ["options"]) {})))
                                           (then (fn [result] (-/ensureOpen ctx) (return result))))))})
    (var models {}) (:= (. models [id]) definition)
    (page/group-add-attach (. ctx ["node"]) (. ctx ["space"]) group models)
    (:= (. entry ["model"]) (. (page/model-ensure (. ctx ["node"]) (. ctx ["space"]) group id) [1]))
    (events/add-listener (. entry ["model"]) "finfolk"
      (fn []
        (for:iter [callback (. entry ["listeners"])]
          (try (callback (. entry ["state"]))
               (catch error (console.error "Substrate view subscriber failed."))))) nil nil))
  (return entry))

(defn.js invalidateEntry [ctx entry]
  (:= (. entry ["revision"]) (+ 1 (. entry ["revision"])))
  ((. ctx ["storage"] ["remove"]) (. entry ["key"]))
  ((. ctx ["onInvalidate"]) (. entry ["key"]))
  (-/publish ctx entry {"status" "stale" "cached" false}))

(defn.js ^{:- [:async]} refreshEntry [ctx entry]
  (var inflight (. (. ctx ["pending"]) (get (. entry ["key"]))))
  (when inflight (await (. inflight (catch (fn [])))))
  (return ((. ctx ["call"]) (. entry ["name"]) (. entry ["values"]))))

(defn.js ^{:- [:async]} run [ctx name values options]
  (-/ensureOpen ctx)
  (var entry (-/ensureModel ctx name values)) (var spec (. entry ["spec"]))
  (when (and (. spec ["write"]) (. (. ctx ["blocked"]) (has (. spec ["domain"]))))
    (throw (new Error "Reload before making another change: the previous change was saved but its refresh failed.")))
  (var revision (. entry ["revision"]))
  (:= (. entry ["options"]) options)
  (-/publish ctx entry {"status" "loading" "error" nil})
  (events/set-input (. entry ["model"]) {"data" [values]})
  (var result nil)
  (try
    (var acc (await (page/model-refresh (. ctx ["node"]) (. ctx ["space"]) (. entry ["group"]) (. entry ["id"]) {} nil)))
    (-/ensureOpen ctx)
    (var output (page/model-get-output (. ctx ["node"]) (. ctx ["space"]) (. entry ["group"]) (. entry ["id"])))
    (when (. acc ["error"]) (throw (or output (new Error "Request failed."))))
    (:= result output)
    (when (and (not (. spec ["write"])) (== revision (. entry ["revision"])))
      ((. ctx ["storage"] ["put"]) (. entry ["key"]) result spec)
      (-/publish ctx entry {"status" "ready" "data" result "error" nil "cached" false "savedAt" (Date.now)}))
    (when (. spec ["write"])
      (-/publish ctx entry {"status" "ready" "data" undefined "error" nil})
      (var domains (registry/affectedDomains spec))
      (when (. ctx ["storage"] ["invalidate"]) ((. ctx ["storage"] ["invalidate"]) domains))
      (var refresh (. (Array.from (. (. ctx ["entries"]) (values)))
                      (filter (fn [e] (return (and (not (. e ["spec"] ["write"])) (. domains (includes (. e ["spec"] ["domain"])))))))))
      (for:array [e refresh] (-/invalidateEntry ctx e))
      (when (and (== name "preferences") (not (. refresh (some (fn [e] (return (== (. e ["name"]) "me")))))))
        (. refresh (push (-/ensureModel ctx "me" {}))))
      (when (and (== name "checkin") (not (. refresh (some (fn [e] (return (== (. e ["name"]) "myCheckins")))))))
        (. refresh (push (-/ensureModel ctx "myCheckins" {}))))
      (try
        (await ((. ctx ["onMutation"]) domains))
        (await (Promise.all (-> refresh
          (. (filter (fn [e] (return (and (not= name "deleteAccount")
            (or (> (. e ["listeners"] ["size"]) 0)
                (and (== name "preferences") (== (. e ["name"]) "me"))
                (and (== name "checkin") (== (. e ["name"]) "myCheckins"))))))))
          (. (map (fn [e] (return (-/refreshEntry ctx e))))))))
        (catch error
          (. (. ctx ["blocked"]) (add (. spec ["domain"])))
          ((. ctx ["onBlocked"]) (. spec ["domain"]))
          (throw (Object.assign (new Error "Saved, but refreshing the account failed. Reload before making another change.")
                                {"mutationCommitted" true "result" result "cause" error})))))
    (return result)
    (catch error
      (when (and (. spec ["write"]) (not (. error ["status"])) (not (. ctx ["closed"])))
        (. (. ctx ["blocked"]) (add (. spec ["domain"])))
        ((. ctx ["onBlocked"]) (. spec ["domain"]))
        (when (not (. error ["mutationCommitted"])) (:= (. error ["mutationOutcomeUnknown"]) true)))
      (when (and (not (. ctx ["closed"])) (not (. spec ["write"])) (. ctx ["offlineReads"]) (not (. error ["status"])) (not= (. error ["name"]) "AbortError"))
        (var saved ((. ctx ["storage"] ["get"]) (. entry ["key"])))
        (when saved
          ((. ctx ["onCached"]) saved)
          (-/publish ctx entry {"status" "ready" "data" (. saved ["data"]) "cached" true "savedAt" (. saved ["savedAt"]) "error" nil})
          (return (. saved ["data"]))))
      (when (and (not (. spec ["write"])) (. error ["status"])) ((. ctx ["storage"] ["remove"]) (. entry ["key"])))
      (when (and (not (. spec ["write"])) (. error ["status"])) ((. ctx ["onInvalidate"]) (. entry ["key"])))
      (when (not (. ctx ["closed"])) (-/publish ctx entry {"status" "error" "error" error "data" (:? (. spec ["write"]) undefined (. entry ["state"] ["data"]))}))
      (throw error))
    (finally
      (:= (. entry ["options"]) nil)
      (when (or (. spec ["write"]) (. ctx ["closed"]))
        (events/set-input (. entry ["model"]) {"data" [{}]})
        (events/set-output (. entry ["model"]) nil false nil nil nil)))))

(defn.js call [ctx name values options]
  (:= values (or values {})) (:= options (or options {}))
  (var spec (registry/operation name))
  (when (. ctx ["closed"]) (return (Promise.reject (new Error "Account context closed."))))
  (when (not (. spec ["write"]))
    (var key (+ name ":" (-/stableKey values)))
    (var pending (. ctx ["pending"]))
    (when (. pending (has key)) (return (. pending (get key))))
    (var task (-/run ctx name values options))
    (. pending (set key task))
    (. (. task (finally (fn [] (when (== (. pending (get key)) task) (. pending (delete key)))))) (catch (fn [])))
    (return task))
  (var queues (. ctx ["queues"]))
  (var tail (or (. queues (get (. spec ["domain"]))) (Promise.resolve)))
  (var task (. tail (then (fn [] (return (-/run ctx name values options))))))
  (. queues (set (. spec ["domain"]) (. task (catch (fn [])))))
  (return task))

(defn.js ^{:- [:async]} invalidate [ctx domains]
  (when (. ctx ["storage"] ["invalidate"]) ((. ctx ["storage"] ["invalidate"]) domains))
  (var refresh [])
  (for:iter [entry (. (. ctx ["entries"]) (values))]
    (when (and (not (. entry ["spec"] ["write"])) (. domains (includes (. entry ["spec"] ["domain"]))))
      (-/invalidateEntry ctx entry)
      (when (> (. entry ["listeners"] ["size"]) 0) (. refresh (push entry)))))
  (await (Promise.all (. refresh (map (fn [entry] (return (-/refreshEntry ctx entry))))))))

(defn.js close [ctx]
  (:= (. ctx ["closed"]) true)
  ((. ctx ["storage"] ["clear"]))
  (for:iter [entry (. (. ctx ["entries"]) (values))]
    (. (. entry ["listeners"]) (clear))
    (:= (. entry ["state"]) {"status" "closed"})
    (events/set-input (. entry ["model"]) {"data" [{}]})
    (events/set-output (. entry ["model"]) nil false nil nil nil))
  (. (. ctx ["entries"]) (clear))
  (delete (. ctx ["node"] ["spaces"] [(. ctx ["space"])])))

(defn.js createBackbone [actor transport opts]
  (:= opts (or opts {}))
  (var node (or (. opts ["node"]) (substrate/node-create {"id" (+ "finfolk:" actor)})))
  (var space (or (. opts ["space"]) (+ "member:" actor)))
  (var schema {"Result" {"id" {"ident" "id" "type" "text" "primary" true "order" 0}
                         "value" {"ident" "value" "type" "jsonb" "order" 1}}})
  (var cache (memory/impl-memory schema {"Result" {"position" 0}}))
  (var storage (or (. opts ["storage"])
    {"get" (fn [key]
      (var found (cache-util/get-entry (. cache ["rows"]) "Result" key))
      (return (:? found {"data" (. found ["record"] ["data"] ["value"])} nil)))
     "put" (fn [key value _spec] (memory/record-add cache "Result" [{"id" key "value" value}]))
     "remove" (fn [key] (memory/record-delete cache "Result" [key]))
     "clear" (fn [] (memory/clear-db cache))}))
  (var ctx {"actor" actor "transport" transport "node" node "space" space
            "cache" cache "storage" storage "offlineReads" (. opts ["offlineReads"])
            "onCached" (or (. opts ["onCached"]) (fn [_saved]))
            "onPublish" (or (. opts ["onPublish"]) (fn [_key _state]))
            "onBlocked" (or (. opts ["onBlocked"]) (fn [_domain]))
            "onInvalidate" (or (. opts ["onInvalidate"]) (fn [_key]))
            "entries" (new Map) "pending" (new Map) "queues" (new Map) "blocked" (new Set)
            "closed" false "sequence" 0 "onMutation" (or (. opts ["onMutation"]) (fn []))})
  (:= (. ctx ["call"]) (fn [name values options] (return (-/call ctx name values options))))
  (return {"kind" "xt.substrate+xt.db" "actor" actor "node" node "cache" (. ctx ["cache"]) "space" space
           "supports" (fn [name] (return (not (not (. registry/operations [name])))))
           "call" (. ctx ["call"])
           "read" (fn [name values]
                    (var entry ((. storage ["get"]) (+ name ":" (-/stableKey (or values {})))))
                    (return (:? entry (. entry ["data"]) undefined)))
           "subscribe" (fn [name values callback]
                         (var entry (-/ensureModel ctx name (or values {})))
                         (. (. entry ["listeners"]) (add callback)) (callback (. entry ["state"]))
                         (return (fn [] (. (. entry ["listeners"]) (delete callback)))))
           "clearCache" (fn [] ((. storage ["clear"]))
             (for:iter [entry (. (. ctx ["entries"]) (values))]
               (:= (. entry ["revision"]) (+ 1 (. entry ["revision"])))
               (-/publish ctx entry {"status" "idle" "data" undefined "cached" false})))
           "recover" (async (fn []
             (var domains (Array.from (. ctx ["blocked"])))
             (when (== (. domains ["length"]) 0) (return true))
             (var reads (. (Array.from (. (. ctx ["entries"]) (values)))
               (filter (fn [entry] (return (and (not (. entry ["spec"] ["write"])) (. domains (includes (. entry ["spec"] ["domain"])))))))))
             (when (== (. reads ["length"]) 0) (return false))
             (try
               (await ((. ctx ["onMutation"]) domains))
               (await (Promise.all (. reads (map (fn [entry] (return (-/refreshEntry ctx entry)))))))
               (. (. ctx ["blocked"]) (clear)) (return true)
               (catch error (return false)))))
           "forget" (fn []
             (for:iter [entry (. (. ctx ["entries"]) (values))]
               (:= (. entry ["revision"]) (+ 1 (. entry ["revision"])))
               (-/publish ctx entry {"status" "idle" "data" undefined "cached" false})))
           "invalidate" (fn [domains] (return (-/invalidate ctx domains)))
           "close" (fn [] (-/close ctx))}))
