# database

Author schemas and database business rules in the configured Clojure namespaces. Check types, function inputs/results, grants, ownership, RLS and transactional behavior as relevant. Publish SQL and typed metadata through app.manage. Generation does not install SQL. Use only the project's declared isolated local fixtures for database tests; do not reset shared or production databases. Preserve historical migration policy and attribution. Test actual return values and persisted effects, including rejection paths.
