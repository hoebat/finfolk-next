(ns finfolk-web.integration.generated-backbone-test
  (:require [app.manage.process :as process]
            [clojure.data.json :as json])
  (:use code.test))

^{:id emitted-model-lifecycle :timeout 60000}
(fact "the emitted ES module executes Substrate reads, cache access and disposal without a UI"
  (let [script "import {createBackbone} from './generated/slices/logbook/backbone/backbone.mjs'; const b=createBackbone('fixture-owner',async(name,v)=>({id:v.id,notes:'Generated model'}),{}); const row=await b.call('session',{id:'one'}); const cached=b.read('session',{id:'one'}); b.close(); const closed=await b.call('session',{id:'one'}).then(()=> 'unexpected',e=>e.message); console.log(JSON.stringify([row,cached,closed]));"
        result (process/run {:root "." :command ["node" "--input-type=module" "-e" script]})]
    (when-not (= :ok (:status result)) (throw (ex-info "Emitted backbone failed" result)))
    (json/read-str (:stdout result)))
  => [{"id" "one" "notes" "Generated model"}
      {"id" "one" "notes" "Generated model"} "Account context closed."])
