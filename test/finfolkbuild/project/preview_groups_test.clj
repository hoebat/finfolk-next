(ns finfolkbuild.project.preview-groups-test
  (:require [app.manage.server :as server] [finfolkbuild.project.management :as project])
  (:use code.test))

^{:id preview-group-contract}
(fact "group definitions preserve app-specific labels and order"
  (server/preview-groups {:preview-groups [{:id :second :label "My workflow"} {:id :first :label "Custom app"}]})
  => [{:id "second" :label "My workflow"} {:id "first" :label "Custom app"}]
  (server/preview-groups {}) => [])

^{:id preview-group-validation}
(fact "duplicate and unknown groups are rejected"
  (try (server/preview-groups {:preview-groups [{:id :x} {:id :x}]}) :failed (catch Exception _ :rejected)) => :rejected
  (try (server/preview-index {:previews [{:id :screen :target :web :url "http://127.0.0.1:3010" :group :unknown}]} [{:id "web"}]) :failed (catch Exception _ :rejected)) => :rejected)

^{:id finfolk-preview-membership}
(fact "every current FinFolk preview has a declared group and a unique id"
  (let [previews (:previews project/PROJECT) groups (set (map :id project/PREVIEW-GROUPS))]
    [(every? #(groups (:group %)) previews) (= (count previews) (count (distinct (map :id previews))))])
  => [true true])
