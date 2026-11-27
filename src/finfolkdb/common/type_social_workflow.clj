(ns finfolkdb.common.type-social-workflow
  "Shared proof, collection, discovery, action and provider-event workflows."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-system-base :as system]
            [finfolkdb.common.type-system-seed :as seed]
            [finfolkdb.common.type-domain-enum :as domain]
            [finfolkdb.common.type-social-account :as social]
            [finfolkdb.common.type-messaging-base :as messaging]
            [finfolkdb.common.type-logbook-base :as logbook]
            [finfolkdb.common.type-social-post :as post]
            [finfolkdb.common.type-system-site :as site]
            [finfolkdb.common.type-user :as user]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-base :as system]
             [finfolkdb.common.type-system-seed :as seed]
             [finfolkdb.common.type-domain-enum :as domain]
             [finfolkdb.common.type-social-account :as social]
             [finfolkdb.common.type-messaging-base :as messaging]
             [finfolkdb.common.type-logbook-base :as logbook]
             [finfolkdb.common.type-social-post :as post]
             [finfolkdb.common.type-system-site :as site]
             [finfolkdb.common.type-user :as user]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

(deftype.pg ^{:finfolk/legacy-tables ["instagram_events"]
              :final true
              :! (et/E {:class   :0d/entry
                        :access  :access/system
                        :columns {:id {:sql {:unique ["inbox_scope" "account_scope"]}}}})}
  SocialEvent
  [:provider           {:type :enum :required true
                        :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialProvider}
                        :sql {:unique ["event_key"]}}
   :namespace          {:type :text :required true
                        :sql {:unique ["event_key"]}}
   :key                {:type :text :required true
                        :sql {:unique ["event_key"]}}
   :account            {:type :ref
                        :ref {:ns finfolkdb.common.type-social-account/SocialAccount}
                        :sql {:unique ["account_scope"]}}
   :inbox              {:type :ref
                        :ref {:ns finfolkdb.common.type-messaging-base/MessagingAccount}
                        :sql {:index true :unique ["inbox_scope"]}}
   :message            {:type :ref
                        :ref {:ns finfolkdb.common.type-messaging-base/MessagingMessage}}
   :channel            {:type :enum :required true
                        :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialCommandContext}
                        :sql {:default "message"}}
   :generation         {:type :integer :required true
                        :sql {:default 1}}
   :account-generation {:type :integer :required true
                        :sql {:default 1}}
   :content-cleared    {:type :boolean :required true :sql {:default false}}
   :fingerprint        {:type :text}
   :sent-at            {:type :long}
   :deadline           {:type :long}
   :payload            {:type :jsonb :required true}
   :status             {:type :text :required true
                        :sql {:default "queued"}}
   :attempts           {:type :integer :required true
                        :sql {:default 0}}
   :error              {:type :text}]
  {:constraints {:nonnegative-attempts (>= #{"attempts"} 0)}})

(deftype.pg ^{:finfolk/legacy-tables ["instagram_claims" "instagram_comment_identities"
                                      "instagram_connect_codes"]
              :final true
              :! (et/E {:class  :0d/entry
                        :access :access/system})}
  SocialConnectionProof
  "Hashed, expiring evidence bound to an account generation and optional member."
  [:account          {:type :ref :required true
                      :ref {:ns finfolkdb.common.type-social-account/SocialAccount}
                      :foreign {:event-account {:ns -/SocialEvent :column :account-id}}
                      :sql {:index true}}
   :user             {:type :ref
                      :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true}}
   :connection       {:type :ref
                      :ref {:ns finfolkdb.common.type-social-account/SocialConnection}}
   :event            {:type :ref
                      :ref {:ns -/SocialEvent}
                      :foreign {:event-account {:ns -/SocialEvent :column :id}
                                :event-inbox {:ns -/SocialEvent :column :id}}}
   :inbox            {:type :ref
                      :ref {:ns finfolkdb.common.type-messaging-base/MessagingAccount}
                      :foreign {:event-inbox {:ns -/SocialEvent :column :inbox-id}}
                      :sql {:index true}}
   :receipt          {:type :ref
                      :ref {:ns finfolkdb.common.type-messaging-base/MessagingReceipt}}
   :kind             {:type :enum :required true
                      :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialProofKind}}
   :token-hash       {:type :text :required true
                      :sql {:unique ["token"]}}
   :nonce-hash       {:type :text}
   :flow-key         {:type :text}
   :generation       {:type :integer :required true}
   :status           {:type :enum :required true
                      :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialProofStatus}
                      :sql {:default "pending"}}
   :expires-at       {:type :long :required true}
   :verified-at      {:type :long}
   :consumed-at      {:type :long}
   :consumed-version {:type :uuid}
   :error            {:type :text :required true
                      :sql {:default ""}}
   :provider-data    {:type :jsonb :required true
                      :sql {:default "{}"}}]
  {:constraints {:hashed-token (#{"regexp_like"} #{"token_hash"} "^[a-f0-9]{64}$")
                 :positive-generation (> #{"generation"} 0)
                 :oauth-binding (or (not= #{"kind"} "oauth")
                                    (and [#{"nonce_hash"} :is-not-null]
                                         [#{"flow_key"} :is-not-null]
                                         (#{"regexp_like"} #{"nonce_hash"} "^[a-f0-9]{64}$")
                                         (#{"regexp_like"} #{"flow_key"} "^[a-f0-9]{64}$")))
                 :consumed-bound (or (not= #{"status"} "consumed")
                                     (and [#{"user_id"} :is-not-null]
                                          [#{"connection_id"} :is-not-null]
                                          [#{"consumed_at"} :is-not-null]
                                          [#{"consumed_version"} :is-not-null]))
                 :verified-evidence (or (and (not= #{"status"} "verified")
                                             (not= #{"status"} "consumed"))
                                        [#{"verified_at"} :is-not-null])
                 :object-provider-data (== (pg/jsonb-typeof #{"provider_data"}) "object")}})

(deftype.pg ^{:finfolk/legacy-tables ["instagram_sources"]
              :final true
              :! (et/E {:class  :0d/entry
                        :access :access/system})}
  SocialSource
  [:provider      {:type :enum :required true
                   :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialProvider}
                   :sql {:unique ["source_key"]}}
   :namespace     {:type :text :required true
                   :sql {:unique ["source_key"]}}
   :key           {:type :text :required true
                   :sql {:unique ["source_key"]}}
   :account       {:type :ref
                   :ref {:ns finfolkdb.common.type-social-account/SocialAccount}}
   :kind          {:type :enum :required true
                   :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialSourceKind}}
   :configuration {:type :jsonb :required true
                   :sql {:default "{}"}}
   :checkpoint    {:type :text}
   :last-success  {:type :long}
   :next-at       {:type :long :required true
                   :sql {:default (pg/time-us)}}
   :lease         {:type :uuid}
   :lease-until   {:type :long}
   :failures      {:type :integer :required true
                   :sql {:default 0}}
   :status        {:type :enum :required true
                   :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialSourceStatus}
                   :sql {:default "ready"}}]
  {:constraints {:object-configuration (== (pg/jsonb-typeof #{"configuration"}) "object")
                 :nonnegative-failures (>= #{"failures"} 0)
                 :paired-lease (or (and [#{"lease"} :is-null] [#{"lease_until"} :is-null])
                                   (and [#{"lease"} :is-not-null]
                                        [#{"lease_until"} :is-not-null]))}})

(deftype.pg ^{:finfolk/legacy-tables ["instagram_suppressed_sources"]
              :final true
              :! (et/E {:class  :0d/entry
                        :access :access/system})}
  SocialSuppressedSource
  [:provider           {:type :enum :required true
                        :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialProvider}
                        :sql {:unique ["author"]}}
   :namespace          {:type :text :required true
                        :sql {:unique ["author"]}}
   :external-author-id {:type :text :required true
                        :sql {:unique ["author"]}}
   :reason             {:type :text :required true
                        :sql {:default ""}}])

(deftype.pg ^{:finfolk/legacy-tables ["instagram_discoveries"]
              :final true
              :! (et/E {:class  :0d/entry
                        :access :access/system
                        :addons [:audit]})}
  SocialDiscovery
  [:account       {:type :ref :required true
                   :ref {:ns finfolkdb.common.type-social-account/SocialAccount}
                   :sql {:unique ["provider_media"]}}
   :source        {:type :ref
                   :ref {:ns -/SocialSource}}
   :external-id   {:type :text :required true
                   :sql {:unique ["provider_media"]}}
   :url           {:type :text :required true}
   :owner         {:type :ref
                   :ref {:ns finfolkdb.common.type-user/User} :sql {:raw [:on-delete-set-null]}}
   :site          {:type :ref
                   :ref {:ns finfolkdb.common.type-system-site/Site}}
   :post          {:type :ref
                   :ref {:ns finfolkdb.common.type-social-post/SocialPost}}
   :candidates    {:type :jsonb :required true
                   :sql {:default "[]"}}
   :caption       {:type :text :required true
                   :sql {:default ""}}
   :posted-at     {:type :long}
   :state         {:type :enum :required true
                   :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialDiscoveryStatus}
                   :sql {:default "pending"}}
   :automatic     {:type :boolean :required true
                   :sql {:default false}}
   :sources       {:type :jsonb :required true
                   :sql {:default "[]"}}
   :checked-at    {:type :long}
   :provider-data {:type :jsonb :required true
                   :sql {:default "{}"}}]
  {:constraints {:array-candidates (== (pg/jsonb-typeof #{"candidates"}) "array")
                 :array-sources (== (pg/jsonb-typeof #{"sources"}) "array")
                 :object-provider-data (== (pg/jsonb-typeof #{"provider_data"}) "object")
                 :published-post (or (not= #{"state"} "published") [#{"post_id"} :is-not-null])}})

(deftype.pg ^{:finfolk/legacy-tables ["instagram_post_reports"]
              :final true
              :! (et/E {:class  :0d/entry
                        :access :access/system})}
  SocialDiscoveryReport
  [:discovery {:type :ref :required true
               :ref {:ns -/SocialDiscovery} :sql {:cascade true :unique ["reason_day"]}}
   :reason    {:type :enum :required true
               :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialDiscoveryReportReason}
               :sql {:unique ["reason_day"]}}
   :day       {:type :date :required true
               :sql {:unique ["reason_day"] :default (:date (pg/now))}}])

(deftype.pg ^{:finfolk/legacy-tables ["instagram_commands"]
              :final true
              :! (et/E {:class   :0d/entry
                        :access  :access/system
                        :columns {:id {:sql {:unique ["inbox_scope" "event_scope"
                                                      "account_scope"]}}}})}
  SocialCommand
  [:event             {:type :ref
                       :ref {:ns -/SocialEvent}
                       :foreign {:source-inbox {:ns -/SocialEvent :column :id}
                                 :source-account {:ns -/SocialEvent :column :id}}
                       :sql {:unique ["event" "event_scope"]}}
   :inbox             {:type :ref
                       :ref {:ns finfolkdb.common.type-messaging-base/MessagingAccount}
                       :foreign {:source-inbox {:ns -/SocialEvent :column :inbox-id}}
                       :sql {:unique ["inbox_scope"]}}
   :generation        {:type :integer :required true
                       :sql {:default 1}}
   :account           {:type :ref :required true
                       :ref {:ns finfolkdb.common.type-social-account/SocialAccount}
                       :foreign {:source-account {:ns -/SocialEvent :column :account-id}}
                       :sql {:unique ["command_key" "account_scope"]}}
   :key               {:type :text :required true
                       :sql {:unique ["command_key"]}}
   :context           {:type :enum :required true
                       :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialCommandContext}}
   :external-actor-id {:type :text :required true}
   :external-media-id {:type :text}
   :owner             {:type :ref
                       :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true}}
   :connection        {:type :ref
                       :ref {:ns finfolkdb.common.type-social-account/SocialConnection}}
   :identity-version  {:type :uuid}
   :command           {:type :text :required true}
   :args              {:type :jsonb :required true
                       :sql {:default "{}"}}
   :source-url        {:type :text}
   :comment-at        {:type :long}
   :received-at       {:type :long :required true
                       :sql {:default (pg/time-us)}}
   :state             {:type :enum :required true
                       :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialCommandStatus}
                       :sql {:default "new"}}
   :result            {:type :jsonb :required true
                       :sql {:default "{}"}}
   :site              {:type :ref
                       :ref {:ns finfolkdb.common.type-system-site/Site}}
   :visit-day         {:type :date}
   :reply             {:type :text}
   :send-state        {:type :enum :required true
                       :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialCommandSendState}
                       :sql {:default "pending"}}
   :external-reply-id {:type :text}
   :send-started-at   {:type :long}]
  {:constraints {:object-args (== (pg/jsonb-typeof #{"args"}) "object")}})

(deftype.pg ^{:finfolk/legacy-tables ["instagram_actions"]
              :final true
              :! (et/E {:class  :0d/entry
                        :access :access/system
                        :addons [:audit]})}
  SocialAction
  [:event              {:type :ref
                        :ref {:ns -/SocialEvent}
                        :foreign {:command-event {:ns -/SocialCommand :column :event-id}}}
   :command            {:type :ref
                        :ref {:ns -/SocialCommand}
                        :foreign {:command-event {:ns -/SocialCommand :column :id}
                                  :command-inbox {:ns -/SocialCommand :column :id}
                                  :command-account {:ns -/SocialCommand :column :id}}}
   :inbox              {:type :ref
                        :ref {:ns finfolkdb.common.type-messaging-base/MessagingAccount}
                        :foreign {:command-inbox {:ns -/SocialCommand :column :inbox-id}}
                        :sql {:index true}}
   :generation         {:type :integer :required true
                        :sql {:default 1}}
   :account-generation {:type :integer :required true
                        :sql {:default 1}}
   :attempts           {:type :integer :required true
                        :sql {:default 0
                              :process [[finfolkdb.common.type-system-seed/as-bounded-integer 0
                                         2147483647]]
                              :constraint (== #{"attempts"}
                                              (finfolkdb.common.type-system-seed/as-bounded-integer
                                               #{"attempts"}
                                               0
                                               2147483647))}}
   :lease              {:type :uuid}
   :lease-until        {:type :long}
   :deadline           {:type :long}
   :next-attempt-at    {:type :long :required true
                        :sql {:default (pg/time-us)}}
   :error-code         {:type :text}
   :result             {:type :jsonb :required true
                        :sql {:default "{}"
                              :process [[finfolkdb.common.type-system-seed/as-jsonb]]
                              :constraint (== #{"result"}
                                              (finfolkdb.common.type-system-seed/as-jsonb
                                               #{"result"}))}}
   :account            {:type :ref :required true
                        :ref {:ns finfolkdb.common.type-social-account/SocialAccount}
                        :foreign {:command-account {:ns -/SocialCommand :column :account-id}}
                        :sql {:unique ["source_kind"]}}
   :source-id          {:type :text :required true
                        :sql {:unique ["source_kind"]}}
   :kind               {:type :enum :required true
                        :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialActionKind}
                        :sql {:unique ["source_kind"]}}
   :owner              {:type :ref
                        :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true}}
   :state              {:type :text :required true
                        :sql {:default "review"}}
   :data               {:type :jsonb :required true
                        :sql {:default "{}"
                              :process [[finfolkdb.common.type-system-seed/as-jsonb]]
                              :constraint (== #{"data"}
                                              (finfolkdb.common.type-system-seed/as-jsonb
                                               #{"data"}))}}
   :member-confirmed   {:type :boolean :required true
                        :sql {:default false}}
   :session            {:type :ref
                        :ref {:ns finfolkdb.common.type-logbook-base/DiveSession}}]
  {:constraints {:paired-lease (or (and [#{"lease"} :is-null] [#{"lease_until"} :is-null])
                                   (and [#{"lease"} :is-not-null] [#{"lease_until"} :is-not-null]))
                 :running-lease (or (and (== #{"state"} "running") [#{"lease"} :is-not-null])
                                    (and (not= #{"state"} "running") [#{"lease"} :is-null]))}})

(defrun.pg __action_indexes__
  [:create-index :if-not-exists #{"SocialAction_ready"} :on -/SocialAction
   (>-< [#{"inbox_id"} #{"state"} #{"next_attempt_at"}])])

(deftype.pg ^{:finfolk/legacy-tables ["instagram_dm_limits" "instagram_connect_limits"]
              :final true
              :! (et/E {:class  :0d/entry
                        :access :access/system})}
  SocialRateLimit
  [:provider    {:type :enum :required true
                 :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialProvider}
                 :sql {:unique ["bucket"]}}
   :namespace   {:type :text :required true
                 :sql {:unique ["bucket"]}}
   :purpose     {:type :text :required true
                 :sql {:unique ["bucket"]}}
   :bucket      {:type :text :required true
                 :sql {:unique ["bucket"]}}
   :count       {:type :integer :required true
                 :sql {:default 0}}
   :resets-at   {:type :long :required true}
   :prompted-at {:type :long}]
  {:constraints {:nonnegative-count (>= #{"count"} 0)}})
