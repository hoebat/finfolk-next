(ns finfolkbuild.testing.mock
  (:require [lang.core :as l]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.mock-fixture :as fixture]
            [std.json :as json]))
(l/script- :postgres
  {:runtime :jdbc.client
   :config (local/config)
   :require [[finfolkdb.fn.social.social-interop :as interop]
             [finfolkdb.fn.social.social-events :as events]
             [finfolkdb.fn.social.social-delivery :as delivery]
             [finfolkdb.fn.user.user-manage :as user]
             [finfolkdb.fn.messaging.messaging-authorization :as auth]]})
(defn -main
  [& _]
  (binding [*ns* (the-ns 'finfolkbuild.testing.mock)]
    (try (local/prepare!)
         (l/rt:restart)
         (l/rt:setup :postgres)
         (println (str "MOCK_FIXTURE:" (json/write (fixture/create!))))
         (finally (local/release!) (shutdown-agents)))))
