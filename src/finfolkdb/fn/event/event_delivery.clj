(ns finfolkdb.fn.event.event-delivery
  "Server-only typed delivery calls; no browser operation exposes plaintext outbox data."
  (:require [lang.core :as l]))
(l/script :postgres
  {:require [[postgres.core :as pg] [finfolkdb.common.type-event :as event]]
   :static {:application ["finfolk-entity"] :all {:schema ["finfolk_rpc"]}}})
(defn.pg ^{:- [:jsonb]} event-delivery-enqueue [:uuid i-actor :uuid i-event :uuid i-invite :text i-token :text i-key]
 (let [o-result nil]
  [:execute "SELECT finfolk_rpc.native_event_delivery_operation('enqueue',($1->>'actor')::uuid,($1->>'event')::uuid,($1->>'invite')::uuid,$1->>'token',$1->>'key',NULL,NULL,NULL)" :into o-result :using (pg/jsonb-build-object "actor" i-actor "event" i-event "invite" i-invite "token" i-token "key" i-key)]
  (return o-result)))
(defn.pg ^{:- [:jsonb]} event-delivery-claim [:uuid i-actor :uuid i-event :uuid i-invite :text i-key :uuid i-lease]
 (let [o-result nil]
  [:execute "SELECT finfolk_rpc.native_event_delivery_operation('claim',($1->>'actor')::uuid,($1->>'event')::uuid,($1->>'invite')::uuid,NULL,$1->>'key',($1->>'lease')::uuid,NULL,NULL)" :into o-result :using (pg/jsonb-build-object "actor" i-actor "event" i-event "invite" i-invite "key" i-key "lease" i-lease)]
  (return o-result)))
(defn.pg ^{:- [:jsonb]} event-delivery-complete [:uuid i-actor :uuid i-event :uuid i-invite :uuid i-lease :text i-state :text i-receipt]
 (let [o-result nil]
  [:execute "SELECT finfolk_rpc.native_event_delivery_operation('complete',($1->>'actor')::uuid,($1->>'event')::uuid,($1->>'invite')::uuid,NULL,NULL,($1->>'lease')::uuid,$1->>'state',$1->>'receipt')" :into o-result :using (pg/jsonb-build-object "actor" i-actor "event" i-event "invite" i-invite "lease" i-lease "state" i-state "receipt" i-receipt)]
  (return o-result)))
