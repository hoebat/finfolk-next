(ns finfolkdb.fn.directory.directory-manage
  "Typed directory lifecycle and public projections."
  (:require [lang.core :as l]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-seed :as tss]
             [finfolkdb.common.type-user-access :as tua]
             [finfolkdb.common.type-social-base :as tsoc]
             [finfolkdb.common.type-directory-base :as tdb]
             [finfolkdb.fn.helper.helper-entity :as he]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

;;
;; DirectoryListing Creation
;;

(defn.pg insert-directory-listing
  "Creates the directory entity and all addon providers atomically."
  [:jsonb i-document :jsonb o-op]
  (let [(:uuid v-id) (pg/uuid-generate-v4)
        o-document (tss/as-jsonb i-document)
        o-base (he/insert-base-addons "DirectoryListing" v-id o-document o-op)
        o-access (pg/t:insert tua/Access
                   {:class-table "DirectoryListing"
                    :class-context "Global"
                    :class-ref v-id
                    :setting "closed"}
                   {:track o-op})
        o-social
        (pg/t:insert tsoc/Social {:class-table "DirectoryListing" :class-ref v-id} {:track o-op})
        o-listing (pg/t:insert tdb/DirectoryListing
                    {:id v-id
                     :detail o-document
                     :rev (:uuid (:->> o-base "rev"))
                     :audit (:uuid (:->> o-base "audit"))
                     :access (pg/id o-access)
                     :social (pg/id o-social)}
                    {:track o-op :returning #{:*/standard :detail}})]
    (return o-listing)))

;;
;; Public Projection
;;

(defn.pg ret-directory-public
  "Returns the existing public fields without private addon or operational data."
  [:uuid i-listing-id]
  (let [o-listing (pg/t:get tdb/DirectoryListing
                    {:where {:id i-listing-id :status "published"}
                     :returning #{:id :detail :access :reviewed-at}})
        o-document (:-> o-listing "detail")
        (:boolean v-managed) (pg/t:exists tua/AccessRole
                               {:where {:class-table "DirectoryListing"
                                        :class-context "Global"
                                        :access (:uuid (:->> o-listing "access_id"))
                                        :level "owner"
                                        :is-active true}})]
    (when [o-listing :is-null]
      (return nil))
    (return (pg/jsonb-build-object "id" (:uuid (:->> o-listing "id"))
                                   "name" (:->> o-document "name")
                                   "category" (:->> o-document "category")
                                   "state" (:->> o-document "state")
                                   "country" (pg/coalesce (:->> o-document "country") "Australia")
                                   "locality" (:->> o-document "locality")
                                   "description" (:->> o-document "description")
                                   "website" (:->> o-document "website")
                                   "image" (pg/coalesce (:->> o-document "image") "")
                                   "sources" (:-> o-document "sources")
                                   "socials" (tsoc/ret-social-urls (:-> o-document "socials"))
                                   "managed" v-managed
                                   "reviewedAt" (:-> o-listing "reviewed_at")))))
