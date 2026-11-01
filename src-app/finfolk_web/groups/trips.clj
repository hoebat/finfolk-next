(ns finfolk-web.groups.trips
  "Browser bindings for trips; HTTP permissions remain server-owned.")

(def OPERATIONS
 {"publicTrip" {"auth" false
 "domain" "trips"
 "method" "GET"
 "name" "publicTrip"
 "path" "/trips/:id"
 "transport" "rest"
 "write" false}
 "publicTrips" {"auth" false
 "domain" "trips"
 "method" "GET"
 "name" "publicTrips"
 "path" "/trips"
 "transport" "rest"
 "write" false}
 "tripDelete" {"auth" true
 "domain" "trips"
 "name" "tripDelete"
 "transport" "action"
 "write" true}
 "tripDives" {"auth" true
 "domain" "trips"
 "name" "tripDives"
 "transport" "action"
 "write" false}
 "tripGet" {"auth" true
 "domain" "trips"
 "name" "tripGet"
 "transport" "action"
 "write" false}
 "tripImportBatch" {"auth" true
 "domain" "trips"
 "name" "tripImportBatch"
 "transport" "action"
 "write" true}
 "tripImportBegin" {"auth" true
 "domain" "trips"
 "name" "tripImportBegin"
 "transport" "action"
 "write" true}
 "tripImportConfirm" {"auth" true
 "domain" "trips"
 "name" "tripImportConfirm"
 "transport" "action"
 "write" true}
 "tripList" {"auth" true
 "domain" "trips"
 "name" "tripList"
 "transport" "action"
 "write" false}
 "tripPreview" {"auth" true
 "domain" "trips"
 "name" "tripPreview"
 "transport" "action"
 "write" false}
 "tripPublish" {"auth" true
 "domain" "trips"
 "name" "tripPublish"
 "transport" "action"
 "write" true}
 "tripReport" {"auth" true
 "domain" "trips"
 "name" "tripReport"
 "transport" "action"
 "write" true}
 "tripReview" {"admin" true
 "auth" true
 "domain" "trips"
 "name" "tripReview"
 "transport" "action"
 "write" true}
 "tripReviewInbox" {"admin" true
 "auth" true
 "domain" "trips"
 "name" "tripReviewInbox"
 "transport" "action"
 "write" false}
 "tripSave" {"auth" true
 "domain" "trips"
 "name" "tripSave"
 "transport" "action"
 "write" true}
 "tripUnpublish" {"auth" true
 "domain" "trips"
 "name" "tripUnpublish"
 "transport" "action"
 "write" true}})
