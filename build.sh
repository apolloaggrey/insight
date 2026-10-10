#!/usr/bin/env bash
# Builds Insight from source and installs it into a Python virtualenv.
#   ./build.sh                 -> installs into ../.venv (the analytics folder's venv)
#   ./build.sh /path/to/.venv  -> installs into that venv
# Needs: Node 22+, npm, Bun, uv, Python 3.12+.
set -euo pipefail
cd "$(dirname "$0")"
VENV="${1:-../.venv}"

[ -d "$VENV" ] || uv venv -q --python 3.12 "$VENV"
VENV="$(cd "$VENV" && pwd)"
HUSKY=0 npm ci --no-audit --no-fund --engine-strict=false
npm install-scripts approve esbuild better-sqlite3 core-js fsevents unrs-resolver >/dev/null 2>&1 || true
npm rebuild esbuild better-sqlite3 unrs-resolver >/dev/null
uv pip install -q --python "$VENV/bin/python" cyclopts
(cd cli && "$VENV/bin/python" build.py --force)
# MySQL/MariaDB needs the MySQL client headers (macOS: brew install pkg-config mysql-client);
# SQL Server needs unixODBC plus Microsoft's ODBC Driver 18, installed separately under its licence.
command -v brew >/dev/null && export PKG_CONFIG_PATH="$(brew --prefix mysql-client 2>/dev/null)/lib/pkgconfig:${PKG_CONFIG_PATH:-}"
# Install against the versions the test suites ran on (cli/uv.lock), not whatever is newest.
(cd cli && uv export --frozen --no-hashes --all-extras --no-emit-project --no-dev -o constraints.txt >/dev/null)
uv pip install -q --python "$VENV/bin/python" --reinstall -c cli/constraints.txt "$(ls cli/dist/*.whl)[all-databases,anthropic]"
echo "Installed: $("$VENV/bin/insight" --version)"
