#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export NETLIFY=true
if [[ -z "${JAVA_HOME:-}" && -d /opt/homebrew/opt/openjdk@27/libexec/openjdk.jdk/Contents/Home ]]; then
  export JAVA_HOME=/opt/homebrew/opt/openjdk@27/libexec/openjdk.jdk/Contents/Home
fi
node -e 'const [major,minor]=process.versions.node.split(".").map(Number);if(major<22||(major===22&&minor<13))throw Error("Netlify build requires Node 22.13 or newer")'
python3 -c 'import sys; assert sys.version_info >= (3,12), "Netlify build requires Python 3.12 or newer; set PYTHON_VERSION=3.12"'
java_major="$("${JAVA_HOME:+$JAVA_HOME/bin/}java" -XshowSettings:properties -version 2>&1 | sed -n 's/^[[:space:]]*java.specification.version = //p')"
[[ "$java_major" =~ ^[0-9]+$ && "$java_major" -ge 25 ]] || { echo 'Netlify build requires JDK 25 or newer.' >&2; exit 1; }
tools="$PWD/.cache/build-tools"
mkdir -p "$tools/bin"
export PATH="$tools/bin:$PWD/.cache/tools:$PATH"
if ! command -v lein >/dev/null 2>&1; then
  curl --fail --location --silent --show-error --retry 3 --max-time 60 https://raw.githubusercontent.com/technomancy/leiningen/2.12.0/bin/lein -o "$tools/bin/lein.download"
  python3 - "$tools/bin/lein.download" <<'PY'
import hashlib, pathlib, sys
assert hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest() == 'f8e1266c0c78c08bd4af6e111889ecc316c9dd56d1e8645bbee6c1703d351bc3', 'Leiningen launcher checksum mismatch'
PY
  mv "$tools/bin/lein.download" "$tools/bin/lein"
  chmod +x "$tools/bin/lein"
fi
# Bootstrap checks the pinned Foundation commit and materializes LFS inputs,
# installs the repository's workspace/Python dependencies, and generates only.
bash scripts/bootstrap.sh
make check-generated
make build-netlify
