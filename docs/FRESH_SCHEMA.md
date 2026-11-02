# Fresh-install schema

`make generate` writes `resources/finfolkdb/schema.sql` through the `def.make`
configuration in `finfolkdb.schema.publication`. It also regenerates the index
inventory used by database tests. Generation uses only repository sources and
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
command. Continue using the existing migration workflow. No migration-ledger
baseline or production release-marker changes are introduced by this feature.

`make test-db` compares separate migrated and fresh databases for table columns,
constraints, indexes, functions, sequences, effective privileges and required
rows, and exercises representative member/directory operations. It tests missing
prerequisites, rejection of an existing schema and rollback of failed installs.
Changes to database structure require matching finfolkdb declarations and
migrations; the parity test detects omissions in either path.
