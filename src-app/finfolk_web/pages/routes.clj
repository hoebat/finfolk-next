(ns finfolk-web.pages.routes
  "Build-time route and offline coverage; no session data enters these declarations."
  (:require [clojure.java.io :as io] [clojure.string :as str]
            [finfolk-web.pages.registry :as registry]))
(def TEMPLATES
 {"/" "home" "/discover" "discover" "/logbook" "logbook" "/directory" "directory" "/events" "events"
  "/events/new" "event-editor" "/events/invitation" "event-invitation" "/pages/invitation" "page-invitation"
  "/people" "people" "/profile" "profile" "/profile/edit" "profile-edit"
  "/account" "account" "/account/checkin" "account" "/account/instagram" "account" "/account/posts" "account"
  "/account/privacy" "account" "/account/review" "account" "/account/settings" "account" "/account/sites" "account"})
(def STATIC ["/community" "/practice" "/you" "/shop" "/shop/manage" "/map" "/pages" "/pages/review" "/members" "/events/my"])
(def DYNAMIC {"/directory/:id" "listing" "/events/:id" "event" "/members/:id" "member" "/reports/:id" "report"})
(def REDIRECTS [{"source" "/profiles.html" "destination" "/profiles" "permanent" false} {"source" "/app.html" "destination" "/app" "permanent" false} {"source" "/directory.html" "destination" "/directory" "permanent" false} {"source" "/events.html" "destination" "/events" "permanent" false} {"source" "/landing.html" "destination" "/" "permanent" false} {"source" "/index.html" "destination" "/" "permanent" false} {"source" "/app" "has" [{"type" "query" "key" "view" "value" "discover"}] "destination" "/discover" "permanent" false} {"source" "/app" "has" [{"type" "query" "key" "view" "value" "areas"}] "destination" "/discover?section=index" "permanent" false} {"source" "/app" "has" [{"type" "query" "key" "view" "value" "guides"}] "destination" "/discover?section=suggested" "permanent" false} {"source" "/app" "has" [{"type" "query" "key" "view" "value" "logbook"}] "destination" "/logbook" "permanent" false} {"source" "/app" "has" [{"type" "query" "key" "view" "value" "trip"} {"type" "query" "key" "trip" "value" "(?<reportId>[^/]+)"}] "destination" "/reports/:reportId" "permanent" false} {"source" "/app" "has" [{"type" "query" "key" "view" "value" "account"} {"type" "query" "key" "reportTrip"}] "destination" "/account/posts" "permanent" false} {"source" "/app" "has" [{"type" "query" "key" "view" "value" "account"} {"type" "query" "key" "tab" "value" "checkin"}] "destination" "/account/checkin" "permanent" false} {"source" "/app" "has" [{"type" "query" "key" "view" "value" "account"} {"type" "query" "key" "tab" "value" "settings"}] "destination" "/account/settings" "permanent" false} {"source" "/app" "has" [{"type" "query" "key" "view" "value" "account"} {"type" "query" "key" "tab" "value" "profile"}] "destination" "/account/privacy" "permanent" false} {"source" "/app" "has" [{"type" "query" "key" "view" "value" "account"} {"type" "query" "key" "tab" "value" "posts"}] "destination" "/account/posts" "permanent" false} {"source" "/app" "has" [{"type" "query" "key" "view" "value" "account"} {"type" "query" "key" "tab" "value" "sites"}] "destination" "/account/sites" "permanent" false} {"source" "/app" "has" [{"type" "query" "key" "view" "value" "account"} {"type" "query" "key" "tab" "value" "admin"}] "destination" "/account/review" "permanent" false} {"source" "/app" "has" [{"type" "query" "key" "view" "value" "account"} {"type" "query" "key" "tab" "value" "instagram"}] "destination" "/account/instagram" "permanent" false} {"source" "/app" "has" [{"type" "query" "key" "view" "value" "account"}] "destination" "/account" "permanent" false}])
(defn normalize-route [route]
  (-> route (str/replace #"\[[^/]+\]" ":param") (str/replace #":[^/?]+" ":param")))
(defn inventory [app]
  (vec (for [file (file-seq (io/file app))
             :when (and (.isFile file) (re-matches #"(page|route)\.[jt]sx?" (.getName file)))
             :let [relative (str (.relativize (.toPath (io/file app)) (.toPath file)))
                   parts (remove #(re-matches #"\(.*\)" %) (butlast (str/split relative #"/")))]]
         {"path" (str "/" (str/join "/" parts)) "source" relative
          "type" (if (str/starts-with? (.getName file) "page.") "page" "handler")})))
(defn declarations [definitions]
  (let [pairs (for [[key page] definitions route (get page "routes")]
                [route {"page" key "kind" (get page "kind" "screen") "area" (get page "area")
                        "adapters" (get page "adapters") "reason" (get page "reason")}])]
    (when (not= (count pairs) (count (distinct (map first pairs))))
      (throw (ex-info "Duplicate page route" {})))
    (into (sorted-map) pairs)))
(defn validate-coverage! [entries declared templates statics patterns redirects]
  (let [paths (map #(get % "path") entries)
        documents (set (map normalize-route (concat (keys templates) statics (keys patterns))))]
    (when (not= (count paths) (count (distinct paths))) (throw (ex-info "Duplicate Next route" {})))
    (doseq [entry entries :let [path (get entry "path") definition (get declared path) kind (get definition "kind")]]
      (when (not definition) (throw (ex-info "Unregistered Next route" {:route path})))
      (when (and (= kind "screen") (not (contains? documents (normalize-route path))))
        (throw (ex-info "Page has no offline policy" {:route path})))
      (when (and (= kind "compatibility") (empty? (get definition "adapters")))
        (throw (ex-info "Compatibility route has no adapter" {:route path})))
      (when (and (contains? #{"internal" "resource"} kind) (str/blank? (get definition "reason")))
        (throw (ex-info "Infrastructure route needs a reason" {:route path}))))
    (doseq [path (keys declared)]
      (when (not (some #{path} paths)) (throw (ex-info "Declared route has no Next source" {:route path}))))
    (doseq [path documents]
      (when (not (some #{path} (map normalize-route paths))) (throw (ex-info "Offline policy has no route" {:route path}))))
    (doseq [rule redirects :let [path (first (str/split (get rule "destination") #"\?"))]]
      (when (not (some #{(normalize-route path)} (map normalize-route paths)))
        (throw (ex-info "Alias points at an unregistered route" {:destination path}))))
    true))
(defn publication [app]
  (let [entries (inventory app) declared (declarations (registry/validate!))]
    (validate-coverage! entries declared TEMPLATES STATIC DYNAMIC REDIRECTS)
    {"routes" (into (sorted-map) (for [entry entries :let [path (get entry "path")]]
                                  [path (merge (get declared path) (dissoc entry "path"))]))
     "offlineTemplates" (into (sorted-map) TEMPLATES) "offlineStaticRoutes" STATIC
     "offlineDynamicTemplates" (into (sorted-map) DYNAMIC) "legacyRedirects" REDIRECTS}))
