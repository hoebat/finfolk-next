import { serve } from '@hono/node-server';
import { createAPI, managedVerifier } from './api.mjs';
import { database } from './db.mjs';
const db = database(process.env.DATABASE_URL),
  siteNotesDb=process.env.SITE_NOTES_DATABASE_URL?database(process.env.SITE_NOTES_DATABASE_URL):null,
  app = createAPI({ db, siteNotesDb, verify: managedVerifier(process.env) });
serve(
  {
    fetch: (request) => app.fetch(request, process.env),
    port: Number(process.env.PORT || 8787),
    hostname: '127.0.0.1',
  },
  (info) =>
    console.log(`FinFolk Neon API listening on http://127.0.0.1:${info.port}`),
);
