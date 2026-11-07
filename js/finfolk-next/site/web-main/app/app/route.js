import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
// Staged legacy map entry. A prerendered route works on both Next and Netlify;
// public-file rewrites are not supported by the Netlify Next adapter.
export const dynamic='force-static';
export async function GET(){return new Response(await readFile(join(process.cwd(),'public/legacy/app.html')),{headers:{'Content-Type':'text/html; charset=utf-8'}});}
