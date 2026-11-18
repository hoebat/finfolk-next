(ns finfolkbuild.project.preview-routes-test
  (:require [lang.core :as l] [app.manage.make :as make] [app.manage.server :as server]
            [app.manage.process :as process] [clojure.java.io :as io] [clojure.data.json :as json])
  (:use code.test))
(l/script- :js {:import [["playwright" :as playwright]]})
(defn.js ^{:- [:async]} inspectRoutes [origin]
  (var browser (await (playwright.chromium.launch {"headless" true})))
  (var page (await (browser.newPage)))
  (var errors [])
  (try
    (page.on "pageerror" (fn [error] (. errors (push error.message))))
    (await (page.goto (+ origin "/#/previews/second%20preview")))
    (var frame (page.locator ".preview-stage iframe"))
    (await (. (page.locator "[data-preview='second preview'][aria-pressed='true']") (waitFor)))
    (var direct (await (frame.getAttribute "src")))
    (await (page.reload))
    (await (. (page.locator "[data-preview='second preview'][aria-pressed='true']") (waitFor)))
    (var reload (await (frame.getAttribute "src")))
    (await (. (page.locator "[data-preview='first']") (click)))
    (var clicked (await (page.evaluate (fn [] (return window.location.hash)))))
    (await (. frame (evaluate (fn [element] (:= element.dataset.persisted "yes")))))
    ;; Two polling cycles must not replace the live application iframe.
    (await (page.waitForTimeout 2200))
    (var preserved (await (frame.getAttribute "data-persisted")))
    (await (page.goBack))
    (await (. (page.locator "[data-preview='second preview'][aria-pressed='true']") (waitFor)))
    (var back (await (frame.getAttribute "src")))
    (await (page.goForward))
    (await (. (page.locator "[data-preview='first'][aria-pressed='true']") (waitFor)))
    (var forward (await (frame.getAttribute "src")))
    (await (. (page.locator "[data-view='pages']") (click)))
    (var leaving (await (page.evaluate (fn [] (return window.location.hash)))))
    (await (page.goBack))
    (await (. (page.locator "[data-preview='first'][aria-pressed='true']") (waitFor)))
    (var restored (await (frame.getAttribute "src")))
    (var link (await (. (page.getByRole "link" {"name" "Preview link" "exact" true}) (getAttribute "href"))))
    (return {"direct" direct "reload" reload "clicked" clicked "preserved" preserved
             "back" back "forward" forward "leaving" leaving "restored" restored "link" link "errors" errors})
    (catch error
      (throw (new Error (+ error.message " · " (JSON.stringify errors) " · " (await (. (page.locator "body") (innerText))))) ))
    (finally (await (browser.close)))))

^{:id preview-hash-navigation :timeout 90000}
(fact "preview deep links survive reload, history navigation and polling"
  ;; Exercise the vendored framework UI before its next Maven publication.
  (let [_ (load-file "ref/foundation/src/app/manage/ui.clj")
        root (.toFile (java.nio.file.Files/createTempDirectory "preview-routes-" (make-array java.nio.file.attribute.FileAttribute 0)))
        _ (doseq [name ["first" "second"]]
            (let [file (io/file root "generated" (str name ".html"))]
              (io/make-parents file) (spit file (str "<!doctype html><title>" name "</title>"))))
        p {:id 'preview-routes :root (str root) :targets {:sample {:sources [] :outputs ["generated"] :render (fn [_] {})}}
           :previews [{:id "first" :label "First preview" :target :sample :path "generated/first.html"}
                      {:id "second preview" :label "Second preview" :target :sample :path "generated/second.html"}]}
        s (server/start! (constantly p) {:port 0})]
    (try
      (doseq [[path content] (make/render-sections {:root (.getCanonicalFile (io/file "."))}
                             {:load [] :sections [{:type :module.single :lang :js :main 'finfolkbuild.project.preview-routes-test
                                                   :file ".cache/preview-routes-browser.mjs" :emit {:code {:label false}}}]})]
        (io/make-parents (io/file path)) (spit path content))
      (let [r (process/run {:root "." :timeout-ms 60000
                           :command ["node" "--input-type=module" "-e"
                                     "import('./.cache/preview-routes-browser.mjs').then(async m=>console.log(JSON.stringify(await m.inspectRoutes(process.argv[1]))))"
                                     (str "http://127.0.0.1:" (:port s))]})]
        (when-not (= :ok (:status r)) (throw (ex-info "Preview routes browser check failed" r)))
        (json/read-str (:stdout r) :key-fn keyword))
      (finally (server/stop! s)
               (doseq [file (reverse (file-seq root))] (.delete file)))))
  => {:direct "/preview/generated/second.html" :reload "/preview/generated/second.html" :clicked "#/previews/first" :preserved "yes"
      :back "/preview/generated/second.html" :forward "/preview/generated/first.html" :leaving "#/pages" :restored "/preview/generated/first.html"
      :link "#/previews/first" :errors []})
