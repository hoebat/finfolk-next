(ns finfolkbuild.project.feature-flags
  "FinFolk's app.manage adapter. Credentials stay in the local server process."
  (:require [app.manage :as manage] [clojure.data.json :as json])
  (:import [java.net URI] [java.net.http HttpClient HttpRequest HttpRequest$BodyPublishers HttpResponse$BodyHandlers]
           [java.time Duration]))

(def LOCAL-CONFIG "config/feature-flags.local.json")
(defn environment [key] (System/getenv key))
(defn configuration [project]
  (let [file (manage/project-file (or project {:root "."}) LOCAL-CONFIG)
        local (if (.isFile file)
                (try (json/read-str (slurp file) :key-fn keyword)
                     (catch Exception _ (throw (ex-info "Invalid private feature flag configuration JSON" {:http-status 503})))) {})]
    (when-not (and (map? local) (every? #{:apiOrigin :managementToken} (keys local)))
      (throw (ex-info "Private feature flag configuration accepts only apiOrigin and managementToken" {:http-status 503})))
    (let [origin (or (environment "FINFOLK_FLAG_API_ORIGIN") (:apiOrigin local) "https://api.finfolk.com.au")
          token (or (environment "FINFOLK_FLAG_MANAGEMENT_TOKEN") (:managementToken local))
          uri (try (URI. origin) (catch Exception _ nil))]
      (when-not (and uri (seq (.getHost uri)) (or (= "https" (.getScheme uri))
                            (and (= "http" (.getScheme uri)) (#{"127.0.0.1" "localhost" "[::1]"} (.getHost uri))))
                     (nil? (.getUserInfo uri)) (#{nil "" "/"} (.getPath uri))
                     (nil? (.getQuery uri)) (nil? (.getFragment uri)))
        (throw (ex-info "Invalid flag API origin" {:http-status 400})))
      (when-not (and (string? token) (re-matches #"[!-~]{32,4096}" token))
        (throw (ex-info (str "Configure " LOCAL-CONFIG " or FINFOLK_FLAG_MANAGEMENT_TOKEN on the app.manage server")
                        {:http-status 503})))
      {:origin origin :token token})))

(defn request!
  ([input] (request! input {:root "."}))
  ([input project]
   (let [{:keys [origin token]} (configuration project)
         builder (-> (HttpRequest/newBuilder (.resolve (URI. origin) "/v1/admin/feature-flags"))
                     (.timeout (Duration/ofSeconds 15)) (.header "Authorization" (str "Bearer " token))
                     (.header "Content-Type" "application/json"))
         req (.build (if input (.POST builder (HttpRequest$BodyPublishers/ofString (json/write-str input))) (.GET builder)))
         response (try (.send (HttpClient/newHttpClient) req (HttpResponse$BodyHandlers/ofString))
                       (catch Exception _ (throw (ex-info (str "Cannot reach flag API at " origin) {:http-status 503}))))]
     (when-not (= 200 (.statusCode response))
       (throw (ex-info (case (.statusCode response)
                         409 "Flag changed. Refresh before saving."
                         401 "Flag management credential rejected by the API"
                         404 "Flag management endpoint is not deployed on the selected API"
                         503 "Flag API backend is unavailable; its deployment and database must be ready before flags can connect"
                         "Flag API request failed")
                       {:http-status (.statusCode response)})))
     (try (json/read-str (.body response) :key-fn keyword)
          (catch Exception _ (throw (ex-info "Flag API returned invalid JSON" {:http-status 502})))))))
(defn read-panel [{:keys [project]}] (request! nil project))
(defn save-panel [{:keys [project input]}] (request! input project))
(def PANEL
  {:id :feature-flags :label "Production flags" :entry "index.html"
   :assets {"index.html" "config/feature-flags-panel/index.html"
            "panel.js" "config/feature-flags-panel/panel.js"
            "panel.css" "config/feature-flags-panel/panel.css"}
   :read 'finfolkbuild.project.feature-flags/read-panel
   :actions {:save 'finfolkbuild.project.feature-flags/save-panel}})
