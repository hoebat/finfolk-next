(ns finfolkbuild.project.management-test
  (:require [app.manage :as manage]
            [app.manage.server :as server]
            [clojure.java.io :as io]
            [finfolkbuild.project.management :as management]
            [finfolkbuild.project.main :as publication]
            [finfolkdb.build :as database]
            [clojure.string :as str]
            [finfolk-web.pages.routes :as routes])
  (:use code.test))

^{:refer finfolkbuild.project.management/PROJECT :added "0.1"}
(fact "the complete project plans publication before frontend/API builds and keeps the integration pilot"
  (manage/plan management/PROJECT)
  => [:database-sql :database-json :publication :browser-bundles :site-assets :web-main :api :integration]
  (get-in management/PROJECT [:checks :frontend-assets :command])
  => ["make" "build"]
  (get-in management/PROJECT [:checks :integration :targets])
  => [:integration]
  (manage/affected management/PROJECT ["backend/api.mjs"])
  => [:api :validation])

^{:refer finfolkbuild.project.management/PREVIEW-ROUTES :added "0.1"}
(fact "previews cover public, member and management routes on the actual FinFolk Next app"
  (let [previews (:previews (server/project-index management/PROJECT))]
    [(mapv :url (filter #(#{"home" "map" "moderation" "shop-manage"} (:id %)) previews))
     (set (map :target previews))
     (set (map :command previews))])
  => [[(str management/PREVIEW-ORIGIN "/") (str management/PREVIEW-ORIGIN "/map")
       (str management/PREVIEW-ORIGIN "/account/review") (str management/PREVIEW-ORIGIN "/shop/manage")]
      #{"web-main" "logbook-demo"} #{"make manage-preview" "make demo-logbook"}]
  (set (map last management/ALL-PREVIEW-ROUTES))
  => (set (concat (keys routes/TEMPLATES) routes/STATIC)))

^{:refer finfolkbuild.project.management/publication-artifacts :added "0.1" :timeout 120000}
(fact "read-only rendering adapts the actual publisher without overwriting working outputs"
  (let [path "js/finfolk-next/packages/edge/backbone.js"
        before (slurp path)
        rendered (manage/render management/PROJECT [:publication])
        artifacts (:artifacts rendered)]
    [(= before (slurp path))
     (boolean (re-find #"createBackbone" (get artifacts path)))
     (contains? artifacts "resources/finfolkdb/rebuild.sql")
     (contains? artifacts "js/finfolk-next/site/web-main/lib/page-routes.generated.js")
     (contains? artifacts "resources/generated-files.json")
     (set (filter #(str/ends-with? % ".sql") (keys artifacts)))
     (some #(str/ends-with? % ".sql") (keys (get-in rendered [:results :publication])))])
  => [true true true true true (set database/SQL-OUTPUTS) nil])

^{:id finfolkdb-sql-ownership}
(fact "general application publication cannot write its own SQL"
  (try (publication/write! "." "resources/finfolkdb/unowned.sql" "SELECT 1;")
       (catch clojure.lang.ExceptionInfo error [(.getMessage error) (ex-data error)]))
  => ["SQL publication must come from finfolkdb.build/sql-artifacts"
      {:path "resources/finfolkdb/unowned.sql"}])

^{:refer finfolkbuild.project.management/page-index :added "0.1"}
(fact "the page inspector resolves actual logbook read and action contracts"
  (let [page (first (filter #(= "logbook" (:id %)) (management/page-index)))]
    [(:routes page) (get-in page [:models "session" "operation"])
     (get-in page [:models "session" "operation-spec" "auth"])
     (get-in page [:actions "delete" "operation"])
     (get-in page [:actions "delete" "operation-spec" "write"])])
  => [["/logbook"] "session" true "deleteSession" true])
