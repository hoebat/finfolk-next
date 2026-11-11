(ns finfolkdb.common.type-site-base-test
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
             [finfolkdb.common.type-site-base :as t] [postgres.core :as pg]]})

(fact:global {:setup [(local/setup!)]
              :teardown [(local/teardown!)]})

^{:refer finfolkdb.common.type-site-base/SiteCatalog :added "0.1"}
(fact "SiteCatalog persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-site-base/SiteCatalog)
  => true)

^{:refer finfolkdb.common.type-site-base/SiteProfile :added "0.1"}
(fact "SiteProfile persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-site-base/SiteProfile)
  => true)

^{:refer finfolkdb.common.type-site-base/SiteImport :added "0.1"}
(fact "SiteImport persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-site-base/SiteImport)
  => true)

^{:refer finfolkdb.common.type-site-base/SiteRevision :added "0.1"}
(fact "SiteRevision persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-site-base/SiteRevision)
  => true)

^{:refer finfolkdb.common.type-site-base/SiteAccessPoint :added "0.1"}
(fact "SiteAccessPoint persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-site-base/SiteAccessPoint)
  => true)

^{:refer finfolkdb.common.type-site-base/SiteDepthEvidence :added "0.1"}
(fact "SiteDepthEvidence persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-site-base/SiteDepthEvidence)
  => true)

^{:refer finfolkdb.common.type-site-base/SiteDepthDataset :added "0.1"}
(fact "SiteDepthDataset persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-site-base/SiteDepthDataset)
  => true)

^{:refer finfolkdb.common.type-site-base/SiteTideStation :added "0.1"}
(fact "SiteTideStation persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-site-base/SiteTideStation)
  => true)