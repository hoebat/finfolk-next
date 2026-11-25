# Archived compatibility fixtures

These SQL files support isolated tests of the retired application schema. Their
provider-specific identity references have been normalized to the synthetic
`legacy_auth` test schema. They are not a production upgrade path.

Current releases install SQL generated from `src/finfolkdb`, published under
`resources/finfolkdb`. The fixture runner `scripts/migrate_legacy_fixtures.mjs`
refuses remote databases and accepts only disposable local `finfolk_test_*`
databases. Never replay these fixtures against deployed data.
