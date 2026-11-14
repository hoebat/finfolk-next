(ns finfolkdb.common.type-social-instagram-test
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
             [finfolkdb.common.type-social-instagram :as t]
             [postgres.core :as pg]]})

(fact:global {:setup [(local/setup!)] :teardown [(local/teardown!)]})

^{:refer finfolkdb.common.type-social-instagram/InstagramSource :added "0.1"}
(fact "InstagramSource persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-social-instagram/InstagramSource) => true)

^{:refer finfolkdb.common.type-social-instagram/InstagramSuppressedSource :added "0.1"}
(fact "InstagramSuppressedSource persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-social-instagram/InstagramSuppressedSource) => true)

^{:refer finfolkdb.common.type-social-instagram/InstagramAction :added "0.1"}
(fact "InstagramAction persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-social-instagram/InstagramAction) => true)

^{:refer finfolkdb.common.type-social-instagram/InstagramAudit :added "0.1"}
(fact "InstagramAudit persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-social-instagram/InstagramAudit) => true)

^{:refer finfolkdb.common.type-social-instagram/InstagramConnection :added "0.1"}
(fact "InstagramConnection persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-social-instagram/InstagramConnection) => true)

^{:refer finfolkdb.common.type-social-instagram/InstagramClaim :added "0.1"}
(fact "InstagramClaim persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-social-instagram/InstagramClaim) => true)

^{:refer finfolkdb.common.type-social-instagram/InstagramCommentIdentity :added "0.1"}
(fact "InstagramCommentIdentity persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-social-instagram/InstagramCommentIdentity) => true)

^{:refer finfolkdb.common.type-social-instagram/InstagramDiscovery :added "0.1"}
(fact "InstagramDiscovery persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-social-instagram/InstagramDiscovery) => true)

^{:refer finfolkdb.common.type-social-instagram/InstagramDiscoveryAudit :added "0.1"}
(fact "InstagramDiscoveryAudit persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-social-instagram/InstagramDiscoveryAudit) => true)

^{:refer finfolkdb.common.type-social-instagram/InstagramPostReport :added "0.1"}
(fact "InstagramPostReport persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-social-instagram/InstagramPostReport) => true)

^{:refer finfolkdb.common.type-social-instagram/InstagramCommand :added "0.1"}
(fact "InstagramCommand persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-social-instagram/InstagramCommand) => true)

^{:refer finfolkdb.common.type-social-instagram/InstagramEvent :added "0.1"}
(fact "InstagramEvent persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-social-instagram/InstagramEvent) => true)

^{:refer finfolkdb.common.type-social-instagram/InstagramDmLimit :added "0.1"}
(fact "InstagramDmLimit persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-social-instagram/InstagramDmLimit) => true)

^{:refer finfolkdb.common.type-social-instagram/InstagramConnectCode :added "0.1"}
(fact "InstagramConnectCode persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-social-instagram/InstagramConnectCode) => true)

^{:refer finfolkdb.common.type-social-instagram/InstagramConnectLimit :added "0.1"}
(fact "InstagramConnectLimit persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-social-instagram/InstagramConnectLimit) => true)
