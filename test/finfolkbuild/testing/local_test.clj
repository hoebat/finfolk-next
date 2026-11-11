(ns finfolkbuild.testing.local-test
  (:use code.test)
  (:require [finfolkbuild.testing.local :as local]))

(fact "schema-reset fixtures reject remote hosts, normal databases and URL overrides"
  (every? (fn [url]
            (try (local/parse-config url) false
                 (catch clojure.lang.ExceptionInfo _ true)))
          ["postgresql://test:secret@example.com/finfolk_test_demo"
           "postgresql://test:secret@localhost/postgres"
           "postgresql://test:secret@localhost/finfolk"
           "postgresql://test:secret@localhost/finfolk_test_demo?host=example.com"
           "postgresql://test:secret@localhost/finfolk_test_demo#fragment"
           "https://test:secret@localhost/finfolk_test_demo"])
  => true)

(fact "local runtime preserves encoded credentials and explicit ports"
  (select-keys (local/parse-config "postgresql://test%2Buser:p%3Ass%2Bword@127.0.0.1:55432/finfolk_test_demo")
               [:host :port :dbname :user :pass])
  => {:host "127.0.0.1" :port 55432 :dbname "finfolk_test_demo"
      :user "test+user" :pass "p:ss+word"})

(fact "an omitted port uses PostgreSQL's default"
  (:port (local/parse-config "postgresql://test:secret@localhost/finfolk_test_demo"))
  => 5432)
