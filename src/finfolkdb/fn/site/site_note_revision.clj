(ns finfolkdb.fn.site.site-note-revision
  (:require [lang.core :as l]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-site-note :as notes]
             [finfolkdb.common.type-system-base :as system]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

(defn.pg site-note-version
  [:uuid i-rev]
  (let [o-rev (pg/t:get system/Rev
                {:where {:class-table "SiteNote" :class-context "Global" :id i-rev}})]
    (when [o-rev :is-null]
      (return nil))
    (return (pg/jsonb-build-object "revision" (:-> o-rev "index")))))

(defn.pg insert-site-note
  "Initialize the note and its revision stream in the caller's transaction."
  [:uuid i-id :uuid i-site :uuid i-author :text i-topic :text i-body :date i-observed :jsonb o-op]
  (let [o-current (pg/jsonb-build-object "site_id" i-site
                                         "author_id" i-author
                                         "topic" i-topic
                                         "body" i-body
                                         "observed_on" i-observed
                                         "withdrawn" false
                                         "hidden" false)
        o-rev (pg/t:insert system/Rev
                {:class-table "SiteNote"
                 :class-context "Global"
                 :class-ref i-id
                 :index 1
                 :current o-current}
                {:track o-op})
        o-log (pg/t:insert system/RevLog
                {:class-table "SiteNote"
                 :class-context "Global"
                 :rev (pg/id o-rev)
                 :version 1
                 :deltas o-current}
                {:track o-op})
        o-note (pg/t:insert notes/SiteNote
                 {:id i-id
                  :site i-site
                  :author i-author
                  :rev (pg/id o-rev)
                  :topic i-topic
                  :body i-body
                  :observed-on i-observed}
                 {:track o-op})]
    (return (|| o-note (-/site-note-version (pg/id o-rev))))))

(defn.pg record-site-note-revision
  [:uuid i-note :jsonb o-op]
  (let [o-note (pg/t:get notes/SiteNote {:where {:id i-note} :for [:update]})
        (:uuid v-rev) (:uuid (:->> o-note "rev_id"))
        o-rev (pg/t:get system/Rev
                {:where {:class-table "SiteNote" :class-context "Global" :id v-rev} :for [:update]})
        o-current (pg/t:get notes/SiteNote
                    {:where {:id i-note}
                     :returning #{:site :author :topic :body :observed-on :hidden :withdrawn}})
        (:integer v-version) (+ (:integer (:->> o-rev "index")) 1)
        o-saved (pg/t:update system/Rev
                  {:where {:class-table "SiteNote" :class-context "Global" :id v-rev}
                   :set {:index v-version :current o-current}
                   :track o-op})
        o-log (pg/t:insert system/RevLog
                {:class-table "SiteNote"
                 :class-context "Global"
                 :rev v-rev
                 :version v-version
                 :deltas o-current}
                {:track o-op})]
    (return (pg/jsonb-build-object "revision" v-version))))
