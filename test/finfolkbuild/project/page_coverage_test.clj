(ns finfolkbuild.project.page-coverage-test
  (:require [finfolkbuild.project.page-coverage :as coverage]
            [finfolk-web.pages.registry :as registry])
  (:use code.test))
^{:refer finfolkbuild.project.page-coverage/inventory :added "0.1"}
(fact "every registered page belongs to exactly one migration group and requires an appropriate runtime verification strategy"
  (let [pages (coverage/inventory)]
    [(= (set (keys (registry/validate!))) (set (map :id pages)))
     (every? :group pages)
     (every? #(some (fn [c] (and (= "screen" (:member c)) (contains? #{"browser" "http" "artifact"} (:kind c)))) (:capabilities %)) pages)
     (set (map :group pages))])
  => [true true true #{:account :community :logbook :directory :events :atlas :content :social :finnies :shell}])
^{:refer finfolkbuild.project.page-coverage/contracts :added "0.1"}
(fact "an old transport declaration is never treated as native typed coverage"
  (let [entries (coverage/contracts)]
    [(pos? (count entries))
     (every? #(or (= :blocked (:status %))
                   (and (:native-rpc %) (:request-shape %) (:result-shape %))) entries)
     (:status (coverage/page-status "account"))])
  => [true true :unverified])
^{:id inventory-rejects-drift :added "0.1"}
(fact "new pages, removed pages and duplicate assignments cannot silently escape coverage"
  (let [original coverage/GROUPS
        rejected? (fn [groups]
                    (with-redefs [coverage/GROUPS groups]
                      (try (coverage/inventory) false (catch clojure.lang.ExceptionInfo _ true))))]
    [(rejected? (dissoc original :account))
     (rejected? (update original :account conj "nonexistent"))
     (rejected? (update original :account conj "logbook"))])
  => [true true true])
