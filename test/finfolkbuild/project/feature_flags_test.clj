(ns finfolkbuild.project.feature-flags-test
  (:require [app.manage.panels :as panels] [finfolkbuild.project.management :as management])
  (:use code.test))

^{:id panel-declarations}
(fact "panels are opt-in and project definitions stay private"
  (panels/index {}) => []
  (panels/index management/PROJECT)
  => [{:id "feature-flags" :label "Production flags" :url "/project-panels/feature-flags/index.html"}])

^{:id panel-validation}
(fact "duplicate IDs, path traversal and undeclared actions are rejected"
  (let [panel {:id :example :label "Example" :entry "index.html"
               :assets {"index.html" "README.md"} :read (fn [_] {:ok true}) :actions {}}
        rejected (fn [ps] (try (panels/definitions {:root "." :project-panels ps}) false (catch Exception _ true)))]
    [(rejected [panel (assoc panel :id "example")])
     (rejected [(assoc panel :assets {"../index.html" "README.md"})])
     (try (panels/invoke {} panel "shell" {}) false (catch Exception e (= 404 (:http-status (ex-data e)))))
     (panels/invoke {} panel nil nil)])
  => [true true true {:ok true}])

^{:id panel-string-action}
(fact "string action names dispatch without aliases or duplicate ambiguity"
  (panels/invoke {} {:actions {"save" (fn [{:keys [input]}] input)}} "save" {:value 1})
  => {:value 1})

^{:id panel-environment-compatibility}
(fact "the panel package retains the existing environment console gateway"
  (require '[app.manage.server :as server] '[app.manage.environments :as environments])
  (let [project {:id 'environment-compatibility :root "." :targets {:empty {:sources [] :outputs [] :render (fn [_] {})}} :default-targets [:empty]}
        manager ((requiring-resolve 'app.manage.server/start!) (constantly project) {:port 0})
        client (java.net.http.HttpClient/newHttpClient)
        origin (str "http://127.0.0.1:" (:port manager))
        get-response (fn [path]
                       (.send client (.build (java.net.http.HttpRequest/newBuilder (java.net.URI. (str origin path))))
                              (java.net.http.HttpResponse$BodyHandlers/ofString)))]
    (try
      (let [root (get-response "/")
            console (with-redefs-fn {(requiring-resolve 'app.manage.environments/ensure-console!) (fn [_] "http://127.0.0.1:18131")}
                      #(get-response "/environments"))]
        [(.statusCode root) (clojure.string/includes? (.body (get-response "/assets/app.mjs")) "Environments")
         (.statusCode console) (.orElse (.firstValue (.headers console) "Location") "")])
      (finally ((requiring-resolve 'app.manage.server/stop!) manager))))
  => [200 true 302 "http://127.0.0.1:18131"])

^{:id private-flag-configuration}
(fact "normal manager startup reads private project configuration with environment overrides"
  (require '[finfolkbuild.project.feature-flags :as flags] '[clojure.java.io :as io])
  (let [root (.toFile (java.nio.file.Files/createTempDirectory "flag-configuration-" (make-array java.nio.file.attribute.FileAttribute 0)))
        file (clojure.java.io/file root "config/feature-flags.local.json")
        configuration (requiring-resolve 'finfolkbuild.project.feature-flags/configuration)
        environment (requiring-resolve 'finfolkbuild.project.feature-flags/environment)
        token "fixture-private-configuration-token-32-characters"]
    (try
      (clojure.java.io/make-parents file)
      (spit file (clojure.data.json/write-str {:apiOrigin "http://127.0.0.1:8787" :managementToken token}))
      [(with-redefs-fn {environment (constantly nil)} #(configuration {:root (str root)}))
       (with-redefs-fn {environment {"FINFOLK_FLAG_API_ORIGIN" "https://override.example" "FINFOLK_FLAG_MANAGEMENT_TOKEN" token}}
         #(configuration {:root (str root)}))
       (do (spit file "broken-private-config-do-not-reflect")
           (with-redefs-fn {environment (constantly nil)}
             #(try (configuration {:root (str root)}) :unexpected-success
                   (catch Exception e (.getMessage e)))))]
      (finally (doseq [entry (reverse (file-seq root))] (.delete entry)))))
  => [{:origin "http://127.0.0.1:8787" :token "fixture-private-configuration-token-32-characters"}
      {:origin "https://override.example" :token "fixture-private-configuration-token-32-characters"}
      "Invalid private feature flag configuration JSON"])
