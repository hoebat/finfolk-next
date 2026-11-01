ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
.DEFAULT_GOAL := help
JAVA_HOME ?= $(shell test ! -d /opt/homebrew/opt/openjdk@27/libexec/openjdk.jdk/Contents/Home || echo /opt/homebrew/opt/openjdk@27/libexec/openjdk.jdk/Contents/Home)
export JAVA_HOME
export PYTHON := $(ROOT)/.venv/bin/python
export WRANGLER_SEND_METRICS := false
.PHONY: help bootstrap generate check-generated test test-db test-browser build dev deploy deploy-api db-release
help:
	@echo 'bootstrap generate check-generated test test-db test-browser build dev deploy db-release'
bootstrap:
	bash scripts/bootstrap.sh
generate:
	lein generate
	node scripts/bundle_backbone.mjs
check-generated:
	node scripts/check_generated.mjs
test:
	lein test :only finfolk-web.groups-test
	lein test :only finfolkdb.catalog-test
	$(PYTHON) -m unittest discover -s tests -v
	corepack yarn test
test-db:
	node scripts/test_database.mjs
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
