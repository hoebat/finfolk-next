(ns finfolkdb.schema.logbook-demo
  "Infrastructure prerequisites for the disposable native logbook demo database.")
(def BOOTSTRAP
  "CREATE SCHEMA finfolk; CREATE SCHEMA finfolk_rpc; CREATE SCHEMA finfolk_demo; CREATE EXTENSION citext; CREATE EXTENSION pgcrypto; CREATE EXTENSION \"uuid-ossp\";")

(require '[lang.core :as l])
(l/script :postgres {:require [[postgres.core :as pg] [finfolkdb.common.type-user :as users]]
                     :static {:application ["finfolk-demo"] :all {:schema ["finfolk_demo"]}}})
(defn.pg ^{:- [:jsonb]} ret-demo-profile [:uuid i-user]
  (let [o-user (pg/t:get users/User {:where {:id i-user} :returning #{:id :profile}})]
    (return (|| (:-> o-user "profile") (pg/jsonb-build-object "id" i-user "uid" i-user)))))
