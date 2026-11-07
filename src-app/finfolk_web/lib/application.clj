(ns finfolk-web.lib.application
  "One application node with public models and replaceable member context."
  (:require [lang.core :as l]))
(l/script :js {:require [[xt.substrate :as substrate]
                        [xt.substrate.page-core :as page]
                        [xt.event.base-model :as events]
                        [finfolk-web.lib.backbone :as backbone]
                        [finfolk-web.lib.worker-bridge :as worker]]})
(def.js APPLICATIONS (new Map))
(defn.js createBridge [config]
  (when (== (. config ["cacheBackend"]) "sqlite")
    (try (return (worker/createWorkerBridge config))
         (catch error (worker/announce "finfolk:cache-status" {"mode" "unavailable" "message" "Application storage unavailable. Using the online memory cache."}))))
  (return nil))
(defn.js state [ctx name value write]
  (var states (. ctx ["states"])) (var model (. states (get name)))
  (when (not model)
    (var models {})
    (:= (. models [name]) {"defaults" {"args" [] "output" nil} "handler" (fn [] (return nil))})
    (page/group-add-attach (. ctx ["node"]) "application" "state" models)
    (:= model (. (page/model-ensure (. ctx ["node"]) "application" "state" name) [1]))
    (. states (set name model)))
  (when write (events/set-output model value false nil nil nil))
  (return (page/model-get-output (. ctx ["node"]) "application" "state" name)))
(defn.js ^{:- [:async]} auth [ctx kind work]
  (-/state ctx "auth" {"status" "loading" "kind" kind} true)
  (try
    (var result (await (work)))
    (-/state ctx "auth" {"status" "ready" "kind" kind} true)
    (return result)
    (catch error
      (-/state ctx "auth" {"status" "error" "kind" kind "message" (. error ["message"])} true)
      (throw error))))
(defn.js member [ctx actor transport]
  (when (or (not (. ctx ["member"])) (not= (. ctx ["member"] ["actor"]) actor))
    (when (. ctx ["member"]) (. (. ctx ["member"]) (close)))
    (:= (. ctx ["member"])
        (:? (. ctx ["bridge"])
          (. (. ctx ["bridge"]) (open actor transport))
          (backbone/createBackbone actor transport
            {"node" (. ctx ["node"])
             "onMutation" (fn [domains] (return (. (. ctx ["public"]) (invalidate domains))))}))))
  (return (. ctx ["member"])))
(defn.js createApplicationBackbone [config]
  (var key (JSON.stringify [(or (. config ["authUrl"]) "") (or (. config ["cacheApiUrl"]) (. config ["apiUrl"]) "") (. config ["cacheBackend"])]))
  (when (. -/APPLICATIONS (has key)) (return (. -/APPLICATIONS (get key))))
  (var ctx {"node" (substrate/node-create {"id" "finfolk-app"})
            "bridge" (-/createBridge config)
            "states" (new Map) "member" nil "publicTransport" nil})
  (var publicTransport (fn [name value options] (return ((. ctx ["publicTransport"]) name value options))))
  (:= (. ctx ["public"])
      (:? (. ctx ["bridge"])
        (. (. ctx ["bridge"]) (open "public" publicTransport))
        (backbone/createBackbone "public" publicTransport {"node" (. ctx ["node"]) "space" "public"})))
  (var app
    {"node" (. ctx ["node"]) "storage" (. ctx ["bridge"]) "ready" (or (. ctx ["public"] ["ready"]) (Promise.resolve)) "public" (. ctx ["public"])
     "state" (fn [name value] (return (-/state ctx name value (> (. arguments ["length"]) 1))))
     "subscribeState" (fn [name callback]
                        (-/state ctx name nil false)
                        (var model (. (. ctx ["states"]) (get name)))
                        (var id (+ "ui-" (Math.random)))
                        (events/add-listener model id (fn [] (callback (-/state ctx name nil false))) nil nil)
                        (return (fn [] (events/remove-listener model id))))
     "setPublicTransport" (fn [transport] (:= (. ctx ["publicTransport"]) transport))
     "member" (fn [actor transport] (return (-/member ctx actor transport)))
     "clearMember" (fn []
                     (var member (. ctx ["member"]))
                     (:= (. ctx ["member"]) nil)
                     (-/state ctx "auth" {"status" "signed-out"} true)
                     (return (:? member (. member (close)) (Promise.resolve))))
     "clearAccountCache" (fn [] (when (. ctx ["member"]) (return (. (. ctx ["member"]) (clearCache)))))
     "auth" (fn [kind work] (return (-/auth ctx kind work)))})
  (. -/APPLICATIONS (set key app))
  (return app))
