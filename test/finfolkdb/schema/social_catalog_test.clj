(ns finfolkdb.schema.social-catalog-test
  (:use code.test)
  (:require [clojure.string :as str]
            [finfolkdb.schema.entity-catalog :as catalog]
            [finfolkdb.schema.entity-coverage :as coverage]
            [finfolkdb.schema.rpc-catalog :as rpc]
            [finfolkdb.schema.social :as grants]))

(defn fields [tables table] (into {} (map (juxt :name identity) (get-in tables [table :columns]))))

(fact "shared social entities replace every native provider-specific table"
  (let [tables (catalog/declarations)]
    [(every? #(contains? tables %) grants/TABLES)
     (not-any? #(re-find #"^(Instagram|Tiktok)" %) (keys tables))
     (every? #(= "uuid" (get-in (fields tables %) ["id" :type])) grants/TABLES)
     (every? #(= "time" (get-in (fields tables %) ["time-created" :type])) grants/TABLES)])
  =>
  [true true true true])

(fact "account identity is provider-scoped and independent of member authorization"
  (let [tables (catalog/declarations)
        account (fields tables "SocialAccount")
        connection (fields tables "SocialConnection")]
    [(mapv #(get-in account [% :spec :sql :unique]) ["provider" "namespace" "external-id"])
     (contains? account "credential-ciphertext") (get-in connection ["account" :reference :table])
     (get-in connection ["user" :reference :table])
     (get-in connection ["share-posts" :spec :sql :default])
     (get-in connection ["public-points" :spec :sql :default])])
  =>
  [[["provider_identity"] ["provider_identity"] ["provider_identity"]] false "SocialAccount" "User"
   false false])

(fact "proofs bind accounts, members and consumed connection versions"
  (let [tables (catalog/declarations)
        proof (fields tables "SocialConnectionProof")]
    [(mapv #(get-in proof [% :reference :table]) ["account" "user" "connection" "receipt"])
     (get-in proof ["expires-at" :type]) (get-in proof ["consumed-version" :type])
     (every? #(contains? (get-in tables ["SocialConnectionProof" :constraints]) %)
             [:hashed-token :consumed-bound :verified-evidence :oauth-binding])])
  =>
  [["SocialAccount" "User" "SocialConnection" "MessagingReceipt"] "long" "uuid" true])

(fact "discoveries remain separate from private imports and consented public posts"
  (let [tables (catalog/declarations)
        discovery (fields tables "SocialDiscovery")]
    [(get-in discovery ["account" :reference :table]) (get-in discovery ["post" :reference :table])
     (contains? (get-in tables ["SocialDiscovery" :constraints]) :published-post)
     (get-in (fields tables "MediaImport") ["session" :reference :table])
     (get-in (fields tables "MediaImport") ["connection" :spec :foreign :connection-owner :column])
     (get-in (fields tables "UserPointsEntry") ["action" :reference :table])
     (get-in (fields tables "MessagingAccount") ["social-account" :reference :table])])
  =>
  ["SocialAccount" "SocialPost" true "DiveSession" :id "SocialAction" "SocialAccount"])

(fact "shared auditing replaces duplicated provider audit tables"
  (let [tables (catalog/declarations)
        mappings (:mappings (coverage/current))]
    [(mapv #(get mappings %) ["instagram_connections" "tiktok_connections"])
     (mapv #(get mappings %)
           ["instagram_claims" "instagram_comment_identities" "instagram_connect_codes"])
     (mapv #(get mappings %) ["instagram_audit" "instagram_discovery_audit"])
     (get-in (fields tables "SocialAction") ["audit" :reference :table])])
  =>
  [["SocialConnection" "SocialConnection"]
   ["SocialConnectionProof" "SocialConnectionProof" "SocialConnectionProof"] ["AuditLog" "AuditLog"]
   "Audit"])

(fact "native social RPCs use UUID relationships and preserve callback binding"
  (let [functions (rpc/declarations)
        args (get-in functions ["connect_social_account" :arguments])]
    [(mapv :type (take 2 args)) (mapv :name (take 3 (drop 2 args)))
     (get-in functions ["publish_social_discovery" :arguments 0 :type])
     (not (str/includes? (grants/grants-sql) "GRANT finfolk_social TO finfolk_api"))])
  =>
  [["uuid" "uuid"] ["i-token-hash" "i-nonce-hash" "i-flow-key"] "uuid" true])
