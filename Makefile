ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
.DEFAULT_GOAL := help
JAVA_HOME ?= $(shell test ! -d /opt/homebrew/opt/openjdk@27/libexec/openjdk.jdk/Contents/Home || echo /opt/homebrew/opt/openjdk@27/libexec/openjdk.jdk/Contents/Home)
export JAVA_HOME
export PYTHON := $(ROOT)/.venv/bin/python
export WRANGLER_SEND_METRICS := false
.PHONY: help bootstrap generate check-generated test test-db test-browser build dev deploy deploy-api db-release
help:
	@echo 'bootstrap generate check-generated test test-db test-browser build dev deploy db-release generate-db check-generated-db test-db-types scaffold-db-common test-db-common'
bootstrap:
	bash scripts/bootstrap.sh
generate:
	lein generate
	node scripts/bundle_backbone.mjs
check-generated:
	node scripts/check_generated.mjs
test:
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
test-db-messaging: check-generated-db
	node tests/test_messaging_preflight.mjs
	node tests/test_entity_messaging_worker.mjs
	node tests/test_messaging_transport.mjs
	node tests/test_messaging_authorization.mjs
	lein run -m finfolkdb.test
	node scripts/test_database.mjs --messaging

.PHONY: scaffold-db-common test-db-common
scaffold-db-common:
	lein run -m finfolkbuild.testing.scaffold-common
test-db-common: check-generated-db
	lein run -m finfolkdb.test --common

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
