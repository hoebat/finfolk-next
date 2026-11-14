(ns finfolkdb.common.type-directory-base-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.behavior :as fixture]))
(l/script- :postgres
  {:runtime :jdbc.client
   :config (local/config)
   :require [[finfolkdb.main.scaffold-001-entity :as main]
             [postgres.core :as pg]
             [finfolkdb.common.type-directory-base :as t]
             [finfolkdb.fn.directory.directory-manage :as directory]
             [finfolkdb.common.type-user-access :as access]
             [finfolkdb.common.type-user :as users]
             [finfolkdb.common.type-user-activity :as activity]]})
(fact:global {:setup [(local/setup!)] :teardown [(local/teardown!)]})

^{:refer finfolkdb.common.type-directory-base/DirectoryListing :id publication-privacy}
(fact "candidate listings stay private and publication never exposes internal notes"
  (fixture/member "6fa348fb-6bac-5532-909c-3ebade0d86f1")
  (let
    [listing (directory/insert-directory-listing
              {:name "Ocean School"
               :category "School"
               :state "VIC"
               :locality "Portsea"
               :sources []
               :socials ["instagram:ocean"]
               :notes "PRIVATE_NOTE"}
              (fixture/op "create-listing" "6fa348fb-6bac-5532-909c-3ebade0d86f1"))
     id (:id listing)]
    (:status listing) => "candidate"
    (directory/ret-directory-public id) => nil
    (pg/t:update t/DirectoryListing
      {:track {} :where {:id id} :set {:status "published" :notes "PRIVATE_NOTE"}})
    (:name (directory/ret-directory-public id)) => "Ocean School"
    (:notes (directory/ret-directory-public id)) => nil
    (:socials (directory/ret-directory-public id)) => ["https://www.instagram.com/ocean/"]
    (:managed (directory/ret-directory-public id)) => false
    (pg/t:insert access/AccessRole
      {:class-table "DirectoryListing"
       :class-context "Global"
       :access (:access-id listing)
       :member "6fa348fb-6bac-5532-909c-3ebade0d86f1"
       :level "owner"}
      {:track {}})
    (:managed (directory/ret-directory-public id)) => true
    (pg/t:update access/AccessRole
      {:track {} :where {:access (:access-id listing)} :set {:is-active false}})
    (:managed (directory/ret-directory-public id)) => false))

^{:refer finfolkdb.common.type-directory-base/DirectoryReport :id author-deletion}
(fact "reports retain their message when the optional author is removed"
  (fixture/member "54de46ea-1c90-5117-9d88-b64bd0337386")
  (let
    [listing (directory/insert-directory-listing
              {:name "Reported school"}
              (fixture/op "create-listing" "54de46ea-1c90-5117-9d88-b64bd0337386"))
     report (pg/t:insert t/DirectoryReport
              {:listing (:id listing)
               :author "54de46ea-1c90-5117-9d88-b64bd0337386"
               :message "Correct this address"}
              {:track {}})]
    (:resolved report) => false
    (pg/t:delete activity/ActivityLog {:where {:actor "54de46ea-1c90-5117-9d88-b64bd0337386"}})
    (pg/t:delete users/User {:where {:id "54de46ea-1c90-5117-9d88-b64bd0337386"}})
    (:author-id (pg/t:get t/DirectoryReport {:where {:id (:id report)}})) => nil
    (:message (pg/t:get t/DirectoryReport {:where {:id (:id report)}})) => "Correct this address"))

^{:refer finfolkdb.common.type-directory-base/DirectoryRun :id import-record}
(fact "directory import runs preserve their input and completion state"
  (let [run (pg/t:insert t/DirectoryRun {:query "Portsea dive schools"} {:track {}})]
    (:status run) => "running"
    (pg/t:update t/DirectoryRun {:track {} :where {:id (:id run)} :set {:status "complete"}})
    (select-keys (pg/t:get t/DirectoryRun {:where {:id (:id run)}}) [:query :status])
    =>
    {:query "Portsea dive schools" :status "complete"}))
