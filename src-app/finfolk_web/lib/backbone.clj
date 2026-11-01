(ns finfolk-web.lib.backbone
  "Actor-scoped substrate models and xt.db memory cache. This is authored source."
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
        (memory/record-delete (. ctx ["cache"]) "Result" [(. old ["key"])])
        (page/model-remove (. ctx ["node"]) (. ctx ["space"]) (. old ["group"]) (. old ["id"]))
        (delete (. (page/group-get (. ctx ["node"]) (. ctx ["space"]) (. old ["group"])) ["specs"] [(. old ["id"])]))))
    (:= (. ctx ["sequence"]) (+ 1 (. ctx ["sequence"])))
    (var id (+ "model-" (. ctx ["sequence"])))
    (var group (:? (. spec ["admin"]) "admin" (. spec ["domain"])))
    (:= entry {"key" key "name" name "values" (:? (. spec ["write"]) {} values)
               "spec" spec "id" id "group" group "listeners" (new Set) "state" {"status" "idle"} "revision" 0})
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
  (memory/record-delete (. ctx ["cache"]) "Result" [(. entry ["key"])])
  (-/publish ctx entry {"status" "stale"}))

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
      (memory/record-add (. ctx ["cache"]) "Result" [{"id" (. entry ["key"]) "value" result}])
      (-/publish ctx entry {"status" "ready" "data" result "error" nil}))
    (when (. spec ["write"])
      (-/publish ctx entry {"status" "ready" "data" undefined "error" nil})
      (var domains (registry/affectedDomains spec))
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
          (throw (Object.assign (new Error "Saved, but refreshing the account failed. Reload before making another change.")
                                {"mutationCommitted" true "result" result "cause" error})))))
    (return result)
    (catch error
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
  (var refresh [])
  (for:iter [entry (. (. ctx ["entries"]) (values))]
    (when (and (not (. entry ["spec"] ["write"])) (. domains (includes (. entry ["spec"] ["domain"]))))
      (-/invalidateEntry ctx entry)
      (when (> (. entry ["listeners"] ["size"]) 0) (. refresh (push entry)))))
  (await (Promise.all (. refresh (map (fn [entry] (return (-/refreshEntry ctx entry))))))))

(defn.js close [ctx]
  (:= (. ctx ["closed"]) true)
  (memory/clear-db (. ctx ["cache"]))
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
  (var ctx {"actor" actor "transport" transport "node" node "space" space
            "cache" (memory/impl-memory schema {"Result" {"position" 0}})
            "entries" (new Map) "pending" (new Map) "queues" (new Map) "blocked" (new Set)
            "closed" false "sequence" 0 "onMutation" (or (. opts ["onMutation"]) (fn []))})
  (:= (. ctx ["call"]) (fn [name values options] (return (-/call ctx name values options))))
  (return {"kind" "xt.substrate+xt.db" "actor" actor "node" node "cache" (. ctx ["cache"]) "space" space
           "supports" (fn [name] (return (not (not (. registry/operations [name])))))
           "call" (. ctx ["call"])
           "read" (fn [name values]
                    (var entry (cache-util/get-entry (. ctx ["cache"] ["rows"]) "Result" (+ name ":" (-/stableKey (or values {})))))
                    (return (:? entry (. entry ["record"] ["data"] ["value"]) undefined)))
           "subscribe" (fn [name values callback]
                         (var entry (-/ensureModel ctx name (or values {})))
                         (. (. entry ["listeners"]) (add callback)) (callback (. entry ["state"]))
                         (return (fn [] (. (. entry ["listeners"]) (delete callback)))))
           "invalidate" (fn [domains] (return (-/invalidate ctx domains)))
           "close" (fn [] (-/close ctx))}))
