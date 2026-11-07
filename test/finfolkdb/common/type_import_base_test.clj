(ns finfolkdb.common.type-import-base-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.neon :as neon]
            [finfolkbuild.testing.jdbc :as jdbc]
            [finfolkbuild.testing.common :as common]
            [finfolkbuild.testing.behavior :as fixture]))

(l/script- :postgres
  {:runtime :jdbc.client
   :config (neon/config)
   :require [[finfolkdb.main.scaffold-001-entity :as main] [finfolkdb.common.type-import-base :as t] [postgres.core :as pg]]})

(fact:global {:setup [(neon/setup!)]
              :teardown [(neon/teardown!)]})

^{:refer finfolkdb.common.type-import-base/EnumDataAssetKind :added "0.1"}
(fact "EnumDataAssetKind labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-import-base/EnumDataAssetKind))
  => true)

^{:refer finfolkdb.common.type-import-base/DatabaseRelease :added "0.1"}
(fact "DatabaseRelease persists linked data and rejects missing parents atomically"
  (fixture/persisted! 'finfolkdb.common.type-import-base/DatabaseRelease)
  => true)

^{:refer finfolkdb.common.type-import-base/DataAsset :added "0.1"}
(fact "DataAsset persists linked data and rejects missing parents atomically"
  (fixture/persisted! 'finfolkdb.common.type-import-base/DataAsset)
  => true)

^{:refer finfolkdb.common.type-import-base/GeoArea :added "0.1"}
(fact "GeoArea persists linked data and rejects missing parents atomically"
  (fixture/persisted! 'finfolkdb.common.type-import-base/GeoArea)
  => true)

^{:refer finfolkdb.common.type-import-base/GeoFeature :added "0.1"}
(fact "GeoFeature persists linked data and rejects missing parents atomically"
  (fixture/persisted! 'finfolkdb.common.type-import-base/GeoFeature)
  => true)

^{:refer finfolkdb.common.type-import-base/SiteLocation :added "0.1"}
(fact "SiteLocation persists linked data and rejects missing parents atomically"
  (fixture/persisted! 'finfolkdb.common.type-import-base/SiteLocation)
  => true)

^{:refer finfolkdb.common.type-import-base/DepthDatasetAsset :added "0.1"}
(fact "DepthDatasetAsset persists linked data and rejects missing parents atomically"
  (fixture/persisted! 'finfolkdb.common.type-import-base/DepthDatasetAsset)
  => true)

^{:refer finfolkdb.common.type-import-base/GeoBoundary :added "0.1"}
(fact "GeoBoundary persists linked data and rejects missing parents atomically"
  (fixture/persisted! 'finfolkdb.common.type-import-base/GeoBoundary)
  => true)