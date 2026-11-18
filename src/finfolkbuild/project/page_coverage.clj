(ns finfolkbuild.project.page-coverage
  "Exhaustive migration inventory. Coverage is declared, never inferred from a successful load."
  (:require [finfolk-web.pages.registry :as registry]
            [finfolk-web.lib.operations :as operations]
            [clojure.set :as set]))

(def GROUPS
  (array-map
   :account #{"account-config-resource" "account" "account-identity" "account-settings" "account-privacy"}
   :community #{"people" "profile" "profile-editor" "member-chooser" "account-checkin" "place-community"}
   :logbook #{"logbook" "logbook-editor" "logbook-list" "logbook-extras"}
   :directory #{"directory" "listing" "pages" "page-owner" "page-invitation" "directory-review"}
   :events #{"events" "event-public" "event" "event-editor" "my-events" "event-invitation"}
   :atlas #{"atlas" "map" "discover" "community-catalog" "site-notes" "site-submissions" "site-review"}
   :content #{"post-manager" "post-review" "trip-manager" "trip-report" "trip-review" "public-report" "place-feed" "place-trips" "place-public" "place-media"}
   :social #{"instagram-link" "instagram-discovery" "instagram-tools" "instagram-commands" "account-integration" "messaging-settings" "logbook-inbox"}
   :finnies #{"finnies-shop" "finnies-admin"}
   :shell #{"home" "community-hub" "practice-hub" "you-hub" "profiles-compatibility" "legacy-app" "location-resource" "offline-templates" "account-review"}))

(def CAPABILITY-KINDS ["models" "actions" "auth-actions" "sdk-actions" "resources" "adapters" "effects"])
(defn group-for [id] (first (for [[group pages] GROUPS :when (contains? pages id)] group)))
(defn capabilities [page]
  (vec (concat
    (for [kind CAPABILITY-KINDS
          id (let [value (get page kind)] (if (map? value) (keys value) value))]
      {:kind kind :member id :operation (get-in page [kind id "operation"])})
    (when (get page "loader") [{:kind "loader" :member (get page "loader")}])
    (when (get page "adapter") [{:kind "lifecycle" :member "adapter"}])
    (for [id (get page "uses")] {:kind "composition" :member id})
    ;; A static screen is still required to have browser verification.
    [{:kind (case (get page "kind") "resource" "http" "internal" "artifact" "browser") :member "screen"}])))
(defn inventory []
  (let [pages (registry/validate!)
        assigned (mapcat val GROUPS)
        unknown (set/difference (set assigned) (set (keys pages)))
        missing (set/difference (set (keys pages)) (set assigned))]
    (when (or (seq unknown) (seq missing) (not= (count assigned) (count (set assigned))))
      (throw (ex-info "Page migration inventory is not exhaustive" {:unknown unknown :missing missing})))
    (mapv (fn [[id page]]
      {:id id :group (group-for id) :routes (get page "routes")
       :kind (get page "kind" "screen") :capabilities (capabilities page)}) (sort-by key pages))))
(defn contracts []
  (vec (for [{:keys [id capabilities]} (inventory) c capabilities :when (:operation c)]
    (let [spec (get operations/DEFINITIONS (:operation c))]
      (assoc c :page id :transport (get spec "transport")
             :request-shape (get spec "request-shape") :result-shape (get spec "result-shape")
             :native-rpc (get spec "native-rpc")
             :status (if (and (get spec "native-rpc") (get spec "request-shape") (get spec "result-shape")) :declared :blocked))))))
(defn page-status [id]
  (let [page (first (filter #(= id (:id %)) (inventory)))
        entries (filter #(= id (:page %)) (contracts))]
    {:group (:group page) :status :unverified
     :required (count (:capabilities page))
     :native-contracts (count (filter #(= :declared (:status %)) entries))
     :missing-contracts (count (filter #(= :blocked (:status %)) entries))
     :pending-operations (vec (sort (set (map :operation (filter #(= :blocked (:status %)) entries)))))
     :blocker "Native contracts, authenticated fixtures and browser evidence are required before migration"}))
(defn report [] {:groups (vec (keys GROUPS)) :pages (inventory) :contracts (contracts)})
(defn -main [& _] (prn (report)) (shutdown-agents))
