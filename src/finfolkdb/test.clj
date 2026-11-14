(ns finfolkdb.test
  "Run active DB contracts with a failing exit status for namespace load errors."
  (:require [code.test :as test]
            [code.test.base.context :as context]
            [code.test.base.executive :as executive]
            [finfolkbuild.testing.scaffold-common :as common]
            [finfolkbuild.testing.local :as local]))

(def TEST_NAMESPACES
  '[finfolkbuild.testing.local-test finfolkdb.schema.type-namespaces-test
    finfolkdb.schema.entity-catalog-test finfolkdb.schema.messaging-catalog-test])

(def LEGACY_TEST_NAMESPACES
  '[finfolkdb.common.fn-system-auth-test finfolkdb.fn.member.member-profile-test])

(defn checked-run!
  [modules]
  (let [result (test/run modules)]
    (when (or (seq (:errored @executive/+latest+))
              (pos? (or (:skipped result) 0))
              (not (pos? (or (:passed result) 0)))
              (some pos? (map #(or (get result %) 0) [:throw :failed :timeout])))
      (throw (ex-info "Database behavior tests failed" {:modules modules :result result})))
    result))

(defn -main
  [& args]
  (try
    ;; The upstream CLI omits namespace-load errors from its exit status.
    ;; Require first so unreadable or unresolvable types fail this command.
    (let [modules (case (vec args)
                    ["--common"] (common/test-namespaces)
                    ["--application-contracts"] '[finfolk-web.groups-test finfolkdb.catalog-test]
                    ["--common-contracts"] '[finfolkdb.schema.common-contracts-test]
                    ["--legacy"] LEGACY_TEST_NAMESPACES
                    [] TEST_NAMESPACES
                    (if (and (= "--common" (first args))
                             (= 2 (count args))
                             (some #{(symbol (second args))} (common/test-namespaces)))
                      [(symbol (second args))]
                      (throw (ex-info "Unknown database test selection" {:args args}))))]
      (when (= "--common" (first args))
        (common/check-coverage!)
        (local/acquire!))
      (when-not (= "--common" (first args))
        (binding [context/*eval-mode* false] (doseq [module modules] (require module))))
      (binding [local/*suite* (= "--common" (first args))]
        (if local/*suite*
          (do (doseq [module modules] (checked-run! [module]))
              (println "LOCAL_BEHAVIOR_PASS:" (count modules) "namespaces"))
          (checked-run! modules))))
    (finally (local/release!) (shutdown-agents))))
