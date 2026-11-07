(ns finfolk-web.lib.page-models
  "Transport-neutral page binding; execution remains in the actor-scoped backbone."
  (:require [lang.core :as l]
            [finfolk-web.pages.registry :as registry]))
(l/script :js {:require [[finfolk-web.lib.operations :as operations]
                        [finfolk-web.lib.community-pages :as community]
                        [finfolk-web.lib.account-pages :as account]
                        [finfolk-web.lib.logbook-pages :as logbook]
                        [finfolk-web.lib.atlas-pages :as atlas]]})
(def.js pages (@! (registry/validate!)))
(defn.js definition [key]
  (var found (. -/pages [key]))
  (when (not found) (throw (new Error (+ "Unknown page: " key))))
  (return found))
(defn.js bind [entry inputs payload]
  (var values (Object.assign {} (or payload {})))
  (. (Object.entries (. entry ["bindings"])) (forEach (fn [[target source]]
    (when (or (not (Object.prototype.hasOwnProperty.call inputs source)) (== (. inputs [source]) nil))
      (throw (new Error (+ "Missing page binding: " source))))
    (if (== target "*")
      (Object.assign values (. inputs [source]))
      (:= (. values [target]) (. inputs [source]))))))
  (return values))
(defn.js requestValues [spec input]
  (var path (. (. spec ["path"]) (replace (new RegExp ":([a-z]+)" "g")
    (fn [_ key]
      (when (== (. input [key]) nil) (throw (new Error (+ "Missing operation input: " key))))
      (return (encodeURIComponent (. input [key])))))))
  (var url (new URL path "https://local.invalid"))
  (when (== (. spec ["method"]) "GET")
    (. (Object.entries input) (forEach (fn [[key value]]
      (when (and (not= value nil) (not (. (. spec ["path"]) (includes (+ ":" key)))))
        (. (. url ["searchParams"]) (set key (String value)))))))
    (. (. url ["searchParams"]) (sort)))
  (var values {"__rest" true "path" (+ (. url ["pathname"]) (. url ["search"]))})
  (when (not= (. spec ["method"]) "GET")
    (var body (Object.assign {} input))
    (. (Object.keys body) (forEach (fn [key]
      (when (. (. spec ["path"]) (includes (+ ":" key))) (delete (. body [key]))))))
    (:= (. values ["body"]) body))
  (return values))
(defn.js ^{:- [:async]} invokeSdk [client entry args]
  (var path (. entry ["method"]))
  (var owner client)
  (. (. path (slice 0 -1)) (forEach (fn [part] (:= owner (. owner [part])))))
  (var method (. owner [(. path [(- (. path ["length"]) 1)])]))
  (when (and (. entry ["optional"]) (not= (typeof method) "function")) (return undefined))
  (return (await (. method (apply owner args)))))
(defn.js sdkArgs [entry values]
  (return (. (. entry ["args"]) (map (fn [key] (return (:? (== key "$values") values (. values [key]))))))))
(defn.js ^{:- [:async]} runSdkAction [client key name args]
  (var entry (. (or (. (-/definition key) ["sdk-actions"]) {}) [name]))
  (when (not entry) (throw (new Error (+ "Undeclared SDK adapter: " name))))
  (return (await (-/invokeSdk client entry args))))
(defn.js resolveModel [key name inputs (:= payload nil)]
  (var entry (. (-/definition key) ["models"] [name]))
  (when (not entry) (throw (new Error (+ "Undeclared page model: " name))))
  (var spec (operations/operation (. entry ["operation"])))
  (var values (-/bind entry inputs (Object.assign {} (or (. entry ["defaults"]) {}) (or payload {}))))
  (. (Object.entries (or (. entry ["validate"]) {})) (forEach (fn [[field rule]]
    (when (not (. (new RegExp (. rule ["pattern"])) (test (. values [field]))))
      (throw (new Error (. rule ["message"])))))))
  (when (and (. spec ["auth"]) (== (. spec ["transport"]) "rest"))
    (:= values (-/requestValues spec values)))
  (return {"name" (. entry ["operation"]) "values" values "spec" spec}))
(defn.js ^{:- [:async]} runAction [client key name inputs payload (:= options nil)]
  (var page (-/definition key))
  (var retired (. (or (. page ["retired-actions"]) {}) [name]))
  (when retired (throw (Object.assign (new Error retired) {"status" 410 "code" "claim_retired"})))
  (var entry (. page ["actions"] [name]))
  (when (not entry) (throw (new Error (+ "Undeclared page action: " name))))
  (var spec (operations/operation (. entry ["operation"])))
  (var input (-/bind entry inputs payload))
  (when (. entry ["sdk"])
    (return (await (-/invokeSdk client (. entry ["sdk"]) (-/sdkArgs (. entry ["sdk"]) input)))))
  (when (== (. spec ["transport"]) "rest")
    (var request (-/requestValues spec input))
    (return (await (. client (request (. request ["path"]) (Object.assign {} (or options {}) {"method" (. spec ["method"]) "body" (. request ["body"])}))))))
  (return (await (. client (call (. entry ["operation"]) input)))))

(defn.js ^{:- [:async]} runModel [client key name inputs (:= payload nil)]
  (var model (-/resolveModel key name inputs payload))
  (var entry (. (-/definition key) ["models"] [name]))
  (when (. entry ["sdk"])
    (return (await (-/invokeSdk client (. entry ["sdk"]) (-/sdkArgs (. entry ["sdk"]) (. model ["values"]))))))
  (when (and (. model ["spec"] ["auth"]) (== (. model ["spec"] ["transport"]) "rest"))
    (return (await (. client (request (. model ["values"] ["path"])
      {"method" (. model ["spec"] ["method"]) "body" (. model ["values"] ["body"])})))))
  (return (await (. client (call (. model ["name"]) (. model ["values"]))))))


(defn.js conditionsMet [conditions context]
  (return (. (or conditions []) (every (fn [path]
    (var value context)
    (. path (forEach (fn [key] (:= value (:? (== value nil) nil (. value [key]))))))
    (return (not (not value))))))))
(defn.js selectOutput [selector value]
  (when (== selector "eligible-pages")
    (return (. (. value ["listings"]) (filter (fn [page]
      (return (and (== (. page ["status"]) "published") (. page ["owner_id"]))))))))
  (return value))
(defn.js assertPageActor [client tracked actor]
  (when (and tracked (not= actor (and (. client ["user"]) (. client ["user"] ["uid"]))))
    (throw (new Error "Account changed. Sign in again."))))
(defn.js ^{:- [:async]} runPage [client key inputs (:= services nil)]
  (var page (-/definition key))
  (var tracked (Object.prototype.hasOwnProperty.call client "user"))
  (var actor (and (. client ["user"]) (. client ["user"] ["uid"])))
  (var read (async (fn [name values]
    (-/assertPageActor client tracked actor)
    (var model (-/resolveModel key name inputs values))
    (var selected (:? (and services (not (. model ["spec"] ["auth"]))) (. services ["publicClient"]) client))
    (var result (await (-/runModel selected key name inputs values)))
    (-/assertPageActor client tracked actor)
    (return result))))
  (var sdk (async (fn [name args]
    (-/assertPageActor client tracked actor)
    (var result (await (-/runSdkAction client key name args)))
    (-/assertPageActor client tracked actor)
    (return result))))
  (when (. page ["loader"])
    (when (and (== (. page ["loader"]) "messaging-settings") (not= (typeof (. client ["request"])) "function"))
      (return {"forbidden" true}))
    (var loaders {"profile" community/loadProfile "profile-editor" community/loadEditor "people" community/loadPeople
                  "site-review" account/loadSiteReview "post-manager" account/loadPostManager
                  "instagram-discovery" account/loadDiscovery "messaging-settings" account/loadMessaging
                  "logbook" logbook/loadLogbook
                  "logbook-extras" (fn [read inputs actor sdk] (return (logbook/loadExtras read sdk inputs actor)))
                  "place-media" (fn [read inputs actor sdk] (return (atlas/loadMedia read sdk inputs actor)))
                  "place-trips" atlas/loadTrips "place-feed" atlas/loadFeed "site-notes" atlas/loadSiteNotes})
    (var loader (. loaders [(. page ["loader"])]))
    (when (not loader) (throw (new Error "Unknown page loader.")))
    (var result (await (loader read inputs actor sdk)))
    (-/assertPageActor client tracked actor)
    (return result))
  (var output {})
  (var context {"inputs" inputs "models" output})
  (for:array [name (or (. page ["order"]) (Object.keys (. page ["models"])))]
    (var entry (. page ["models"] [name]))
    (-/assertPageActor client tracked actor)
    (when (not (-/conditionsMet (. entry ["require"]) context))
      (throw (new Error (or (. entry ["denied"]) "Page access denied."))))
    (if (-/conditionsMet (. entry ["when"]) context)
      (:= (. output [name]) (-/selectOutput (. entry ["select"]) (await (read name {}))))
      (:= (. output [name]) nil))
    (-/assertPageActor client tracked actor))
  (return output))


(defn.js ^{:- [:async]} runAuthAction [client key name args]
  (var entry (. (-/definition key) ["auth-actions"] [name]))
  (when (not entry) (throw (new Error (+ "Undeclared authentication action: " name))))
  (var path (. entry ["method"]))
  (var owner client)
  (. (. path (slice 0 -1)) (forEach (fn [part] (:= owner (. owner [part])))))
  (var method (. owner [(. path [(- (. path ["length"]) 1)])]))
  (var result (await (. method (apply owner (or args [])))))
  (when (and (. entry ["check-error"]) result (. result ["error"]))
    (throw (new Error (. result ["error"] ["message"]))))
  (return result))


(defn.js assertClientOperation [key name write]
  (var page (-/definition key))
  (var entries (:? write (Object.assign {} (. page ["models"]) (. page ["actions"])) (. page ["models"])))
  (when (not (. (Object.values entries) (some (fn [entry] (return (== (. entry ["operation"]) name))))))
    (throw (new Error (+ "Undeclared page operation: " name))))
  (return true))
(defn.js bindPageClient [key client]
  (-/definition key)
  (return {"call" (fn [name values options] (-/assertClientOperation key name true) (return (. client (call name values options))))
           "read" (fn [name values] (-/assertClientOperation key name false) (return (:? (. client ["read"]) (. client (read name values)) undefined)))
           "subscribe" (fn [name values callback] (-/assertClientOperation key name false) (return (. client (subscribe name values callback))))}))
(defn.js createPageAdapter [key owner]
  (var spec (. (-/definition key) ["adapter"]))
  (when (not spec) (throw (new Error (+ "No page adapter: " key))))
  (. (Object.values spec) (forEach (fn [method]
    (when (not= (typeof (. owner [method])) "function") (throw (new Error (+ "Missing adapter method: " method)))))))
  (var closed false)
  (return {"owner" owner
           "snapshot" (fn [] (return (. (. owner [(. spec ["snapshot"])]) (call owner))))
           "subscribe" (fn [callback] (return (. (. owner [(. spec ["subscribe"])]) (call owner callback))))
           "attach" (fn [host] (:= closed false) (return (. (. owner [(. spec ["attach"])]) (call owner host))))
           "destroy" (fn [] (when (not closed) (:= closed true) (return (. (. owner [(. spec ["destroy"])]) (call owner)))))}))
(defn.js runLocalEffect [key name effect]
  (when (not (. (or (. (-/definition key) ["effects"]) []) (includes name)))
    (throw (new Error (+ "Undeclared page effect: " name))))
  (return (effect)))
(defn.js ^{:- [:async]} runPageResource [key name]
  (var resource (. (or (. (-/definition key) ["resources"]) {}) [name]))
  (when (not resource) (throw (new Error (+ "Undeclared page resource: " name))))
  (var response (await (fetch (. resource ["path"]) {"cache" "no-store"})))
  (return (:? (. response ["ok"]) (await (. response (json))) nil)))

(defn.js runCompatibility [key name handler args]
  (when (not (. (or (. (-/definition key) ["adapters"]) []) (includes name)))
    (throw (new Error (+ "Undeclared compatibility adapter: " name))))
  (return (. handler (apply nil args))))
