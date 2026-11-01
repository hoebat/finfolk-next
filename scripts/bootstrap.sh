#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -z "${JAVA_HOME:-}" && -d /opt/homebrew/opt/openjdk@27/libexec/openjdk.jdk/Contents/Home ]]; then
  export JAVA_HOME=/opt/homebrew/opt/openjdk@27/libexec/openjdk.jdk/Contents/Home
fi
if [[ -d '/Applications/GitHub Desktop.app/Contents/Resources/app/git/libexec/git-core' ]]; then
  mkdir -p .cache/tools
  ln -sf "/Applications/GitHub Desktop.app/Contents/Resources/app/git/libexec/git-core/git-lfs" .cache/tools/git-lfs
  export PATH="$PWD/.cache/tools:$PATH"
fi
git submodule update --init ref/foundation
[[ "$(git -C ref/foundation rev-parse HEAD)" == f60ecc0c30247190fd3a1ea86973563c8f9501ac ]] || { echo 'Foundation revision differs from project.version' >&2; exit 1; }
git lfs install --local
if git rev-parse --verify HEAD >/dev/null 2>&1; then git lfs pull; fi
(cd ref/foundation && lein with-profile -dev run -m clojure.main ../../scripts/bootstrap_foundation.clj)
lein deps
lein generate
corepack yarn install --immutable
node scripts/bundle_backbone.mjs
if [[ ! -d .venv ]]; then
  if command -v python3.12 >/dev/null; then python3.12 -m venv .venv
  elif command -v python3.13 >/dev/null; then python3.13 -m venv .venv
  else python3 -m venv .venv; fi
fi
.venv/bin/python -m pip install -r requirements.txt
