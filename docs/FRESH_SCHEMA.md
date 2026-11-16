# Native schema publication

The source of SQL is `src/finfolkdb/**/*.clj`. `finfolkdb.build/sql-artifacts`
compiles the current native entity/RPC declarations and adds the Clojure-authored
schema, enum, import, shop and privilege statements. SQL outputs are disposable
build artifacts, never source inputs.

```sh
make generate-db-sql          # seven SQL outputs
make generate-db-json         # six metadata/contract outputs
make check-generated-db-sql
make check-generated-db-json
```

`entity-schema.sql` is the current fresh native schema entrypoint. Its compiler
root is `finfolkdb.main.scaffold-001-entity`; typed tables and functions live in
`finfolkdb.common.*` and `finfolkdb.fn.*`. The other SQL files are composed by
`finfolkdb.schema.*` and `finfolkdb.shop`. Generation does not connect to a database.

The old `schema.sql`, `pilot.sql` and `site-schema.sql` snapshot inputs/outputs
and their copying generator are retired. Existing migration files are historical
records, not generation inputs. The older fresh-vs-migrated comparison and old
API tests describe that retired schema; native integration facts and native
cutover/rebuild checks validate the current model instead. No SQL snapshot hash
is treated as a constraint on editing the current Clojure definitions.

Installation requires the native schema's declared roles/authentication/extensions
and the explicit native rebuild/cutover workflow. The old backbone release command
refuses snapshot replay. Generation and previews do not install or deploy SQL.
