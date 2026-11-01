(ns finfolk-web.lib.sharedworker
  "Tab coordinator and host election. Chromium cannot spawn nested workers here."
  (:refer-clojure :exclude [send])
  (:require [lang.core :as l]))
(l/script :js {:require [[finfolk-web.lib.operations :as registry]]})
(def.js Clients (new Set))
(def.js Host nil)
(def.js Kernel nil)
(defn.js send [client message]
  (try (. (. client ["port"]) (postMessage message)) (catch error nil)))
(defn.js attach [client]
  (var channel (new MessageChannel))
  (:= (. client ["kernel"]) (. channel ["port2"]))
  (:= (. (. channel ["port2"]) ["onmessage"]) (fn [event]
    (when (== (. event ["data"] ["type"]) "result") (. (. client ["writes"]) (delete (. event ["data"] ["id"]))))
    (-/send client (. event ["data"]))))
  (. (. channel ["port2"]) (start))
  (. -/Kernel (postMessage {"type" "connect"} [(. channel ["port1"])])))
(defn.js elect []
  (when (not -/Host)
    (:= -/Host (. (Array.from -/Clients) (find (fn [client] (return (. client ["active"]))))))
    (when -/Host (-/send -/Host {"type" "spawn"}))))
(defn.js uncertain [client]
  (for:iter [write (. (. client ["writes"]) (values))]
    (for:iter [target -/Clients]
      (-/send target {"type" "uncertain" "scope" (. write ["scope"]) "domain" (. write ["domain"])})))
  (. (. client ["writes"]) (clear)))
(defn.js restart []
  (when -/Kernel (. -/Kernel (postMessage {"type" "shutdown"})) (. -/Kernel (close)))
  (when -/Host (-/send -/Host {"type" "stop-kernel"}))
  (:= -/Kernel nil) (:= -/Host nil)
  (for:iter [client -/Clients]
    (-/uncertain client)
    (when (. client ["kernel"]) (. (. client ["kernel"]) (close)))
    (:= (. client ["kernel"]) nil)
    (-/send client {"type" "restarting"}))
  (-/elect))
(defn.js detach [client]
  (-/uncertain client)
  (. -/Clients (delete client))
  (when (. client ["kernel"]) (. (. client ["kernel"]) (postMessage {"type" "detach"})) (. (. client ["kernel"]) (close)))
  (:= (. client ["kernel"]) nil)
  (if (== client -/Host) (-/restart)
      (when (not -/Host) (-/elect))))
(defn.js message [client event]
  (var data (. event ["data"]))
  (:= (. client ["seen"]) (Date.now))
  (cond
    (== (. data ["type"]) "coordinator")
    (-/send client {"type" "result" "id" (. data ["id"]) "result" {"clients" (. -/Clients ["size"]) "kernel" (not (not -/Kernel)) "host" (not (not -/Host))}})
    (== (. data ["type"]) "ping")
    (do
      (-/send client {"type" "pong"})
      (:= (. client ["active"]) true)
      (when (not (. -/Clients (has client)))
        (. -/Clients (add client))
        (-/send client {"type" "restarting"})
        (when -/Kernel (-/attach client)))
      (when (not -/Host) (-/elect)))
    (== (. data ["type"]) "yield")
    (do (:= (. client ["active"]) false) (when (== client -/Host) (-/restart)))
    (== (. data ["type"]) "detach")
    (-/detach client)
    (== (. data ["type"]) "kernel")
    (when (and (== client -/Host) (not -/Kernel))
      (:= -/Kernel (. event ["ports"] [0]))
      (. -/Kernel (start))
      (for:iter [target -/Clients] (-/attach target)))
    (== (. data ["type"]) "kernel-failed")
    (when (== client -/Host)
      (for:iter [target -/Clients] (-/send target {"type" "fatal" "error" {"message" "SQLite worker could not start."}})))
    :else (when (. client ["kernel"])
      (when (== (. data ["type"]) "call")
        (var spec (. registry/operations [(. data ["name"])]))
        (when (and spec (. spec ["write"]))
          (. (. client ["writes"]) (set (. data ["id"]) {"scope" (. data ["scope"]) "domain" (. spec ["domain"])}))))
      (. (. client ["kernel"]) (postMessage data)))))
(defn.js start []
  (:= (. globalThis ["onconnect"])
    (fn [event]
      (var client {"port" (. event ["ports"] [0]) "seen" (Date.now) "active" true "writes" (new Map)})
      (. -/Clients (add client))
      (:= (. (. client ["port"]) ["onmessage"]) (fn [event] (-/message client event)))
      (. (. client ["port"]) (start))
      (if -/Kernel (-/attach client) (-/elect))))
  (setInterval (fn []
    (for:iter [client -/Clients]
      (when (> (- (Date.now) (. client ["seen"])) 8000) (-/detach client)))) 2000))
(def.js Started (-/start))
