# Insight

A self-hosted analytics agent: people ask questions about a database in plain language and get answers, tables and charts. It started as a fork of an Apache-licensed open-source project, with the paid Enterprise features rebuilt and switched on. See [NOTICE](NOTICE) for where it came from and what was written for Insight.

## Features, all on with no licence key

| Feature                                                                                                  | Key                  | Configure                                             |
| -------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------- |
| Company sign-in (OIDC: Okta, Auth0, Keycloak…; Microsoft Entra) with roles from identity-provider groups | `sso`                | `OIDC_*` or `AZURE_AD_*` env vars, see `.env.example` |
| Company branding: name, tab title, logo, favicon, colour                                                 | `white-label`        | Settings → Appearance → Branding                      |
| Spend limits per member, per user group, or a default                                                    | `user-budget`        | Settings → Project → Budget → Advanced                |
| More than 3 custom user groups                                                                           | `user-groups`        | Settings → Project → User groups                      |
| Excluded columns the agent may never query                                                               | `exclude-columns`    | `exclude_columns` in `insight_config.yaml`            |
| Row-level security per user group                                                                        | `row-level-security` | Settings → Project → User groups                      |
| Warehouse queries run with the signed-in user's own Microsoft token                                      | part of `sso`        | `AZURE_AD_TOKEN_SCOPE`                                |

To switch a feature off, list its key in `INSIGHT_DISABLED_FEATURES` (comma-separated) and restart. `INSIGHT_ORGANIZATION_NAME` sets the name shown on the Features page.

## Database connections from the web app

Settings → Project → Databases lets admins and context admins add, test, sync, edit and delete connections. Types available: PostgreSQL, MySQL, SQL Server, Oracle, SQLite, MariaDB, Snowflake, BigQuery, Amazon Redshift and Databricks, plus ClickHouse, DuckDB, MotherDuck, Trino and Athena. Anyone in the project can see the list.

- **Credentials:** passwords, tokens and keys are encrypted in the app database (AES-256-GCM, keyed from `BETTER_AUTH_SECRET`, so keep that secret stable). The browser never receives them again. They reach the database driver only as per-request environment variables.
- **Config file:** connections are written to `insight_connections.yaml` next to `insight_config.yaml`, with secrets only as `{{ env('…') }}` references. Hand-written entries in `insight_config.yaml` keep working, and win if a name clashes.
- **Sync:** "Add and sync" and the Sync button read the tables, so the agent knows them. Deleting a connection also removes its synced table descriptions.
- **Drivers:** `build.sh` installs every driver. MySQL/MariaDB needs `pkg-config` and `mysql-client`. SQL Server also needs unixODBC and Microsoft's ODBC Driver 18, which you install yourself under Microsoft's licence.

## Build and install

Needs Node 22+, npm, [Bun](https://bun.sh), [uv](https://docs.astral.sh/uv/) and Python 3.12+.

```sh
./build.sh /path/to/your/.venv
```

This builds the web app, compiles the server with Bun, packages both as the `insight-core` Python wheel (`cli/dist/`), and installs it with the DuckDB and Anthropic extras. Once the wheel is built, another machine with the same OS and CPU can install it with `pip install insight_core-1.0.0-py3-none-any.whl[duckdb,anthropic]`.

## Use it in a project

```sh
insight init              # creates insight_config.yaml, RULES.md and the context folders
insight debug             # checks the database and the AI provider
insight sync              # writes the table descriptions the agent works from
insight chat --port 5005  # the chat app; DB_URI=sqlite:/abs/path/app.sqlite keeps its own data outside the package
```

The CLI is `insight`, each project is configured in `insight_config.yaml`, and the server's environment variables start with `INSIGHT_`.

## Web access

The agent can browse the web through [Obscura](https://github.com/h4ckf0r0day/obscura), a headless browser connected as an MCP server by default. The Docker image includes it. For `insight chat`, put the `obscura` binary on your `PATH`; without it the server is simply left out. Admins can turn it off per project in Settings → Project → MCP, and declaring `obscura` in `agent/mcps/mcp.json` replaces the default. It is not available in cloud mode, which only allows HTTP MCP servers.

## Tests

The upstream test suites are kept, and the rebuilt features pass the upstream Apache-licensed tests for them.

```sh
cd apps/backend && bun scripts/db.migrate.ts && npx vitest run
cd apps/frontend && NODE_OPTIONS=--no-experimental-webstorage npx vitest run   # the flag is only needed on Node 25+
```

Results as of the fork:

- **Backend:** 2,473 of 2,484 tests pass.
    - `sandbox-runtime` needs Linux. It fails the same way upstream on macOS.
    - Two heavy suites can time out at 5 seconds under full parallel load. They pass when run alone.
- **Frontend:** 702 of 702 tests pass.
