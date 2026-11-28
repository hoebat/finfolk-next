(ns finfolkdb.fn.social.social-operator
  "Trusted operator reads and evidence-gated social activation."
  (:require [lang.core :as l]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-messaging-base :as messaging]
             [finfolkdb.common.type-user :as users]
             [finfolkdb.fn.social.social-manage :as social]
             [finfolkdb.common.type-messaging-delivery :as delivery]
             [finfolkdb.common.type-social-workflow :as workflow]
             [finfolkdb.fn.messaging.messaging-authorization :as authorization]]
   :static {:application ["finfolk-entity"] :all {:schema ["finfolk_rpc"]}}})

(defn.pg ret-social-operator-health
  [:uuid i-application :uuid i-inbox]
  (let [o-inbox (pg/t:get messaging/MessagingAccount {:where {:id i-inbox :application i-application}})]
    (when [o-inbox :is-null] [:raise-exception "Social inbox outside application scope"])
    (let [(:bigint v-pending) (pg/t:count delivery/MessagingOutbox {:where {:account i-inbox :state "pending"}})
          (:bigint v-uncertain) (pg/t:count delivery/MessagingOutbox {:where {:account i-inbox :state "uncertain"}})
          (:bigint v-failed) (pg/t:count delivery/MessagingOutbox {:where {:account i-inbox :state "failed"}})
          (:bigint v-waiting) (pg/t:count workflow/SocialCommand {:where {:inbox i-inbox :state "waiting"}})
          o-events (pg/t:select workflow/SocialEvent
                     {:where {:inbox i-inbox} :returning #{:id :status :error :time-created}
                      :order-by [:time-created :id] :order-sort :desc :limit 25})]
      (return (pg/jsonb-build-object "generation" (:-> o-inbox "generation") "mode" (:-> o-inbox "mode")
                "pending" v-pending "uncertain" v-uncertain "failed" v-failed "waiting" v-waiting "events" o-events)))))

(defn.pg record-social-acceptance
  [:uuid i-application :uuid i-inbox :integer i-generation :uuid i-ping :uuid i-help
   :uuid i-nonfollower :uuid i-linked :uuid i-denied :jsonb i-confirmations :jsonb o-op]
  (let [o-inbox (pg/t:get messaging/MessagingAccount {:where {:id i-inbox :application i-application} :for [:update]})
        o-events (pg/jsonb-build-array i-ping i-help i-nonfollower i-linked i-denied)
        o-id nil
        (:integer v-index) 0]
    (when (or [o-inbox :is-null] (not= (:integer (:->> o-inbox "generation")) i-generation)
              (not= i-confirmations (:jsonb "{\"visibleReplies\":true,\"nonFollowerHelp\":true,\"nonFollowerLinkDenied\":true,\"linkUnlinkRelink\":true}")))
      [:raise-exception "Current generation and actual visible acceptance confirmations required"])
    [:for o-id :in :select (pg/jsonb-array-elements o-events)
     (loop []
       (let [(:uuid v-id) (:uuid (:->> (pg/jsonb-build-array o-id) 0))
             o-event (pg/t:get workflow/SocialEvent {:where {:id v-id :inbox i-inbox :generation i-generation}})
             o-command (pg/t:get workflow/SocialCommand {:where {:event v-id :inbox i-inbox}})
             o-reply (pg/t:get delivery/MessagingOutbox {:where {:event v-id :account i-inbox :state "provider_accepted"}})
             (:boolean v-consumed) (pg/t:exists workflow/SocialConnectionProof {:where {:event v-id :status "consumed"}})
             (:boolean v-proof) (pg/t:exists workflow/SocialConnectionProof {:where {:event v-id}})
             (:text v-expected) (pg/case (== v-index 0) "ping" (< v-index 3) "help" true "connect")]
         (when (or [o-event :is-null] [o-command :is-null] [o-reply :is-null]
                   (not= (:->> o-command "command") v-expected))
           [:raise-exception "Acceptance must reference successful current-inbox provider replies"])
         (when (== v-index 3)
           (when (not v-consumed)
             [:raise-exception "Acceptance requires a redeemed connection code"]))
         (when (== v-index 4)
           (when (or (not= (:->> (:-> o-command "result") "error") "account_ineligible")
                     v-proof)
             [:raise-exception "Acceptance requires non-follower linking denial without a code"]))
         (:= v-index (+ v-index 1))))]
    (let [o-first (pg/t:get workflow/SocialEvent {:where {:id i-help}})
          o-second (pg/t:get workflow/SocialEvent {:where {:id i-nonfollower}})]
      (when (== (:->> (:-> o-first "payload") "senderId") (:->> (:-> o-second "payload") "senderId"))
        [:raise-exception "Non-follower help must be a separate sender"]))
    (let [o-saved (pg/t:update messaging/MessagingAccount
                     {:where {:id i-inbox} :set {:checks (|| (:-> o-inbox "checks")
                       (pg/jsonb-build-object "socialAcceptance" (pg/jsonb-build-object
                         "generation" i-generation "events" o-events "confirmedAt" (pg/time-us))))}})]
      (return (pg/jsonb-build-object "accepted" true "generation" i-generation)))))

(defn.pg activate-social-inbox
  [:uuid i-application :uuid i-inbox :integer i-generation :text i-mode :jsonb i-senders]
  (let [o-inbox (pg/t:get messaging/MessagingAccount {:where {:id i-inbox :application i-application} :for [:update]})
        (:integer v-next) (+ i-generation 1)]
    (when (or [o-inbox :is-null] (not= (:integer (:->> o-inbox "generation")) i-generation))
      (return nil))
    (when (== (:->> o-inbox "provider_scope") "tiktok-comments")
      [:raise-exception "Use the separate comment activation and acceptance controls"])
    (when (and (== i-mode "live") (== (:->> o-inbox "mode") "live")
               (== (pg/coalesce (:integer (:->> (:-> (:-> o-inbox "checks") "socialActivation") "generation")) 0) i-generation))
      (return (pg/jsonb-build-object "generation" i-generation "mode" "live")))
    (when (and (== i-mode "live")
               (not= (pg/coalesce (:integer (:->> (:-> (:-> o-inbox "checks") "socialAcceptance") "generation")) 0) i-generation))
      [:raise-exception "Live social acceptance is required before public activation"])
    ;; New audience generations never execute receipts queued before activation.
    ;; Acceptance remains labelled with the generation actually tested.
    (let [o-commands (pg/t:update messaging/MessagingAccount {:where {:id i-inbox}
                       :set {:generation v-next
                             :enabled-commands (:jsonb "[\"help\",\"ping\",\"site\",\"privacy\",\"connect\",\"status\",\"disconnect\"]")
                             :checks (|| (:-> o-inbox "checks")
                               (pg/jsonb-build-object "socialActivation"
                                 (pg/jsonb-build-object "generation" v-next "acceptedGeneration" i-generation
                                   "mode" i-mode "activatedAt" (pg/time-us))))}})]
      (return (authorization/activate-messaging-account i-application i-inbox v-next i-mode i-senders)))))

(defn.pg ret-social-operator-event
  "Scoped operator detail: provider IDs and states, never message bodies or codes."
  [:uuid i-application :uuid i-inbox :uuid i-event]
  (let [o-inbox (pg/t:get messaging/MessagingAccount {:where {:id i-inbox :application i-application}})
        o-event (pg/t:get workflow/SocialEvent {:where {:id i-event :inbox i-inbox}})
        o-command (pg/t:get workflow/SocialCommand {:where {:event i-event :inbox i-inbox}})
        o-reply (pg/t:get delivery/MessagingOutbox {:where {:event i-event :account i-inbox}})]
    (when [o-inbox :is-null] [:raise-exception "Social inbox outside application scope"])
    (when [o-event :is-null] (return nil))
    (return (pg/jsonb-build-object "id" i-event "command" (:-> o-command "command")
      "channel" (:->> o-event "channel") "mediaId" (:-> (:-> o-event "payload") "mediaId")
      "commentId" (pg/case (== (:->> o-event "channel") "message") nil true (:-> (:-> o-event "payload") "messageId"))
      "status" (:-> o-event "status") "senderId" (:-> (:-> o-event "payload") "senderId")
      "delivery" (pg/jsonb-build-object "state" (:-> o-reply "state") "providerMessageId" (:-> o-reply "provider_message_id"))))))


(defn.pg bootstrap-social-inbox
  "Privileged installation only. Creates the approved brand inbox paused."
  [:uuid i-application :uuid i-inbox :uuid i-operator :jsonb o-op]
  (let [o-user (pg/t:get users/User {:where {:id i-operator :deleted false :email-verified true} :for [:share]})
        o-app (pg/t:get messaging/MessagingApplication {:where {:id i-application}})
        o-inbox (pg/t:get messaging/MessagingAccount {:where {:id i-inbox}})]
    (when [o-user :is-null] [:raise-exception "Verified native operator required"])
    (when (and [o-app :is-not-null] (not= (:->> o-app "key") "finfolk-social"))
      [:raise-exception "Conflicting social application"])
    (when (and [o-inbox :is-not-null]
               (or (not= (:uuid (:->> o-inbox "application_id")) i-application)
                   (not= (:->> o-inbox "provider") "instagram")
                   (not= (:->> o-inbox "account_id") "17841461601419539")))
      [:raise-exception "Conflicting brand inbox"])
    (when [o-app :is-null]
      (let [o-new (pg/t:insert messaging/MessagingApplication
                     {:id i-application :key "finfolk-social" :name "FinFolk social messaging"})] nil))
    (when [o-inbox :is-null]
      (let [o-new (pg/t:insert messaging/MessagingAccount
                     {:id i-inbox :key "finfolk-instagram" :application i-application
                      :provider "instagram" :account-id "17841461601419539" :username "finfolk.com.au"
                      :mode "disabled" :enabled-commands (:jsonb "[\"help\",\"ping\"]")})] nil))
    (let [(:uuid v-brand) (social/insert-social-account "instagram"
                           (:text (pg/jsonb-build-array "instagram" i-application i-inbox))
                           "17841461601419539" "finfolk.com.au" "FinFolk" (:jsonb "{}") o-op)
          o-linked (pg/t:update messaging/MessagingAccount {:where {:id i-inbox} :set {:social-account v-brand}})]
      (return (pg/jsonb-build-object "applicationId" i-application "inboxId" i-inbox "operatorId" i-operator)))))

(defn.pg bootstrap-tiktok-inbox
  "Privileged TikTok installation; account ID must come from account-holder authorization."
  [:uuid i-application :uuid i-inbox :uuid i-operator :text i-account :jsonb o-op]
  (let [o-user (pg/t:get users/User {:where {:id i-operator :deleted false :email-verified true} :for [:share]})
        o-app (pg/t:get messaging/MessagingApplication {:where {:id i-application}})
        o-inbox (pg/t:get messaging/MessagingAccount {:where {:id i-inbox}})]
    (when (or [o-user :is-null] (== (pg/coalesce (pg/btrim i-account) "") "") (> (pg/length i-account) 500))
      [:raise-exception "Verified operator and TikTok account identity required"])
    (when (and [o-app :is-not-null] (not= (:->> o-app "key") "finfolk-social"))
      [:raise-exception "Conflicting social application"])
    (when (and [o-inbox :is-not-null]
               (or (not= (:uuid (:->> o-inbox "application_id")) i-application)
                   (not= (:->> o-inbox "provider") "tiktok")
                   (not= (:->> o-inbox "account_id") i-account)))
      [:raise-exception "Conflicting TikTok inbox"])
    (when [o-app :is-null]
      (let [o-new (pg/t:insert messaging/MessagingApplication
                     {:id i-application :key "finfolk-social" :name "FinFolk social messaging"})] nil))
    (when [o-inbox :is-null]
      (let [o-new (pg/t:insert messaging/MessagingAccount
                     {:id i-inbox :key "finfolk-tiktok" :application i-application
                      :provider "tiktok" :account-id i-account
                      :mode "disabled" :enabled-commands (:jsonb "[\"help\",\"ping\"]")})] nil))
    (let [(:uuid v-brand) (social/insert-social-account "tiktok"
                           (:text (pg/jsonb-build-array "tiktok" i-application i-inbox))
                           i-account nil "FinFolk" (:jsonb "{}") o-op)
          o-linked (pg/t:update messaging/MessagingAccount {:where {:id i-inbox} :set {:social-account v-brand}})]
      (return (pg/jsonb-build-object "applicationId" i-application "inboxId" i-inbox "operatorId" i-operator)))))

(defn.pg bootstrap-tiktok-comments
  "Privileged installation of a separate paused Accounts/Mentions inbox."
  [:uuid i-application :uuid i-inbox :uuid i-operator :text i-account :jsonb o-op]
  (let [o-user (pg/t:get users/User {:where {:id i-operator :deleted false :email-verified true} :for [:share]})
        o-app (pg/t:get messaging/MessagingApplication {:where {:id i-application}})
        o-inbox (pg/t:get messaging/MessagingAccount {:where {:id i-inbox}})]
    (when (or [o-user :is-null] (== (pg/coalesce (pg/btrim i-account) "") "") (> (pg/length i-account) 500))
      [:raise-exception "Verified operator and TikTok account required"])
    (when (and [o-app :is-not-null] (not= (:->> o-app "key") "finfolk-tiktok-comments"))
      [:raise-exception "Conflicting comment application"])
    (when (and [o-inbox :is-not-null]
               (or (not= (:uuid (:->> o-inbox "application_id")) i-application)
                   (not= (:->> o-inbox "provider") "tiktok")
                   (not= (:->> o-inbox "provider_scope") "tiktok-comments")
                   (not= (:->> o-inbox "account_id") i-account)))
      [:raise-exception "Conflicting TikTok comments inbox"])
    (when [o-app :is-null]
      (let [o-new (pg/t:insert messaging/MessagingApplication
                     {:id i-application :key "finfolk-tiktok-comments" :name "FinFolk TikTok comments"})] nil))
    (when [o-inbox :is-null]
      (let [o-new (pg/t:insert messaging/MessagingAccount
                     {:id i-inbox :key "finfolk-tiktok-comments" :application i-application
                      :provider "tiktok" :account-id i-account :provider-scope "tiktok-comments"
                      :mode "disabled" :enabled-commands (:jsonb "[\"help\",\"status\",\"site\",\"privacy\"]")})] nil))
    (let [(:uuid v-brand) (social/insert-social-account "tiktok"
                           (:text (pg/jsonb-build-array "tiktok" i-application i-inbox))
                           i-account "finfolk.com.au" "FinFolk" (:jsonb "{}") o-op)
          o-linked (pg/t:update messaging/MessagingAccount {:where {:id i-inbox} :set {:social-account v-brand}})]
      (return (pg/jsonb-build-object "applicationId" i-application "inboxId" i-inbox "operatorId" i-operator)))))

(defn.pg record-social-comment-acceptance
  [:uuid i-application :uuid i-inbox :integer i-generation :uuid i-owned :uuid i-mentioned
   :uuid i-nonfollower :uuid i-private :jsonb i-confirmations :jsonb o-op]
  (let [o-inbox (pg/t:get messaging/MessagingAccount {:where {:id i-inbox :application i-application} :for [:update]})
        o-events (pg/jsonb-build-array i-owned i-mentioned i-nonfollower i-private)
        o-id nil
        (:integer v-index) 0]
    (when (or [o-inbox :is-null] (not= (:->> o-inbox "provider_scope") "tiktok-comments")
              (not= (:integer (:->> o-inbox "generation")) i-generation)
              (not= (:->> o-inbox "mode") "pilot")
              (== i-owned i-mentioned) (== i-owned i-nonfollower) (== i-owned i-private)
              (== i-mentioned i-nonfollower) (== i-mentioned i-private) (== i-nonfollower i-private)
              (not= i-confirmations (:jsonb "{\"visibleReplies\":true,\"ownedAndMention\":true,\"nonFollowerHelp\":true,\"noPrivateData\":true}")))
      [:raise-exception "Actual comment pilot acceptance and distinct current receipts required"])
    [:for o-id :in :select (pg/jsonb-array-elements o-events)
     (loop []
       (let [(:uuid v-id) (:uuid (:->> (pg/jsonb-build-array o-id) 0))
             o-event (pg/t:get workflow/SocialEvent {:where {:id v-id :inbox i-inbox :generation i-generation :channel "mention"}})
             o-command (pg/t:get workflow/SocialCommand {:where {:event v-id :inbox i-inbox :command "help"}})
             o-reply (pg/t:get delivery/MessagingOutbox {:where {:event v-id :account i-inbox :state "provider_accepted"}})
             (:boolean v-proof) (pg/t:exists workflow/SocialConnectionProof {:where {:event v-id}})]
         (when (or [o-event :is-null] [o-command :is-null] [o-reply :is-null] v-proof
                   (and (== v-index 3) (not= (:->> (:-> (:-> o-event "payload") "parsed") "guidance") "use_dm")))
           [:raise-exception "Visible public replies and private-command guidance without a code required"])
         (:= v-index (+ v-index 1))))]
    (let [o-first (pg/t:get workflow/SocialEvent {:where {:id i-owned}})
          o-second (pg/t:get workflow/SocialEvent {:where {:id i-mentioned}})
          o-third (pg/t:get workflow/SocialEvent {:where {:id i-nonfollower}})]
      (when (or (== (:->> (:-> o-first "payload") "mediaId") (:->> (:-> o-second "payload") "mediaId"))
                (== (:->> (:-> o-first "payload") "senderId") (:->> (:-> o-third "payload") "senderId")))
        [:raise-exception "Separate owned/external media and a separate non-follower tester required"]))
    (let [o-saved (pg/t:update messaging/MessagingAccount {:where {:id i-inbox}
                     :set {:checks (|| (:-> o-inbox "checks") (pg/jsonb-build-object "commentAcceptance"
                       (pg/jsonb-build-object "generation" i-generation "events" o-events "confirmedAt" (pg/time-us))))}})]
      (return (pg/jsonb-build-object "accepted" true "generation" i-generation)))))

(defn.pg activate-social-comments
  [:uuid i-application :uuid i-inbox :integer i-generation :text i-mode :jsonb i-senders]
  (let [o-inbox (pg/t:get messaging/MessagingAccount {:where {:id i-inbox :application i-application} :for [:update]})
        (:integer v-next) (+ i-generation 1)]
    (when (or [o-inbox :is-null] (not= (:->> o-inbox "provider_scope") "tiktok-comments")
              (not= (:integer (:->> o-inbox "generation")) i-generation))
      (return nil))
    (when (and (== i-mode "live")
               (not= (pg/coalesce (:integer (:->> (:-> (:-> o-inbox "checks") "commentAcceptance") "generation")) 0) i-generation))
      [:raise-exception "Actual comment acceptance is required before public activation"])
    (let [o-ready (pg/t:update messaging/MessagingAccount {:where {:id i-inbox}
                     :set {:generation v-next :enabled-commands (:jsonb "[\"help\",\"status\",\"site\",\"privacy\"]")
                           :checks (|| (:-> o-inbox "checks") (pg/jsonb-build-object "socialActivation"
                             (pg/jsonb-build-object "generation" v-next "mode" i-mode "activatedAt" (pg/time-us))))}})]
      (return (authorization/activate-messaging-account i-application i-inbox v-next i-mode i-senders)))))
