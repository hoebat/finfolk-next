(ns finfolkdb.fn.user.user-manage-posts
  "Typed social post creation and public projection."
  (:require [lang.core :as l]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-social-post :as tsp]
             [finfolkdb.common.fn-system-util :as util]
             [finfolkdb.fn.helper.helper-entity :as he]
             [finfolkdb.fn.helper.helper-access :as ha]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

;;
;; SocialPost Creation
;;

(defn.pg insert-social-post
  "Consent is explicit; neither insertion nor consent grants moderation approval."
  [:uuid i-owner :uuid i-beach :text i-url :text i-platform :text i-handle :boolean i-consent :jsonb
   o-op]
  (let [(:uuid v-id) (pg/uuid-generate-v4)
        o-base (he/insert-base-addons "SocialPost"
                                      v-id
                                      (pg/jsonb-build-object "url" i-url "platform" i-platform)
                                      o-op)
        o-post (pg/t:insert tsp/SocialPost
                 {:id v-id
                  :owner i-owner
                  :beach i-beach
                  :url i-url
                  :platform i-platform
                  :creator-handle i-handle
                  :public-consent i-consent
                  :rev (:uuid (:->> o-base "rev"))
                  :audit (:uuid (:->> o-base "audit"))}
                 {:track o-op})]
    (return o-post)))

;;
;; Public Post Read
;;

(defn.pg ret-social-post-public
  "A pending/withdrawn post, deleted owner or blocked relationship yields no data."
  [:uuid i-post-id :uuid i-viewer]
  (let [o-post (pg/t:get tsp/SocialPost
                 {:where {:id i-post-id :status "approved" :public-consent true}
                  :returning #{:id :owner :beach :url :platform :creator-handle :time-created}})
        (:uuid v-owner) (:uuid (:->> o-post "owner_id"))]
    (when (or [o-post :is-null]
              (not (ha/is-user-active v-owner))
              (ha/is-user-blocked i-viewer v-owner))
      (return nil))
    (return (pg/jsonb-build-object "id" (:uuid (:->> o-post "id"))
                                   "beach_id" (:uuid (:->> o-post "beach_id"))
                                   "url" (:->> o-post "url")
                                   "platform" (:->> o-post "platform")
                                   "creator_handle" (:->> o-post "creator_handle")
                                   "created_at" (util/as-iso-time
                                                 (:bigint (:->> o-post "time_created")))))))
