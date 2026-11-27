(ns finfolkdb.schema.buddy-contracts "Private buddy communications and shared session planning contracts.")
(def STRING {:type "string"})
(defn operations [operation UUID EMPTY]
 (let [planning (operation "session_planning" ["$actor" "$values"]
     {:type "object" :required ["mode"] :additionalProperties false
      :properties {:mode {:type "string" :enum ["list" "save" "invite" "respond" "start" "finish" "cancel"]}
                   :id UUID :state STRING :title STRING :startsAt STRING :timezone STRING :meetingPoint STRING
                   :beachId UUID :invitees {:type "array" :items UUID}}}
     {:type "object" :additionalProperties true} true)]
  {"buddyRead" (operation "buddy_call" ["$actor" "$values"] {:type "object" :required ["mode"] :additionalProperties false :properties {:mode {:type "string" :enum ["inbox" "thread"]} :conversation UUID :after {:type "integer" :minimum 0} :before {:type "integer" :minimum 1}}} {:type "object" :additionalProperties true} false)
   "buddyAction" (operation "buddy_call" ["$actor" "$values"] {:type "object" :required ["mode"] :additionalProperties false :properties {:mode {:type "string" :enum ["open" "send" "read" "archive"]} :conversation UUID :target UUID :session UUID :body {:type "string" :minLength 1 :maxLength 4000} :requestId UUID :sequence {:type "integer" :minimum 0} :archived {:type "boolean"}}} {:type "object" :additionalProperties true} true)

   "sessionPlans" (operation "session_plans" ["$actor"] EMPTY {:type "object" :additionalProperties true} false)
   "sessionPlanning" planning
   "sessionCheckin" (assoc planning :rpc "session_checkin" :arguments ["$actor" "$verified" "$values"])}))
