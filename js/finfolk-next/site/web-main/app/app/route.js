export const dynamic='force-dynamic';
export function GET(request){const query=new URL(request.url).searchParams;query.delete('view');return new Response(null,{status:307,headers:{Location:'/map'+(query.size?'?'+query:''),'Cache-Control':'no-store'}});}
