import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

// Read-only promotion checks. Generated declarations, not a handwritten list,
// define the only application relations a candidate is allowed to contain.
export async function nativeReleaseContract(root = new URL('../../', import.meta.url)) {
  const artifact = path => readFile(new URL(path, root));
  const [schema, catalogBytes, rebuild, grants, rpc, notesGrants, importContract] = await Promise.all([
    artifact('resources/finfolkdb/entity-schema.sql'),
    artifact('resources/finfolkdb/entity-catalog.json'),
    artifact('resources/finfolkdb/rebuild.sql'),
    artifact('resources/finfolkdb/messaging-grants.sql'),
    artifact('resources/finfolkdb/rpc-catalog.json'),
    artifact('resources/finfolkdb/site-notes-grants.sql'),
    artifact('resources/finfolkdb/rebuild-contract.json'),
  ]);
  const catalog = JSON.parse(catalogBytes);
  const digest = createHash('sha256');
  for (const body of [schema, catalogBytes, rebuild, grants, rpc, notesGrants, importContract]) {
    digest.update(String(body.length) + ':');
    digest.update(body);
  }
  return {digest: digest.digest('hex'), tables: Object.keys(catalog).sort(), rpc: Object.keys(JSON.parse(rpc)).sort()};
}

export function checkNativeRelations(contract, relations) {
  const expected = new Set(contract.tables);
  const actual = new Set(relations.filter(r => r.schema === 'finfolk' && ['r','p'].includes(r.kind)).map(r => r.name));
  const missing = [...expected].filter(name => !actual.has(name)).sort();
  const unexpected = relations.filter(r =>
    r.schema === 'finfolk_shop' || r.schema === 'finfolk_rpc' ||
    r.schema === 'public' && r.name === 'finfolk_migrations' ||
    r.schema === 'finfolk' && (!expected.has(r.name) || !['r','p'].includes(r.kind))
  ).map(r => `${r.schema}.${r.name}`).sort();
  return {ready: missing.length === 0 && unexpected.length === 0, missing, unexpected};
}

export async function inspectNativeRelations(query, contract) {
  const result = await query(`SELECT n.nspname AS schema,c.relname AS name,c.relkind AS kind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE (n.nspname IN ('finfolk','finfolk_shop','finfolk_rpc') OR
      (n.nspname='public' AND c.relname='finfolk_migrations')) AND c.relkind IN ('r','p','v','m','f')`);
  return checkNativeRelations(contract, Array.isArray(result) ? result : result.rows);
}
