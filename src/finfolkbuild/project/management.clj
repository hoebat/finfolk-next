(ns finfolkbuild.project.management
  "Whole-project management over FinFolk's existing publication and build tools."
  (:require [app.manage :as manage]
            [finfolkbuild.project.feature-flags :as feature-flags]
            [app.manage.manifest :as manifest]
            [app.manage.make :as make]
            [app.manage.integration :as integration]
            [app.manage.verify :as verify]
            [finfolkbuild.project.page-coverage :as coverage]
            [finfolk-web.pages.registry :as registry]
            [finfolk-web.lib.operations :as operations]
            [app.manage.process :as process]
            [clojure.data.json :as json]
            [clojure.java.io :as io]
            [clojure.string :as str]
            [finfolk-web.pages.routes :as routes]
            [finfolkbuild.project.application :as application]
            [finfolkbuild.project.preview :as preview]))

(def SITE "js/finfolk-next/site/web-main")
(def PREVIEW-ORIGIN (preview/origin))
(def NATIVE-PREVIEW-ORIGIN (str "http://127.0.0.1:" (or (System/getenv "NATIVE_PREVIEW_PORT") "3011")))

(defn publication-artifacts
  "Adapts the existing publisher through a temporary output tree. The project is untouched."
  [{:keys [results]}]
  (let [root (.toFile (java.nio.file.Files/createTempDirectory
                      "finfolk-publication-" (make-array java.nio.file.attribute.FileAttribute 0)))]
    (try
      ((requiring-resolve 'finfolkbuild.project.main/generate!) (.getCanonicalPath root))
      (let [files (json/read-str (slurp (io/file root "resources/generated-files.json")))
            database-files (set (mapcat #(keys (get results %)) [:database-sql :database-json]))]
        (into (sorted-map)
              (for [path files :when (not (database-files path))]
                [path (slurp (manage/project-file {:root (str root)} path))])))
      (finally
        (doseq [file (reverse (file-seq root))] (.delete file))))))

(defn frontend-build!
  "Runs the Next portion of build-netlify after the site-assets check."
  [{:keys [root]}]
  (let [prepared (process/run {:root root :command ["node" "scripts/prepare_nextjs.mjs"] :timeout-ms 300000})]
    (if (= :error (:status prepared)) prepared
        (process/run {:root root :command ["corepack" "yarn" "workspace" "@finfolk/web-main" "build"]
                      :timeout-ms 900000}))))

(def PREVIEW-ROUTES
  [[:home "Home" "/"]
   [:map "Map & explore" "/map"]
   [:discover "Discover" "/discover"]
   [:directory "Directory" "/directory"]
   [:events "Events" "/events"]
   [:community "Community" "/community"]
   [:people "People" "/people"]
   [:profile "Profile" "/profile"]
   [:logbook "Logbook" "/logbook"]
   [:account "Account" "/account"]
   [:posts "Posts & trips" "/account/posts"]
   [:instagram "Instagram" "/account/instagram"]
   [:site-review "Site review" "/account/sites"]
   [:moderation "Review & moderation" "/account/review"]
   [:settings "Settings" "/account/settings"]
   [:pages "Pages" "/pages"]
   [:shop "Shop" "/shop"]
   [:shop-manage "Shop management" "/shop/manage"]])

(def ALL-PREVIEW-ROUTES
  (let [known (set (map last PREVIEW-ROUTES))]
    (into PREVIEW-ROUTES
          (for [[path spec] (get (routes/publication (str SITE "/app")) "routes")
                :when (and (= "page" (get spec "type")) (= "screen" (get spec "kind"))
                           (not (re-find #"\[" path)) (not (known path)))]
            [(keyword (str/replace (subs path 1) "/" "-"))
             (str/join " · " (map str/capitalize (str/split (subs path 1) #"/"))) path]))))

(def PREVIEW-GROUPS
  (mapv (fn [[id label]] {:id id :label label})
        [[:home "Home"] [:explore "Explore"] [:community "Community"]
         [:events "Events"] [:practice "Practice"] [:you "You"] [:administration "Administration"]]))

(defn preview-group [url]
  (let [path (.getPath (java.net.URI. url))]
    (cond
      (re-find #"^/(account/review|pages/review|shop/manage)(/|$)" path) :administration
      (= path "/") :home
      (re-find #"^/(map|discover)(/|$)" path) :explore
      (re-find #"^/events(/|$)" path) :events
      (re-find #"^/(practice|logbook)(/|$)" path) :practice
      (re-find #"^/(you|profile|account)(/|$)" path) :you
      (re-find #"^/(community|people|members|profiles|directory|pages|shop)(/|$)" path) :community
      :else nil)))

(defn page-index []
  (mapv (fn [[id page]]
          {:id id :migration (coverage/page-status id) :routes (get page "routes") :area (get page "area") :kind (get page "kind" "screen")
           :models (into {} (for [[name model] (get page "models")]
                              [name (assoc model "operation-spec" (get operations/DEFINITIONS (get model "operation")))]))
           :actions (into {} (for [[name action] (get page "actions")]
                               [name (assoc action "operation-spec" (get operations/DEFINITIONS (get action "operation")))]))
           :auth-actions (get page "auth-actions") :sdk-actions (get page "sdk-actions")
           :order (get page "order")
           :target "publication" :runtime "Verification support is reported by the workbench; application migration pending"})
        (sort-by key (registry/validate!))))

(defn application-pages [] (registry/validate!))
(defn application-operations [] operations/DEFINITIONS)

(defn native-content-slice [label description pending]
  {:label label :description description
   :stages (into
            [{:id :schema :label "Native database schema" :targets [:database-sql]}
             {:id :logic :label "Ownership, lifecycle and concurrency rules" :targets [:native-account] :checks [:native-account :generated-parity]}
             {:id :rpc :label "Strict native request/result contracts" :targets [:native-account] :checks [:native-account :generated-parity]}
             {:id :interop :label "Verified identity and restricted database transport" :targets [:native-account] :checks [:native-account :generated-parity]}
             {:id :backbone :label "Generated Substrate page/models" :targets [:publication :native-account] :checks [:native-account :generated-parity]}
             {:id :types :label "RPC-generated UI types" :targets [:native-account] :checks [:native-account :generated-parity]}
             {:id :ui :label "Existing Next screens in Chromium" :targets [:native-account] :checks [:native-account :generated-parity]}
             {:id :page-models :label "Saved native page/model scenarios" :targets [:page-verifier] :checks [:page-model-verification :generated-parity]}]
            pending)})

(def PROJECT
  (manifest/with-workbench
  {:id 'finfolk
   :label "FinFolk"
   :root "."
   :project-panels [feature-flags/PANEL]
   :workbench-ui :legacy
   :agent-kit {:config "config/agent-kit.json"}
   :http-api {:enabled true
              :operations ["build" "check" "analyse" "verify-definitions" "verify-page" "run-page-cases"]
              :actions {:page-health {:operation "build" :slice "page-health" :stage "browser" :tests true}}
              :artifacts {:page-health-report {:path ".cache/page-health/latest.json" :content-type "application/json"}
                          :page-health-screenshots {:directory ".cache/page-health" :filename-pattern "failure-[0-9]+[.]png"
                                                    :content-type "image/png"}}}
   :dev-servers [{:id :nextjs :label "Next.js · mock data, no authentication" :url PREVIEW-ORIGIN
                  :env {"PREVIEW_PORT" (str (.getPort (java.net.URI. PREVIEW-ORIGIN)))}
                  :command ["make" "manage-preview"] :stop-timeout-ms 60000
                  :stop-argument "scripts/mock_preview.mjs"}
                 {:id :native :label "Native Next.js · mock data, no authentication" :url NATIVE-PREVIEW-ORIGIN
                  :command ["make" "manage-preview-native"] :stop-timeout-ms 60000
                  :stop-argument "scripts/native_preview.mjs"}]
   :test-profiles {:page-health {:label "Page health · workbench failure evidence"
                                :namespaces '[finfolkbuild.project.page-health-test]}
                   :native-account {:label "Native account · real Auth, DB and browser"
                                      :timeout-ms 360000
                                      :namespaces '[finfolkbuild.project.native-account-test finfolkdb.schema.account-contracts-test]}
                   :common {:label "Common database behaviour"
                            :namespaces 'finfolkbuild.testing.scaffold-common/test-namespaces
                            :fixture 'finfolkbuild.testing.local/with-suite!}
                   :social {:label "Social database behaviour"
                            :namespaces '[finfolkdb.fn.social.social-commands-test finfolkdb.fn.social.social-events-test finfolkdb.fn.social.social-actions-test finfolkdb.fn.social.social-delivery-test]
                            :fixture 'finfolkbuild.testing.local/with-suite!}}
   :unit-analysis {:sources ["src/finfolkdb" "src/finfolkbuild" "src-app/finfolk_web" "src-app/finfolkbuild"]
                   :tests ["test" "test-app"]}
   :source-paths ["src/finfolkdb" "src/finfolkbuild" "src-app/finfolk_web"
                  "src-app/finfolkbuild" (str SITE "/app") (str SITE "/lib") (str SITE "/src")
                  "backend" "scripts" "depth_explorer" "test-app" "test" "tests"]
   :project-sources ["project.clj" "project.version" "src/finfolkbuild/project/management.clj"
                     "src/finfolkbuild/project/page_coverage.clj"
                     "src/finfolkbuild/project/application.clj"
                     "src-app/finfolkbuild/project/main.clj"]
   :page-test-fixture 'finfolkbuild.project.page-verification/with-fixture
   :page-verifier 'finfolkbuild.project.page-verification/execute
   :verification-targets [:page-verifier]
   :verification-receipt "generated/verification/receipt.edn"
   :slices {:page-health
            {:label "Live page health"
             :description (str "Browser scan of the running preview at " PREVIEW-ORIGIN ". Flags HTTP failures, console errors and error screens; guest session unless PAGE_HEALTH_STORAGE_STATE is set.")
             :stages [{:id :browser :label "Rendered routes · includes people and account settings"
                       :targets [:page-health] :checks [:page-health]}]}
            :account
            {:label "Native account & privacy"
             :description "Real Supabase Auth, native account rules and the existing Next.js privacy screen"
             :stages [{:id :schema :label "Database schema" :targets [:database-sql]}
                      {:id :logic :label "Database application logic" :targets [:native-account] :checks [:native-account :generated-parity]}
                      {:id :rpc :label "RPC contracts" :targets [:native-account] :checks [:native-account :generated-parity]}
                      {:id :interop :label "Supabase Auth & API transport" :targets [:native-account] :checks [:native-account :generated-parity]}
                      {:id :webhooks :label "External webhooks" :targets [] :not-applicable true}
                      {:id :backbone :label "Actor-scoped Substrate backbone" :targets [:publication :native-account] :checks [:native-account :generated-parity]}
                      {:id :types :label "RPC-generated account types" :targets [:native-account] :checks [:native-account :generated-parity]}
                      {:id :ui :label "Privacy screen browser journey" :targets [:native-account] :checks [:native-account :generated-parity]}
                      {:id :page-models :label "Saved native page/model scenarios" :targets [:page-verifier] :checks [:page-model-verification :generated-parity]}]}
            :community
            {:label "Community"
             :description "Native check-ins, discovery, profile editing and permissioned statistics"
             :stages [{:id :schema :label "Native visit schema" :targets [:database-sql]}
                      {:id :logic :label "Daily visits & site timezone rules" :targets [:native-account] :checks [:native-account :generated-parity]}
                      {:id :rpc :label "Generated visit contracts" :targets [:native-account] :checks [:native-account :generated-parity]}
                      {:id :interop :label "Verified Supabase actor transport" :targets [:native-account] :checks [:native-account :generated-parity]}
                      {:id :backbone :label "Generated visit models" :targets [:native-account] :checks [:native-account :generated-parity]}
                      {:id :types :label "Generated visit UI types" :targets [:native-account] :checks [:native-account :generated-parity]}
                      {:id :ui :label "Check-in screen browser journey" :targets [:native-account] :checks [:native-account :generated-parity]}
                      {:id :page-models :label "Saved check-in scenarios" :targets [:page-verifier] :checks [:page-model-verification :generated-parity]}
                      {:id :people :label "People discovery browser journey" :targets [:native-account] :checks [:native-account :generated-parity]}
                      {:id :profiles :label "Profile viewing/editing & shared statistics" :targets [:native-account :page-verifier]
                       :checks [:native-account :page-model-verification :generated-parity]}
                      {:id :places :label "Place community & reporting" :targets []
                       :blocker "Site-community pagination, ranking and reporting adapters remain to be migrated"}]}
            :atlas (native-content-slice "Native atlas & map"
                     "Published native site catalogue, public projections and map notes"
                     [{:id :review :label "Site submissions, editing, review and publication" :targets [:native-account :page-verifier]
                       :checks [:native-account :page-model-verification :generated-parity]}
                      {:id :imports :label "Bulk site imports" :targets [] :blocker "Native bulk import staging and batch review remain pending"}
                      {:id :environment :label "Environmental evidence adapters" :targets [] :blocker "Native environment-provider workflows remain pending"}])
            :site-notes (native-content-slice "Community site notes"
                          "One note per person/site, revisioned edits, voting, withdrawal and moderation" [])
            :directory (native-content-slice "Directory & managed pages"
                         "Native publication, claims, ownership and invitation flows"
                         [{:id :discovery :label "Discovery provider, ledger and HTTP failure mocks" :targets [:native-account :page-verifier]
                           :checks [:native-account :page-model-verification :generated-parity]}])
            :events (native-content-slice "Events"
                      "Native drafts, publication, invitations, RSVP capacity and moderation"
                      [{:id :delivery :label "Encrypted invitation delivery, leases and provider failure mocks" :targets [:native-account :page-verifier]
                        :checks [:native-account :page-model-verification :generated-parity]}])
            :logbook
            {:label "Logbook" :description "Native private sessions and verified public sharing through the Substrate backbone"
             :stages [{:id :schema :label "Database schema" :targets [:database-sql]}
                      {:id :logic :label "Private session application logic" :targets [:native-account] :checks [:native-account :generated-parity]}
                      {:id :rpc :label "Private session RPC contracts" :targets [:native-account] :checks [:native-account :generated-parity]}
                      {:id :interop :label "Native private session SDK & Auth transport" :targets [:native-account] :checks [:native-account :generated-parity]}
                      {:id :webhooks :label "Webhooks" :targets [] :not-applicable true}
                      {:id :backbone :label "Generated Substrate backbone" :targets [:logbook-backbone :native-account] :checks [:slice-logbook :native-account :generated-parity]}
                      {:id :demo :label "Local SQL demo & devtool" :targets [:logbook-demo] :checks [:slice-logbook :logbook-demo]}
                      {:id :page-models :label "Page/model verification" :targets [:page-verifier] :checks [:page-model-verification :generated-parity]}
                      {:id :types :label "Generated private session UI types" :targets [:native-account] :checks [:native-account :generated-parity]}
                      {:id :ui :label "Private logbook browser journey" :targets [:native-account] :checks [:native-account :generated-parity]}
                      {:id :public :label "Public access & publishing" :targets [:native-account :page-verifier] :checks [:native-account :page-model-verification :generated-parity]}
                      {:id :media :label "Imported media & providers" :targets [] :blocker "Native provider, media ownership and cleanup adapters remain to be migrated"}]}}
   :web-pipeline {:database {:targets [:database-sql]}
                  :contracts {:targets [:database-json]}
                  :application {:targets [:publication :application-manifest :logbook-backbone :page-verifier]}
                  :assets {:steps [{:id :browser-bundles :kind :build :sources ["scripts/bundle_backbone.mjs" (str SITE "/src/site-catalog.js")] :outputs [(str SITE "/src/next-backbone.js") (str SITE "/src/app-backbone.js") (str SITE "/src/workers") (str SITE "/public")] :command ["node" "scripts/bundle_backbone.mjs"] :timeout-ms 120000}
                                  {:id :static-assets :kind :build :sources ["depth_explorer" "scripts/build_next.mjs" "scripts/build_explore_contours.mjs" "production.environment.json"] :command ["node" "scripts/build_next.mjs"] :env {"FINFOLK_BACKBONE_PREPARED" "1"} :timeout-ms 900000}
                                  {:id :public-assets :kind :build :sources ["scripts/prepare_nextjs.mjs" "scripts/prepare_netlify_assets.mjs"] :command ["node" "scripts/prepare_nextjs.mjs"] :timeout-ms 300000}]}
                  :build {:steps [{:id :nextjs :kind :build :sources [(str SITE "/app") (str SITE "/lib") (str SITE "/next.config.mjs") (str SITE "/package.json")] :outputs [(str SITE "/.next/BUILD_ID")] :command ["corepack" "yarn" "workspace" "@finfolk/web-main" "build"] :timeout-ms 900000}
                                  {:id :api-worker :kind :build :sources ["backend" "wrangler.supabase-api.jsonc"] :outputs [".cache/pipeline/api-worker"] :command ["corepack" "yarn" "wrangler" "deploy" "--dry-run" "--config" "wrangler.supabase-api.jsonc" "--outdir" ".cache/pipeline/api-worker"] :timeout-ms 300000}]}
                  :verification {:steps [{:id :generated-parity :kind :check :check :generated-parity}
                                         {:id :native-account :kind :check :check :native-account}
                                         {:id :page-models :kind :check :check :page-model-verification}
                                         {:id :api-contracts :kind :check :check :api-contracts}
                                         {:id :project-tests :kind :check :check :project-tests}]}}
   :default-targets [:web-main :api :integration]
   :preview-groups PREVIEW-GROUPS
   :previews (mapv #(assoc % :group (preview-group (:url %))) (into [{:id :sample-member :label "Member detail" :target :web-main :url (str PREVIEW-ORIGIN "/members/bob") :command "make manage-preview" :server :nextjs}
                     {:id :sample-event :label "Event detail" :target :web-main :url (str PREVIEW-ORIGIN "/events/public-event") :command "make manage-preview" :server :nextjs}
                     {:id :sample-page :label "Page detail" :target :web-main :url (str PREVIEW-ORIGIN "/directory/school") :command "make manage-preview" :server :nextjs}
                     {:id :sample-session :label "Session detail" :target :web-main :url (str PREVIEW-ORIGIN "/logbook?session=session-one") :command "make manage-preview" :server :nextjs}
                     {:id :sample-editor :label "New session" :target :web-main :url (str PREVIEW-ORIGIN "/logbook?new=bondi") :command "make manage-preview" :server :nextjs}]
                    (mapv (fn [[id label route]]
                     {:id id :label label :target :web-main
                      :url (str PREVIEW-ORIGIN route (if (re-find #"review|moderation|shop/manage" route) "?previewActor=admin" (if (= route "/pages") "?previewActor=owner" ""))) :command "make manage-preview" :server :nextjs})
                   ALL-PREVIEW-ROUTES)))
   :targets
   {:page-health
    {:label "Live page health"
     :sources [(str SITE "/app") (str SITE "/lib") (str SITE "/src")
               (str SITE "/next.config.mjs") (str SITE "/package.json")
               "backend" "scripts/check_pages.mjs" "tests/test_page_health.mjs"
               "package.json" "yarn.lock"]
     :outputs [] :render (fn [_] {})}
    :page-verifier
    (verify/with-receipt (make/target {:depends [:logbook-backbone :publication] :sources ["test/finfolkbuild/project/page_verification_test.clj" "tests/app_manage_workbench.mjs" "src-app/finfolk_web/lib/logbook_pages.clj" "src/finfolkdb/schema/logbook_demo.clj" "src/finfolkbuild/project/logbook_demo.clj" "project.clj" "src-app/finfolk_web/demo/page_verifier.clj" "src-app/finfolk_web/lib/page_models.clj" "src-app/finfolk_web/pages" "src/finfolkbuild/project/page_verification.clj"
        "src/finfolkbuild/project/account_page_fixture.clj" "tests/fixtures/native-account-verifier.mjs"
        "backend/native-account.mjs" "backend/event-delivery.mjs" "backend/directory-discovery.mjs" "backend/api.mjs" "scripts/lib/mock_event_delivery.mjs" "scripts/lib/mock_directory_search.mjs"
        "src-app/finfolk_web/demo/account_verifier.clj"]
      :outputs ["generated/verification"] :load ['finfolk-web.lib.page-models 'finfolk-web.demo.page-verifier 'finfolk-web.demo.account-verifier]
      :sections [{:type :module.graph :lang :js :main 'finfolk-web.demo.account-verifier
                  :target "generated/verification/native-account" :emit {:code {:label false :link {:path-suffix ".mjs"}}}}
                 {:type :module.graph :lang :js :main 'finfolk-web.lib.page-models :target "generated/verification/page-models" :emit {:code {:label false :link {:path-suffix ".mjs"}}}}
                 {:type :module.graph :lang :js :main 'finfolk-web.lib.backbone :target "generated/verification/backbone" :emit {:code {:label false :link {:path-suffix ".mjs"}}}}
                 {:type :module.single :lang :js :main 'finfolk-web.demo.page-verifier :file "generated/verification/worker.mjs" :emit {:code {:label false}}}]}) "generated/verification/receipt.edn")
    :logbook-demo
    (make/target {:depends [:logbook-backbone] :sources ["src-app/finfolk_web/demo/logbook.clj" "src/finfolkbuild/project/logbook_demo.clj"
                                                          "test/finfolkbuild/project/logbook_demo_test.clj"]
                  :outputs ["generated/slices/logbook/demo.mjs"] :load ['finfolk-web.demo.logbook]
                  :sections [{:type :module.single :lang :js :main 'finfolk-web.demo.logbook
                              :file "generated/slices/logbook/demo.mjs" :emit {:code {:label false}}}]})
    :logbook-backbone
    (make/target {:depends [:database-json]
                  :sources ["src-app/finfolk_web/lib/backbone.clj" "src-app/finfolk_web/lib/operations.clj" "src-app/finfolk_web/groups"
                            "test-app/finfolk_web/integration"]
                  :outputs ["generated/slices/logbook/backbone"] :load ['finfolk-web.lib.backbone]
                  :sections [{:type :module.graph :lang :js :main 'finfolk-web.lib.backbone
                              :target "generated/slices/logbook/backbone"
                              :emit {:code {:label false :link {:path-suffix ".mjs"}}}}]})
    :database-sql (get-in application/PROJECT [:targets :database-sql])
    :database-json (get-in application/PROJECT [:targets :database-json])
    :native-sql-tests (get-in application/PROJECT [:targets :native-sql-tests])
    :publication
    {:depends [:database-json]
     :sources ["src-app/finfolk_web" "src-app/finfolkbuild" "src/finfolkbuild/db"
               "resources/finfolkbuild/legacy" (str SITE "/app")]
     :outputs ["js/finfolk-next/packages/edge" "js/finfolk-next/packages/libs"
               (str SITE "/lib/page-routes.generated.js") (str SITE "/src/next-contracts.json")
               "resources/finfolkdb/catalog.json"
               "resources/xtalk-publication.json" "resources/generated-files.json" "tests/db/indexes.json"]
     :render publication-artifacts}
    :browser-bundles
    {:depends [:publication]
     :sources ["scripts/bundle_backbone.mjs" (str SITE "/src/site-catalog.js")] :outputs [] :render (fn [_] {})}
    :site-assets
    {:depends [:browser-bundles]
     :sources ["depth_explorer" "scripts/build_next.mjs" "scripts/build_explore_contours.mjs"
               "scripts/prepare_nextjs.mjs" "scripts/prepare_netlify_assets.mjs"
               "production.environment.json" (str SITE "/src")]
     :outputs [] :render (fn [_] {})}
    :web-main
    {:depends [:site-assets]
     :sources [(str SITE "/app") (str SITE "/lib") (str SITE "/next.config.mjs")
               (str SITE "/package.json") "scripts/build_nextjs_offline.mjs"]
     :outputs [] :render (fn [_] {})}
    :api
    {:depends [:publication]
     :sources ["backend" "wrangler.supabase-api.jsonc"] :outputs [] :render (fn [_] {})}
    :native-account (assoc (get-in application/PROJECT [:targets :native-account]) :depends [:browser-bundles])
    :integration (get-in application/PROJECT [:targets :integration])
    :feature-flags (get-in application/PROJECT [:targets :feature-flags])
    :environment-flags (get-in application/PROJECT [:targets :environment-flags])
    :validation
    {:depends [:web-main :api :integration :native-sql-tests]
     :sources ["tests" "test" "test-app" "Makefile"] :outputs [] :render (fn [_] {})}}
   :checks
   (merge (:checks application/PROJECT)
          {:page-health {:targets [:page-health]
                         :command ["node" "scripts/check_pages.mjs" "--base" PREVIEW-ORIGIN]
                         :timeout-ms 1200000}
           :page-migration-inventory (integration/check {:targets [:page-verifier] :namespaces ['finfolkbuild.project.page-coverage-test]})
           :page-model-verification (application/isolated-check [:page-verifier] '[finfolkbuild.project.page-verification-test])
           :logbook-demo (integration/check {:targets [:logbook-demo]
                                             :namespaces ['finfolkbuild.project.logbook-demo-test]})
           :slice-logbook (integration/check {:targets [:logbook-backbone]
                                              :namespaces ['finfolk-web.integration.generated-backbone-test 'finfolk-web.integration.logbook-test]})
           :browser-bundles {:targets [:browser-bundles]
                              :command ["node" "scripts/bundle_backbone.mjs"] :timeout-ms 120000}
           :frontend-assets {:targets [:site-assets] :command ["make" "build"] :timeout-ms 900000}
           :frontend-build {:targets [:web-main] :run 'finfolkbuild.project.management/frontend-build!}
           :api-contracts {:targets [:api] :command ["node" "tests/test_substrate_api.mjs"] :timeout-ms 120000}
           :generated-parity {:targets [:publication] :command ["make" "check-generated"] :timeout-ms 300000}
           :project-tests {:targets [:validation] :command ["make" "test"] :timeout-ms 1800000}})}
  {:application 'finfolkbuild.project.management/application-pages
   :operations 'finfolkbuild.project.management/application-operations
   :sources ["src-app/finfolk_web/pages" "src-app/finfolk_web/lib/operations.clj"]}))
