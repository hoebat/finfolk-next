ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
.DEFAULT_GOAL := help
JAVA_HOME ?= $(shell test ! -d /opt/homebrew/opt/openjdk@27/libexec/openjdk.jdk/Contents/Home || echo /opt/homebrew/opt/openjdk@27/libexec/openjdk.jdk/Contents/Home)
export JAVA_HOME
export PYTHON := $(ROOT)/.venv/bin/python
export WRANGLER_SEND_METRICS := false
.PHONY: help bootstrap generate check-generated test test-db test-browser build dev deploy deploy-api db-release
help:
	@echo 'manage manage-preview manage-preview-native manage-plan manage-check manage-build demo-logbook build-page-verifier test-page-models test-native-account'
	@echo 'generate-db-sql generate-db-json check-generated-db-sql check-generated-db-json'
	@echo 'bootstrap generate check-generated test test-db test-browser build dev deploy db-release generate-db check-generated-db test-db-types scaffold-db-common test-db-common'
bootstrap:
	bash scripts/bootstrap.sh
generate:
	lein generate
	node scripts/bundle_backbone.mjs
check-generated:
	node scripts/check_generated.mjs
test:
	node --test tests/test_page_health.mjs
	node --test tests/test_local_supabase.mjs
	lein run -m finfolkdb.test --application-contracts
	lein run -m finfolkdb.test
	$(PYTHON) -m unittest discover -s tests -v
	corepack yarn test
	node tests/test_reference_assets.mjs
	node --test tests/test_dataset_release_client.mjs
	node tests/test_coastal_release.mjs
	node tests/test_account_return.mjs
	node tests/test_native_cutover.mjs
test-db:
	node scripts/test_database.mjs

.PHONY: test-db-notes
test-db-notes: generate-db
	node scripts/test_database.mjs --notes
test-browser:
	corepack yarn playwright test

.PHONY: check-pages
check-pages:
	node scripts/check_pages.mjs

.PHONY: test-page-health-workbench
test-page-health-workbench:
	lein $(LEIN_FLAGS) run -m clojure.main -e "(require '[app.manage.integration :as i]) (let [r (i/run! '[finfolkbuild.project.page-health-test])] (prn r) (shutdown-agents) (System/exit (if (= :ok (:status r)) 0 1)))"
build:
	corepack yarn build:next
dev:
	node scripts/dev.mjs
deploy-api:
	corepack yarn deploy:next:api
deploy: build deploy-api
	corepack yarn deploy:next
db-release:
	corepack yarn db:release:next

.PHONY: build-netlify dev-nextjs
build-netlify: build
	node scripts/prepare_nextjs.mjs
	corepack yarn workspace @finfolk/web-main build

dev-nextjs:
	corepack yarn workspace @finfolk/web-main dev

.PHONY: generate-db check-generated-db test-db-types
generate-db:
	lein run -m finfolkdb.build
check-generated-db:
	lein run -m finfolkdb.build --check
test-db-types: check-generated-db
	lein run -m finfolkdb.test
	node scripts/test_database.mjs --types

.PHONY: test-db-messaging
test-db-messaging: test-db-social

.PHONY: scaffold-db-common test-db-common
scaffold-db-common:
	lein run -m finfolkbuild.testing.scaffold-common
test-db-common: check-generated-db
	node scripts/test_database.mjs --clojure-common $(DB_TEST_NAMESPACE)

.PHONY: neon-test-setup
neon-test-setup:
	node scripts/neon_test_setup.mjs

.PHONY: test-finnies test-finnies-neon
test-finnies: generate-db
	node scripts/test_database.mjs --finnies
test-finnies-neon: generate-db
	FINFOLK_FINNIES_TEST_NEON=1 node tests/db/finnies.mjs

.PHONY: prepare-db-rebuild verify-db-rebuild test-db-rebuild test-db-rebuild-data
prepare-db-rebuild: check-generated-db
	node scripts/rebuild_database.mjs prepare
verify-db-rebuild:
	node scripts/rebuild_database.mjs verify
test-db-rebuild: check-generated-db
	node scripts/test_database.mjs --rebuild
test-db-rebuild-data: prepare-db-rebuild
	FINFOLK_REBUILD_REAL_DATA=1 node scripts/test_database.mjs --rebuild

.PHONY: test-reference-assets
test-reference-assets:
	node tests/test_reference_assets.mjs

# A long-lived disposable server for individual code.test facts in a REPL.
.PHONY: test-db-local-up test-db-local-down test-db-local-status test-db-runtime
test-db-local-up:
	node scripts/local_supabase.mjs up
test-db-local-down:
	node scripts/local_supabase.mjs down

test-db-local-status:
	node scripts/local_supabase.mjs status
test-db-runtime:
	node --test tests/test_local_supabase.mjs

.PHONY: test-db-mock mock-social
test-db-mock: test-db-social
mock-social:
	node scripts/mock_social.mjs $(or $(ARGS),start)

.PHONY: test-db-note-revisions
test-db-note-revisions: check-generated-db
	node scripts/test_database.mjs --note-revisions

.PHONY: test-db-social
test-db-social: check-generated-db
	node scripts/test_database.mjs --clojure-social

.PHONY: test-app-integration
test-app-integration:
	lein run -m app.manage finfolkbuild.project.application/PROJECT test

# Whole-project app.manage UI and its existing Next.js application preview.
LEIN_FLAGS ?=
MANAGE_PORT ?= 8131
PREVIEW_PORT ?= 3010
export PREVIEW_PORT
.PHONY: manage manage-plan manage-check manage-build manage-preview
manage:
	lein $(LEIN_FLAGS) manage --port $(MANAGE_PORT)
manage-plan:
	lein $(LEIN_FLAGS) app plan
manage-check:
	lein $(LEIN_FLAGS) app check
manage-build:
	lein $(LEIN_FLAGS) app build
manage-preview: generate
	lein $(LEIN_FLAGS) run -m finfolkbuild.project.preview

.PHONY: generate-db-sql generate-db-json check-generated-db-sql check-generated-db-json
generate-db-sql:
	lein $(LEIN_FLAGS) run -m finfolkdb.build --sql
generate-db-json:
	lein $(LEIN_FLAGS) run -m finfolkdb.build --json
check-generated-db-sql:
	lein $(LEIN_FLAGS) run -m finfolkdb.build --sql --check
check-generated-db-json:
	lein $(LEIN_FLAGS) run -m finfolkdb.build --json --check

.PHONY: slice-status slice-logbook
slice-status:
	lein $(LEIN_FLAGS) run -m app.manage.slices finfolkbuild.project.management/PROJECT status
slice-logbook:
	lein $(LEIN_FLAGS) run -m app.manage.slices finfolkbuild.project.management/PROJECT build logbook backbone

.PHONY: demo-logbook
demo-logbook:
	lein $(LEIN_FLAGS) run -m clojure.main -e "(require '[app.manage :as m] '[finfolkbuild.project.management :as p]) (prn (m/generate p/PROJECT {:targets [:logbook-demo] :write true})) (shutdown-agents)"
	lein $(LEIN_FLAGS) run -m finfolkbuild.project.logbook-demo

.PHONY: check-logbook-demo
check-logbook-demo:
	lein $(LEIN_FLAGS) run -m app.manage.slices finfolkbuild.project.management/PROJECT build logbook demo

.PHONY: build-page-verifier test-page-models
build-page-verifier:
	lein $(LEIN_FLAGS) run -m clojure.main -e "(require '[app.manage :as m] '[finfolkbuild.project.management :as p]) (prn (m/generate p/PROJECT {:targets [:page-verifier] :write true})) (shutdown-agents)"
test-page-models: build-page-verifier
	lein $(LEIN_FLAGS) run -m app.manage.verify finfolkbuild.project.management/PROJECT run

.PHONY: page-migration-status check-page-migration
page-migration-status:
	lein $(LEIN_FLAGS) run -m finfolkbuild.project.page-coverage
check-page-migration:
	lein $(LEIN_FLAGS) run -m clojure.main -e "(require '[app.manage.integration :as i]) (let [r (i/run! '[finfolkbuild.project.page-coverage-test])] (prn r) (shutdown-agents) (System/exit (if (= :ok (:status r)) 0 1)))"

.PHONY: test-native-account
test-native-account: generate
	lein $(LEIN_FLAGS) run -m clojure.main -e "(require '[app.manage.integration :as i]) (let [r (i/run! '[finfolkbuild.project.native-account-test finfolkdb.schema.account-contracts-test])] (prn r) (shutdown-agents) (System/exit (if (= :ok (:status r)) 0 1)))"

.PHONY: manage-preview-native
manage-preview-native: generate
	lein $(LEIN_FLAGS) run -m finfolkbuild.project.native-preview
