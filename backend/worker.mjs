// Retired after the fresh Supabase cutover. Never attach cron or queue consumers.
// Current API entry: backend/supabase-api-worker.mjs.
export default {fetch(){return Response.json({error:'This service has retired.',url:'https://finfolk.com.au'},{status:410,headers:{'Cache-Control':'no-store'}});}};
