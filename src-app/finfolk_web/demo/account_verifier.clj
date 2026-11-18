(ns finfolk-web.demo.account-verifier
  "Native saved-case execution through the same page models and account client as Next.js."
  (:require [lang.core :as l]))
(l/script :js {:import [["../../../js/finfolk-next/packages/edge/page-models.js" :as [* pages]]
                         ["../../../js/finfolk-next/packages/edge/native-account-contracts.js" :as [* contracts]]]})
(defn.js resolveRefs [value outputs]
  (when (Array.isArray value) (return (. value (map (fn [v] (return (-/resolveRefs v outputs)))))))
  (when (and value (== (typeof value) "object"))
    (when (. value ["$ref"])
      (var found outputs)
      (. (. value ["$ref"]) (forEach (fn [key]
        (when (or (== found nil) (not (Object.prototype.hasOwnProperty.call found key)))
          (throw (new Error "Unresolved step reference")))
        (:= found (. found [key])))))
      (return found))
    (var result {})
    (. (Object.entries value) (forEach (fn [pair]
      (:= (. result [(. pair [0])]) (-/resolveRefs (. pair [1]) outputs)))))
    (return result))
  (return value))
(defn.js ^{:- [:async]} resolveFixture [context value]
  (when (Array.isArray value)
    (return (await (Promise.all (. value (map (async (fn [item] (return (await (-/resolveFixture context item)))))))))))
  (when (and value (== (typeof value) "object"))
    (when (Object.hasOwn value "$future-hours")
      (var hours (. value ["$future-hours"]))
      (when (or (not (Number.isInteger hours)) (< hours 1) (> hours 8760))
        (throw (new Error "Choose future fixture hours between 1 and 8760")))
      (return (. (new Date (+ (Date.now) (* hours 3600000))) (toISOString))))
    (when (Object.hasOwn value "$actor-email")
      (var owner (await (context.clientFor (. value ["$actor-email"]))))
      (when (not owner.client.user) (throw (new Error "Choose a signed-in fixture actor")))
      (return owner.client.user.email))
    (var pairs [])
    (for:array [pair (Object.entries value)]
      (. pairs (push [(. pair [0]) (await (-/resolveFixture context (. pair [1])))])))
    (return (Object.fromEntries pairs)))
  (return value))
(defn.js selectOutput [value path]
  (when (or (not (Array.isArray path)) (> path.length 16))
    (throw (new Error "Select a result path with at most 16 fields")))
  (var found value)
  (for:array [part path]
    (when (or (== found nil) (not (Object.hasOwn found part)))
      (throw (new Error "Selected result path is unavailable")))
    (:= found (. found [part])))
  (return found))
(defn.js ^{:- [:async]} execute [context input]
  (var trace []) (var states []) (var cache []) (var subscriptions []) (var client nil) (var call nil)
  (try
    (var page (pages.definition input.page))
    (var inputs (or input.inputs {})) (var payload (or input.payload {}))
    (when (== input.kind "resolve")
      (return {"result" (pages.resolveModel input.page input.member inputs payload) "trace" []}))
    (when (not (. ["model" "action" "page"] (includes input.kind)))
      (return {"blocked" "Use a native model, action or page; credentials are managed by the fixture"}))
    (var entries (:? (== input.kind "page") (Object.values (or page.models {}))
                       [(. (or (. page [(:? (== input.kind "action") "actions" "models")]) {}) [input.member])]))
    (when (== entries.length 0)
      (return {"blocked" "This page needs browser, resource or artifact verification rather than an empty model load"}))
    (var missing (. entries (filter (fn [entry] (return (or (not entry) (not (Object.hasOwn contracts.operations entry.operation))))))))
    (when (> missing.length 0)
      (return {"blocked" (+ "Native operations are unavailable: " (. (. missing (map (fn [entry] (return (:? entry entry.operation input.member))))) (join ", ")))}))
    (var owner (await (context.clientFor (or input.actor "alice"))))
    (:= client owner.client) (:= call client.call)
    (:= client.call (async (fn [operation values]
      (var unsubscribe (owner.client.subscribe operation values
        (fn [state] (. states (push {"operation" operation "inputs" values "state" (Object.assign {} state)})))))
      (. subscriptions (push unsubscribe))
      (try
        (var result (await (call operation values)))
        (. trace (push {"operation" operation "inputs" values "status" "ok"}))
        (return result)
        (catch error
          (. trace (push {"operation" operation "inputs" values "status" (or error.status "rejected")}))
          (throw error))
        (finally
          (var value (owner.read operation values))
          (. cache (push {"operation" operation "inputs" values "present" (not (=== value undefined))
                         "value" (:? (=== value undefined) nil value)})))))))
    (var result nil)
    (cond (== input.kind "model") (:= result (await (pages.runModel client input.page input.member inputs payload)))
          (== input.kind "action") (:= result (await (pages.runAction client input.page input.member inputs payload)))
          (== input.kind "page") (:= result (await (pages.runPage client input.page inputs))))
    (return {"result" (:? input.select (-/selectOutput result input.select) result)
             "output" result "trace" trace "states" states "cache" cache})
    (catch error (return {"error" {"message" error.message "code" error.code} "trace" trace "states" states "cache" cache}))
    (finally
      (when client (:= client.call call))
      (. subscriptions (forEach (fn [unsubscribe] (unsubscribe)))))))
(defn.js ^{:- [:async]} scenario [context input]
  (try
    (when input.steps
      (var outputs {}) (var results [])
      (for:array [step input.steps]
        (var resolved (await (-/resolveFixture context (-/resolveRefs step outputs))))
        (var result (await (-/execute context (Object.assign {"actor" (or input.actor "alice")} resolved))))
        (:= (. outputs [step.id]) result)
        (. results (push (Object.assign {"id" step.id} result))))
      (return {"steps" results}))
    (return (await (-/execute context input)))
    (catch error (return {"error" {"message" error.message}}))))
