# Fresh-install schema

This page describes the historical compatibility schema. The active standalone
entity database and database-only commands are documented in
[DATABASE_REBUILD.md](DATABASE_REBUILD.md).

`make generate` copies `resources/finfolkdb/schema.sql` and the historical index
inventory from frozen fixtures under `resources/finfolkbuild/legacy/`, using
`finfolkbuild.db.legacy`. Generation uses only repository sources and
does not connect to or install anything in a database. `make check-generated`
verifies these artifacts, including generation into a temporary output root.

The schema contains all application tables, identity sequences, constraints,
indexes, current function implementations and final permissions. It includes
only required defaults: the disabled Instagram messaging singleton, discovery
sources and the site-catalog singleton. Beach imports, credentials, member
records, operational content, migration ledgers and deployment readiness markers
are separate. Historical data cleanup is relevant to upgrades, not fresh installs.

Provision PostgreSQL 18, the `finfolk_api` role and managed Neon Auth before using
the SQL. The managed `neon_auth."user"` table is an external dependency; the
artifact does not recreate the provider's authentication schema. Application
schemas must be empty. Installation is transactional and rejects an existing
application schema instead of attempting an upgrade.

This is a generated and verified artifact, not a new supported installation
command. The existing serving release continues to use its historical workflow. The
replacement follows the [fresh rebuild/import plan](DATABASE_REBUILD.md#fresh-rebuild-and-data-import-plan),
with no migration replay or new migration-ledger baseline.

`make test-db` compares separate migrated and fresh databases for table columns,
constraints, indexes, functions, sequences, effective privileges and required
rows, and exercises representative member/directory operations. It tests missing
prerequisites, rejection of an existing schema and rollback of failed installs.
Historical parity tests compare the frozen release contracts and migrations.
Active entity changes are checked separately by `make test-db-types`.
