(require 'clojure.string)
(def FOUNDATION_VERSION
  (->> (clojure.string/split-lines (slurp "project.version"))
       (keep #(when (clojure.string/starts-with? % "FOUNDATION_VERSION=") (subs % 19))) first))
(defproject hoebat/finfolk-next "0.1.0"
  :description "FinFolk Clojure-authored database and substrate backbone"
  :dependencies [[org.clojure/clojure "1.11.1"]
                 [org.clojure/data.json "2.4.0"]
                 [org.postgresql/postgresql "42.7.2"]
                 [http-kit "2.8.0"]
                 [xyz.zcaudate/app.manage "4.1.9-history.1"]
                 [xyz.zcaudate/lang ~FOUNDATION_VERSION]
                 [xyz.zcaudate/postgres ~FOUNDATION_VERSION]
                 [xyz.zcaudate/js.core ~FOUNDATION_VERSION]
                 [xyz.zcaudate/xtalk.substrate ~FOUNDATION_VERSION]
                 [xyz.zcaudate/xtalk.db ~FOUNDATION_VERSION]
                 [xyz.zcaudate/code.test ~FOUNDATION_VERSION]
                 [xyz.zcaudate/code.framework ~FOUNDATION_VERSION]
                 [xyz.zcaudate/code.manage ~FOUNDATION_VERSION]]
  :source-paths ["src" "src-app" "ref/foundation/src-lang"]
  :resource-paths ["resources"]
  :test-paths ["test" "test-app"]
  :profiles {:dev {:dependencies [[zprint/zprint "1.3.0"]]
                   :source-paths ["dev"]}}
  :aliases {"manage" ["run" "-m" "app.manage.server" "finfolkbuild.project.management/PROJECT"]
            "app" ["run" "-m" "app.manage" "finfolkbuild.project.management/PROJECT"]
            "test" ["run" "-m" "code.test"]
            "zprint" ["run" "-m" "tooling.format"]
            "generate" ["run" "-m" "finfolkbuild.project.main"]}
  :jvm-opts ["-Xmx2g" "--enable-native-access=ALL-UNNAMED"])
