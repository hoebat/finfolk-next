(ns finfolkbuild.project.management
  "Whole-project management over FinFolk's existing publication and build tools."
  (:require [app.manage :as manage]
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

(def PROJECT
  {:id 'finfolk
   :root "."
   :source-paths ["src/finfolkdb" "src/finfolkbuild" "src-app/finfolk_web"
                  "src-app/finfolkbuild" (str SITE "/app") (str SITE "/lib") (str SITE "/src")
                  "backend" "scripts" "depth_explorer" "test-app" "test" "tests"]
   :project-sources ["src/finfolkbuild/project/management.clj"
                     "src/finfolkbuild/project/page_coverage.clj"
                     "src/finfolkbuild/project/application.clj"
                     "src-app/finfolkbuild/project/main.clj"]
   :page-test-fixture 'finfolkbuild.project.page-verification/with-fixture
   :page-verifier 'finfolkbuild.project.page-verification/execute
   :verification-targets [:page-verifier]
   :verification-receipt "generated/verification/receipt.edn"
   :pages 'finfolkbuild.project.management/page-index
   :slices {:logbook
            {:label "Private logbook" :description "Native session creation/read through the real Substrate backbone"
             :stages [{:id :schema :label "Database schema" :targets [:database-sql]}
                      {:id :logic :label "Database application logic" :targets [:database-sql]}
                      {:id :rpc :label "RPC signatures" :targets [:database-json]}
                      {:id :interop :label "JS interop" :targets [] :blocker "Generated runtime RPC adapter still required; native database transport is covered by the backbone integration check"}
                      {:id :webhooks :label "Webhooks" :targets [] :not-applicable true}
                      {:id :backbone :label "Generated Substrate backbone" :targets [:logbook-backbone] :checks [:slice-logbook]}
                      {:id :demo :label "Local demo & devtool" :targets [:logbook-demo] :checks [:slice-logbook :logbook-demo]}
                      {:id :page-models :label "Page/model verification" :targets [:page-verifier] :checks [:page-model-verification]}
                      {:id :types :label "UI types" :targets [] :blocker "RPC JSON payload shape declarations and typed publication are required"}
                      {:id :ui :label "Logbook UI" :targets [:web-main] :blocker "Existing page still depends on the older API adapter; native slice UI wiring is required"}]}}
   :default-targets [:web-main :api :integration]
   :previews (into [{:id :logbook-lab :label "Logbook lab · devtool" :target :logbook-demo
                       :url "http://127.0.0.1:8132/" :command "make demo-logbook"}]
                    (mapv (fn [[id label route]]
                     {:id id :label label :target :web-main
                      :url (str PREVIEW-ORIGIN route) :command "make manage-preview"})
                   ALL-PREVIEW-ROUTES))
   :targets
   {:page-verifier
    (verify/with-receipt (make/target {:depends [:logbook-backbone] :sources ["test/finfolkbuild/project/page_verification_test.clj" "tests/app_manage_workbench.mjs" "src-app/finfolk_web/lib/logbook_pages.clj" "src/finfolkdb/schema/logbook_demo.clj" "src/finfolkbuild/project/logbook_demo.clj" "ref/foundation/src/app/manage/verify.clj" "src-app/finfolk_web/demo/page_verifier.clj" "src-app/finfolk_web/lib/page_models.clj" "src-app/finfolk_web/pages" "src/finfolkbuild/project/page_verification.clj"]
      :outputs ["generated/verification"] :load ['finfolk-web.lib.page-models 'finfolk-web.demo.page-verifier]
      :sections [{:type :module.graph :lang :js :main 'finfolk-web.lib.page-models :target "generated/verification/page-models" :emit {:code {:label false :link {:path-suffix ".mjs"}}}}
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
     :sources ["scripts/bundle_backbone.mjs"] :outputs [] :render (fn [_] {})}
    :site-assets
    {:depends [:browser-bundles]
     :sources ["depth_explorer" "scripts/build_next.mjs" "scripts/build_explore_contours.mjs"
               "scripts/prepare_nextjs.mjs" "scripts/prepare_netlify_assets.mjs"
               "next.environment.json" (str SITE "/src")]
     :outputs [] :render (fn [_] {})}
    :web-main
    {:depends [:site-assets]
     :sources [(str SITE "/app") (str SITE "/lib") (str SITE "/next.config.mjs")
               (str SITE "/package.json") "scripts/build_nextjs_offline.mjs"]
     :outputs [] :render (fn [_] {})}
    :api
    {:depends [:publication]
     :sources ["backend" "wrangler.next-api.jsonc"] :outputs [] :render (fn [_] {})}
    :integration (get-in application/PROJECT [:targets :integration])
    :validation
    {:depends [:web-main :api :integration]
     :sources ["tests" "test" "test-app" "Makefile"] :outputs [] :render (fn [_] {})}}
   :checks
   (merge (:checks application/PROJECT)
          {:page-migration-inventory (integration/check {:targets [:page-verifier] :namespaces ['finfolkbuild.project.page-coverage-test]})
           :page-model-verification (integration/check {:targets [:page-verifier] :namespaces ['finfolkbuild.project.page-verification-test]})
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
           :project-tests {:targets [:validation] :command ["make" "test"] :timeout-ms 1800000}})})
