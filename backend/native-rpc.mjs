// Trusted server calls only. This registry is never an HTTP function-name dispatcher.
import catalog from '../resources/finfolkdb/rpc-catalog.json' with {type:'json'};

export function createNativeRPC(query) {
  return async function call(name,args=[]) {
    const spec=Object.hasOwn(catalog,name)?catalog[name]:null;
    if(!spec||!Array.isArray(args)||args.length!==spec.arguments.length)
      throw Object.assign(Error('Unknown native RPC or invalid argument count.'),{code:'native_rpc_contract'});
    if(!/^[a-z][a-z0-9_]*$/.test(name)||spec.schema!=='finfolk_rpc')throw Error('Invalid generated RPC identifier');
    const params=spec.arguments.map((arg,index)=>{
      if(!/^[a-z][a-z0-9_]*(?:\[\])?$/.test(arg.type))throw Error('Unsupported generated RPC argument type');
      return '$'+(index+1)+'::'+arg.type;
    });
    const values=args.map((arg,i)=>spec.arguments[i].type==='jsonb'&&arg!==null&&typeof arg==='object'?JSON.stringify(arg):arg);
    const result=await query('SELECT finfolk_rpc."'+name+'"('+params.join(',')+') AS value',values);
    return (Array.isArray(result)?result:result.rows)[0]?.value;
  };
}
