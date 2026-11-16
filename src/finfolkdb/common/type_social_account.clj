(ns finfolkdb.common.type-social-account
  "Provider-scoped account identity and independently revocable member authorization."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-system-base :as system]
            [finfolkdb.common.type-domain-enum :as domain]
            [finfolkdb.common.type-user :as user]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-base :as system]
             [finfolkdb.common.type-domain-enum :as domain]
             [finfolkdb.common.type-user :as user]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

(deftype.pg ^{:final true
              :! (et/E {:class  :0d/entry
                        :access :access/system
                        :addons [:audit]})}
  SocialAccount
  "Stable external identity. A mutable handle is never the account key."
  [:provider      {:type :enum :required true
                   :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialProvider}
                   :sql {:unique ["provider_identity"]}}
   :namespace     {:type :text :required true
                   :sql {:unique ["provider_identity"]}}
   :external-id   {:type :text :required true
                   :sql {:unique ["provider_identity"]}}
   :handle        {:type :text :required true
                   :sql {:default ""}}
   :display-name  {:type :text :required true
                   :sql {:default ""}}
   :generation    {:type :integer :required true
                   :sql {:default 1}}
   :provider-data {:type :jsonb :required true
                   :sql {:default "{}"}}]
  {:constraints {:nonempty-namespace (> (pg/length (pg/btrim #{"namespace"})) 0)
                 :nonempty-external-id (> (pg/length (pg/btrim #{"external_id"})) 0)
                 :positive-generation (> #{"generation"} 0)
                 :object-provider-data (== (pg/jsonb-typeof #{"provider_data"}) "object")}})

(deftype.pg ^{:finfolk/legacy-tables ["instagram_connections" "tiktok_connections"]
              :final true
              :! (et/E {:class   :0d/entry
                        :access  :access/system
                        :addons  [:audit]
                        :columns {:id {:sql {:unique ["connection_owner"]}}}})}
  SocialConnection
  "Member authorization and consent. Revoked connections retain history without credentials."
  [:user                  {:type :ref :required true
                           :ref {:ns finfolkdb.common.type-user/User}
                           :sql {:cascade true :index true :unique ["connection_owner"]}}
   :account               {:type :ref :required true
                           :ref {:ns -/SocialAccount} :sql {:index true}}
   :status                {:type :enum :required true
                           :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialConnectionStatus}
                           :sql {:default "pending"}}
   :identity-version      {:type :uuid :required true
                           :sql {:default (pg/gen-random-uuid)}}
   :generation            {:type :integer :required true
                           :sql {:default 1}}
   :credential-ciphertext {:type :text}
   :access-expires-at     {:type :long}
   :refresh-expires-at    {:type :long}
   :credential-lease      {:type :uuid}
   :lease-until           {:type :long}
   :share-posts           {:type :boolean :required true
                           :sql {:default false}}
   :public-points         {:type :boolean :required true
                           :sql {:default false}}
   :capabilities          {:type :jsonb :required true
                           :sql {:default "[]"}}
   :granted-scopes        {:type :jsonb :required true
                           :sql {:default "[]"}}
   :cursor                {:type :text}
   :last-success          {:type :long}
   :next-at               {:type :long :required true
                           :sql {:default (pg/time-us)}}
   :failures              {:type :integer :required true
                           :sql {:default 0}}
   :provider-data         {:type :jsonb :required true
                           :sql {:default "{}"}}]
  {:constraints {:positive-generation (> #{"generation"} 0)
                 :nonnegative-failures (>= #{"failures"} 0)
                 :array-capabilities (== (pg/jsonb-typeof #{"capabilities"}) "array")
                 :array-scopes (== (pg/jsonb-typeof #{"granted_scopes"}) "array")
                 :object-provider-data (== (pg/jsonb-typeof #{"provider_data"}) "object")
                 :paired-lease
                 (or (and [#{"credential_lease"} :is-null] [#{"lease_until"} :is-null])
                     (and [#{"credential_lease"} :is-not-null] [#{"lease_until"} :is-not-null]))
                 :revoked-private (or (not= #{"status"} "revoked")
                                      (and [#{"credential_ciphertext"} :is-null]
                                           [#{"credential_lease"} :is-null]
                                           (not #{"share_posts"})
                                           (not #{"public_points"})))}})

(defrun.pg __social_connection_indexes__
  [:create-unique-index :if-not-exists #{"SocialConnectionCurrentAccount"} :on -/SocialConnection
   (>-< [#{"account_id"}]) :where (not= #{"status"} "revoked")])
