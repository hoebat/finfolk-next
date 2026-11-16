(ns finfolkbuild.project.logbook-demo-test
  (:require [finfolkbuild.project.logbook-demo :as demo]
            [finfolkdb.fn.user.user-manage-logbook :as logbook]
            [finfolkdb.common.type-system-base :as system]
            [clojure.data.json :as json])
  (:use code.test))

^{:refer finfolkbuild.project.logbook-demo/invoke! :added "0.1"}
(fact "the fixture binds an allowed actor and site before invoking native domain functions"
  (with-redefs [system/op-fn (fn [& _] :operation)
                logbook/insert-dive-session (fn [& args] (vec args))]
    (demo/invoke! {:actor "alice" :operation "saveSession" :values {:notes "Dive"}}))
  => [demo/OWNER demo/SITE {:notes "Dive"} :operation]
  (try (demo/invoke! {:actor "unknown" :operation "session" :values {}})
       (catch clojure.lang.ExceptionInfo e (.getMessage e)))
  => "Unknown fixture actor"
  (try (demo/invoke! {:actor "alice" :operation "arbitrary-rpc" :values {}})
       (catch clojure.lang.ExceptionInfo e (.getMessage e)))
  => "Undeclared demo operation")

^{:refer finfolkbuild.project.logbook-demo/handler :added "0.1"}
(fact "the HTTP adapter enforces its token and serializes the native return value"
  (:status (demo/handler "token" {:request-method :post :uri "/rpc" :headers {}}))
  => 403
  (with-redefs [demo/invoke! (fn [input] {:actor (:actor input) :notes (get-in input [:values :notes])})]
    (let [response (demo/handler "token" {:request-method :post :uri "/rpc"
                       :headers {"x-demo-token" "token"}
                       :body (java.io.StringReader. "{\"actor\":\"alice\",\"operation\":\"session\",\"values\":{\"notes\":\"Native result\"}}")})]
      [(:status response) (json/read-str (:body response))]))
  => [200 {"actor" "alice" "notes" "Native result"}])

^{:id emitted-demo-null-result :timeout 60000}
(fact "the emitted devtool renders a legitimate null ownership result without a client error"
  (let [run (requiring-resolve 'app.manage.process/run)
        script "import {Window} from 'happy-dom';const w=new Window({url:'http://127.0.0.1:8132'});globalThis.window=w;globalThis.document=w.document;document.write('<meta name=demo-token content=fixture><select id=actor><option value=alice>Alice</option><option value=bob>Bob</option></select><textarea id=notes></textarea><pre id=inspector></pre><pre id=result></pre><p id=status></p>');globalThis.fetch=async()=>({ok:true,status:200,json:async()=>null});const ui=await import('./generated/slices/logbook/demo.mjs');ui.state.session='20000000-0000-0000-0000-000000000004';document.querySelector('#actor').value='bob';ui.switchActor();await ui.run('read');console.log(JSON.stringify([document.querySelector('#status').textContent.startsWith('Done'),document.querySelector('#result').textContent,JSON.parse(document.querySelector('#inspector').textContent).actor]));await w.happyDOM.close();"
        result (run {:root "." :command ["node" "--input-type=module" "-e" script]})]
    (when-not (= :ok (:status result)) (throw (ex-info "Generated demo failed" result)))
    (json/read-str (:stdout result)))
  => [true "null" "bob"])
