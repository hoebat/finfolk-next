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
   :require [[finfolkdb.fn.user.user-manage :as fixture-user]
             [finfolkdb.fn.user.user-manage-logbook :as fixture-logbook]
             [finfolkdb.fn.social.social-manage :as fixture-social]
             [finfolkdb.common.type-site-base :as t]
             [postgres.core :as pg]]})

(fact:global {:setup [(local/prepare!) (l/rt:restart) (l/rt:teardown :postgres)
                      (l/rt:setup :postgres)]
              :teardown [(l/rt:teardown :postgres) (l/rt:stop) (local/cleanup!)]})

^{:refer finfolkdb.common.type-site-base/SiteCatalog :added "0.1"}
(fact "SiteCatalog persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-site-base/SiteCatalog) => true)

^{:refer finfolkdb.common.type-site-base/SiteProfile :added "0.1"}
(fact "SiteProfile persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-site-base/SiteProfile) => true)

^{:refer finfolkdb.common.type-site-base/SiteImport :added "0.1"}
(fact "SiteImport persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-site-base/SiteImport) => true)

^{:refer finfolkdb.common.type-site-base/SiteRevision :added "0.1"}
(fact "SiteRevision persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-site-base/SiteRevision) => true)

^{:refer finfolkdb.common.type-site-base/SiteAccessPoint :added "0.1"}
(fact "SiteAccessPoint persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-site-base/SiteAccessPoint) => true)

^{:refer finfolkdb.common.type-site-base/SiteDepthEvidence :added "0.1"}
(fact "SiteDepthEvidence persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-site-base/SiteDepthEvidence) => true)

^{:refer finfolkdb.common.type-site-base/SiteDepthDataset :added "0.1"}
(fact "SiteDepthDataset persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-site-base/SiteDepthDataset) => true)

^{:refer finfolkdb.common.type-site-base/SiteTideStation :added "0.1"}
(fact "SiteTideStation persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-site-base/SiteTideStation) => true)
