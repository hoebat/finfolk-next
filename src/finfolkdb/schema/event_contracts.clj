(ns finfolkdb.schema.event-contracts
  (:require [finfolkdb.schema.directory-contracts :as d]))
(def DOCUMENT (d/object {:title d/S :description d/S :location d/S :category d/S :capacity {:type ["integer" "null"]}} ["title" "description" "location" "category"]))
(def EVENT (d/object {:id d/U :page_id d/U :document DOCUMENT :state {:type "string" :enum ["draft" "published" "cancelled"]}
                      :visibility {:type "string" :enum ["public" "private"]} :starts_at d/S :ends_at d/S :timezone d/S
                      :capacity {:type ["integer" "null"]} :going d/N :myRsvp {:type ["string" "null"]}
                      :canManage d/B :canModerate d/B :revision d/N :organiser d/S}
                     ["id" "page_id" "document" "state" "visibility" "starts_at" "ends_at" "timezone" "capacity" "going" "myRsvp" "canManage" "canModerate" "revision" "organiser"]))
(def DELIVERY (d/object {:state {:type "string" :enum ["queued" "sending" "sent" "failed" "cancelled"]} :attempts d/N :error d/S} ["state" "attempts" "error"]))
(def OK (d/object {:ok d/B} ["ok"]))
(def SAVE (d/object {:id d/U :revision d/N :page d/U :title d/S :description d/S :location d/S :category d/S
                     :starts d/S :ends d/S :timezone d/S :capacity {:type ["integer" "null"]}
                     :state {:type "string" :enum ["draft" "published"]} :visibility {:type "string" :enum ["public" "private"]}}
                    ["page" "title" "location" "starts" "ends" "timezone" "state" "visibility"]))
(defn op [action request result write & [public]]
  {:rpc (str "native_events_" (.replace action "-" "_")) :arguments ["$actor" "$verified" "$email" "$values"]
   :actor "server" :action action :request request :result result :write write :public (boolean public) :not-found "Event unavailable."})
(def OPERATIONS
  {"publicEvents" (op "list" (d/object {:q d/S :location d/S :category d/S :from d/S :offset d/S :page d/U} []) (d/object {:events (d/array-of EVENT)} ["events"]) false true)
   "publicEvent" (op "public-detail" d/ID (assoc EVENT :type ["object" "null"]) false true)
   "eventMine" (op "mine" d/E (d/object {:events (d/array-of EVENT)} ["events"]) false)
   "eventDetail" (op "detail" d/ID EVENT false)
   "eventSave" (op "save" SAVE d/ID true)
   "eventCancel" (op "cancel" d/ID OK true)
   "eventModerate" (op "moderate" d/ID OK true)
   "eventRoster" (op "roster" d/ID (d/object {:attendees (d/array-of (d/object {:id d/U :name d/S} ["id" "name"]))
                                               :invitations (d/array-of (d/object {:id d/U :email d/S :expires {:type "number"} :revoked d/B :delivery (assoc DELIVERY :type ["object" "null"])} ["id" "email" "expires" "revoked" "delivery"]))} ["attendees" "invitations"]) false)
   "eventInvite" (assoc (op "invite" (d/object {:id d/U :email d/S :send d/B :requestId d/U} ["id" "email"]) (d/object {:id d/U :token d/S :expires {:type "number"} :delivery DELIVERY} ["id" "token" "expires"]) true) :effect "event-invitation")
   "eventInviteRetry" (assoc (op "invite-retry" (d/object {:id d/U :invite d/U} ["id" "invite"]) (d/object {:id d/U :delivery DELIVERY} ["id" "delivery"]) true) :effect "event-invitation-retry")
   "eventRevoke" (op "revoke" (d/object {:id d/U :invite d/U} ["id" "invite"]) OK true)
   "eventAccept" (op "accept" (d/object {:token d/S} ["token"]) d/ID true)
   "eventRsvp" (op "rsvp" (d/object {:id d/U :state {:type "string" :enum ["going" "cancelled"]}} ["id" "state"]) OK true)})
