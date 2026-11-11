(ns finfolkdb.common.type-social-base-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.jdbc :as jdbc]
            [finfolkbuild.testing.common :as common]
            [finfolkbuild.testing.behavior :as fixture]))

(l/script- :postgres
  {:runtime :jdbc.client
   :config (local/config)
   :require [[finfolkdb.main.scaffold-001-entity :as main]
             [finfolkdb.common.type-social-base :as t] [postgres.core :as pg]]})

(fact:global {:setup [(local/setup!)]
              :teardown [(local/teardown!)]})

^{:refer finfolkdb.common.type-social-base/Social :added "0.1"}
(fact "Social persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-social-base/Social)
  => true)

^{:refer finfolkdb.common.type-social-base/EnumSocialHandleType :added "0.1"}
(fact "EnumSocialHandleType labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-social-base/EnumSocialHandleType))
  => true)

^{:refer finfolkdb.common.type-social-base/SocialHandle :added "0.1"}
(fact "SocialHandle persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-social-base/SocialHandle)
  => true)

^{:refer finfolkdb.common.type-social-base/ret-social-url :added "0.1"}
(fact "ret-social-url executes directly on local PostgreSQL"
  (t/ret-social-url "instagram:alice") => "https://www.instagram.com/alice/" (t/ret-social-url "other:alice") => nil)

^{:refer finfolkdb.common.type-social-base/ret-social-urls :added "0.1"}
(fact "ret-social-urls executes directly on local PostgreSQL"
  (t/ret-social-urls "[\"instagram:alice\",\"other:x\"]") => ["https://www.instagram.com/alice/"])