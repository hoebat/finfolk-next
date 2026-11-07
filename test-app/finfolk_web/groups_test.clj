(ns finfolk-web.groups-test
  (:require [finfolk-web.lib.operations :as operations]
            [finfolk-web.pages.routes :as routes]
            [finfolkbuild.db.legacy :as legacy])
  (:use code.test))
^{:id browser-contracts}
(fact "member writes and public reads retain their ownership boundaries"
  [(get-in operations/DEFINITIONS ["preferences" "auth"])
   (get-in operations/DEFINITIONS ["preferences" "write"])
   (get-in operations/DEFINITIONS ["checkin" "domain"])
   (get-in operations/DEFINITIONS ["publicTrips" "auth"])
   (get-in operations/DEFINITIONS ["messagingSettingsSave" "admin"])]
  => [true true "community" false true])
^{:id api-coverage}
(fact "the registry retains every owning group declaration without collisions"
  (let [groups [finfolk-web.groups.events/OPERATIONS finfolk-web.groups.directory/OPERATIONS
                finfolk-web.groups.admin/OPERATIONS finfolk-web.groups.community/OPERATIONS
                finfolk-web.groups.instagram/OPERATIONS finfolk-web.groups.invitations/OPERATIONS
                finfolk-web.groups.logbook/OPERATIONS finfolk-web.groups.member/OPERATIONS
                finfolk-web.groups.posts/OPERATIONS finfolk-web.groups.trips/OPERATIONS
                finfolk-web.groups.sites/OPERATIONS finfolk-web.groups.finnies/OPERATIONS
                finfolk-web.groups.site-notes/OPERATIONS]]
    [(= (count operations/DEFINITIONS) (reduce + (map count groups)))
     (= operations/DEFINITIONS (apply merge groups))]) => [true true])
^{:id deployed-sql}
(fact "site transactions are published with the member backbone"
  (clojure.string/includes? (legacy/sql) "FUNCTION finfolk_rpc.site_publish") => true)

(defn coverage-error [entries declared templates statics patterns aliases]
  (try (routes/validate-coverage! entries declared templates statics patterns aliases)
       (catch clojure.lang.ExceptionInfo error (.getMessage error))))
^{:id page-route-contracts}
(fact "route authoring cannot omit offline policy, compatibility ownership or alias destinations"
  [(coverage-error [{"path" "/one"}] {} {} [] {} [])
   (coverage-error [{"path" "/one"}] {"/one" {"kind" "screen"}} {} [] {} [])
   (coverage-error [{"path" "/one"}] {"/one" {"kind" "compatibility"}} {} [] {} [])
   (coverage-error [{"path" "/one"}] {"/one" {"kind" "screen"}} {} ["/one"] {} [{"destination" "/missing"}])]
  => ["Unregistered Next route" "Page has no offline policy" "Compatibility route has no adapter" "Alias points at an unregistered route"])
