// Generated from finfolk-web.lib.backbone; do not edit.
import * as registry from '@finfolk/edge/operations.js'

import * as memory from '@xtalk/db/system/impl-memory.js'

import * as cache_util from '@xtalk/db/system/memory-util.js'

import * as page from '@xtalk/substrate/page-core.js'

import * as events from '@xtalk/event/base-model.js'

import * as substrate from '@xtalk/substrate/substrate.js'

export function stableKey(value){
  if(Array.isArray(value)){
    return "[" + value.map(stableKey).join(",") + "]";
  }
  if(value && ((typeof value) == "object")){
    let keys = Object.keys(value).sort();
    let allowed = keys.filter(function (key){
      return !(value[key] === undefined);
    });
    let pairs = allowed.map(function (key){
      return JSON.stringify(key) + ":" + stableKey(value[key]);
    });
    return "{" + pairs.join(",") + "}";
  }
  return JSON.stringify(value);
}

export function publish(ctx,entry,state){
  entry["state"] = Object.assign({},entry["state"],state);
  if(!entry["spec"]["write"] && (entry["state"]["status"] == "ready")){
    ctx["onPublish"](entry["key"],entry["state"]);
  }
  events.set_output(
    entry["model"],
    entry["state"],
    !!entry["state"]["error"],
    null,
    null,
    null
  );
}

export function ensureOpen(ctx){
  if(ctx["closed"]){
    throw new Error("Account context closed.");
  }
}

export function ensureModel(ctx,name,values){
  let spec = registry.operation(name);
  if(spec["auth"] && (ctx["actor"] == "public")){
    throw new Error("Sign in again.");
  }
  let key = spec["write"] ? name : (name + ":" + stableKey(values));
  let entries = ctx["entries"];
  let entry = entries.get(key);
  if(!entry){
    if(entries["size"] >= 256){
      let old = Array.from(entries.values()).find(function (e){
        return !e["spec"]["write"] && (e["listeners"]["size"] == 0) && !ctx["pending"].has(e["key"]);
      });
      if(old){
        entries.delete(old["key"]);
        ctx["storage"]["remove"](old["key"]);
        page.model_remove(ctx["node"],ctx["space"],old["group"],old["id"]);
        delete(
          page.group_get(ctx["node"],ctx["space"],old["group"])["specs"][old["id"]]
        );
      }
    }
    ctx["sequence"] = (1 + ctx["sequence"]);
    let id = "model-" + ctx["sequence"];
    let group = spec["admin"] ? "admin" : spec["domain"];
    entry = {
      "values":spec["write"] ? {} : values,
      "spec":spec,
      "group":group,
      "key":key,
      "id":id,
      "revision":0,
      "name":name,
      "state":{"status":"idle"},
      "listeners":new Set()
    };
    if(!spec["write"]){
      let saved = ctx["storage"]["get"](key);
      if(saved){
        entry["state"] = {
          "status":"stale",
          "data":saved["data"],
          "cached":true,
          "savedAt":saved["savedAt"]
        };
      }
    }
    entries.set(key,entry);
    let definition = {
      "defaults":{"args":[{}],"output":null},
      "handler":function (_context,input){
            return Promise.resolve(ctx["transport"](name,input,entry["options"] || {})).then(function (result){
              ensureOpen(ctx);
              return result;
            });
          }
    };
    let models = {};
    models[id] = definition;
    page.group_add_attach(ctx["node"],ctx["space"],group,models);
    entry["model"] = page.model_ensure(ctx["node"],ctx["space"],group,id)[1];
    events.add_listener(entry["model"],"finfolk",function (){
      for(let callback of entry["listeners"]){
        try{
          callback(entry["state"]);
        }
        catch(error){
          console.error("Substrate view subscriber failed.");
        }
      };
    },null,null);
  }
  return entry;
}

export function invalidateEntry(ctx,entry){
  entry["revision"] = (1 + entry["revision"]);
  ctx["storage"]["remove"](entry["key"]);
  ctx["onInvalidate"](entry["key"]);
  publish(ctx,entry,{"status":"stale","cached":false});
}

export async function refreshEntry(ctx,entry){
  let inflight = ctx["pending"].get(entry["key"]);
  if(inflight){
    await inflight.catch(function (){

    });
  }
  return ctx["call"](entry["name"],entry["values"]);
}

export async function run(ctx,name,values,options){
  ensureOpen(ctx);
  let entry = ensureModel(ctx,name,values);
  let spec = entry["spec"];
  if(spec["write"] && ctx["blocked"].has(spec["domain"])){
    throw new Error(
      "Reload before making another change: the previous change was saved but its refresh failed."
    );
  }
  let revision = entry["revision"];
  entry["options"] = options;
  publish(ctx,entry,{"status":"loading","error":null});
  events.set_input(entry["model"],{"data":[values]});
  let result = null;
  try{
    let acc = await page.model_refresh(ctx["node"],ctx["space"],entry["group"],entry["id"],{},null);
    ensureOpen(ctx);
    let output = page.model_get_output(ctx["node"],ctx["space"],entry["group"],entry["id"]);
    if(acc["error"]){
      throw output || new Error("Request failed.");
    }
    result = output;
    if(!spec["write"] && (revision == entry["revision"])){
      ctx["storage"]["put"](entry["key"],result,spec);
      publish(ctx,entry,{
        "status":"ready",
        "data":result,
        "error":null,
        "cached":false,
        "savedAt":Date.now()
      });
    }
    if(spec["write"]){
      publish(ctx,entry,{"status":"ready","data":undefined,"error":null});
      let domains = registry.affectedDomains(spec);
      if(ctx["storage"]["invalidate"]){
        ctx["storage"]["invalidate"](domains);
      }
      let refresh = Array.from(ctx["entries"].values()).filter(function (e){
        return !e["spec"]["write"] && domains.includes(e["spec"]["domain"]);
      });
      for(let e of refresh){
        invalidateEntry(ctx,e);
      };
      if((name == "preferences") && !refresh.some(function (e){
        return e["name"] == "me";
      })){
        refresh.push(ensureModel(ctx,"me",{}));
      }
      if((name == "checkin") && !refresh.some(function (e){
        return e["name"] == "myCheckins";
      })){
        refresh.push(ensureModel(ctx,"myCheckins",{}));
      }
      try{
        await ctx["onMutation"](domains);
        await Promise.all(refresh.filter(function (e){
          return (name != "deleteAccount") && ((e["listeners"]["size"] > 0) || ((name == "preferences") && (e["name"] == "me")) || ((name == "checkin") && (e["name"] == "myCheckins")));
        }).map(function (e){
          return refreshEntry(ctx,e);
        }));
      }
      catch(error){
        ctx["blocked"].add(spec["domain"]);
        ctx["onBlocked"](spec["domain"]);
        throw Object.assign(new Error(
          "Saved, but refreshing the account failed. Reload before making another change."
        ),{"mutationCommitted":true,"result":result,"cause":error});
      }
    }
    return result;
  }
  catch(error){
    if(spec["write"] && !error["status"] && !ctx["closed"]){
      ctx["blocked"].add(spec["domain"]);
      ctx["onBlocked"](spec["domain"]);
      if(!error["mutationCommitted"]){
        error["mutationOutcomeUnknown"] = true;
      }
    }
    if(!ctx["closed"] && !spec["write"] && ctx["offlineReads"] && !error["status"] && (error["name"] != "AbortError")){
      let saved = ctx["storage"]["get"](entry["key"]);
      if(saved){
        ctx["onCached"](saved);
        publish(ctx,entry,{
          "status":"ready",
          "data":saved["data"],
          "cached":true,
          "savedAt":saved["savedAt"],
          "error":null
        });
        return saved["data"];
      }
    }
    if(!spec["write"] && error["status"]){
      ctx["storage"]["remove"](entry["key"]);
    }
    if(!spec["write"] && error["status"]){
      ctx["onInvalidate"](entry["key"]);
    }
    if(!ctx["closed"]){
      publish(ctx,entry,{
        "status":"error",
        "error":error,
        "data":spec["write"] ? undefined : entry["state"]["data"]
      });
    }
    throw error;
  }
  finally{
    entry["options"] = null;
    if(spec["write"] || ctx["closed"]){
      events.set_input(entry["model"],{"data":[{}]});
      events.set_output(entry["model"],null,false,null,null,null);
    }
  }
}

export function call(ctx,name,values,options){
  values = (values || {});
  options = (options || {});
  let spec = registry.operation(name);
  if(ctx["closed"]){
    return Promise.reject(new Error("Account context closed."));
  }
  if(!spec["write"]){
    let key = name + ":" + stableKey(values);
    let pending = ctx["pending"];
    if(pending.has(key)){
      return pending.get(key);
    }
    let task = run(ctx,name,values,options);
    pending.set(key,task);
    task.finally(function (){
      if(pending.get(key) == task){
        pending.delete(key);
      }
    }).catch(function (){

    });
    return task;
  }
  let queues = ctx["queues"];
  let tail = queues.get(spec["domain"]) || Promise.resolve();
  let task = tail.then(function (){
    return run(ctx,name,values,options);
  });
  queues.set(spec["domain"],task.catch(function (){

  }));
  return task;
}

export async function invalidate(ctx,domains){
  if(ctx["storage"]["invalidate"]){
    ctx["storage"]["invalidate"](domains);
  }
  let refresh = [];
  for(let entry of ctx["entries"].values()){
    if(!entry["spec"]["write"] && domains.includes(entry["spec"]["domain"])){
      invalidateEntry(ctx,entry);
      if(entry["listeners"]["size"] > 0){
        refresh.push(entry);
      }
    }
  };
  await Promise.all(refresh.map(function (entry){
    return refreshEntry(ctx,entry);
  }));
}

export function close(ctx){
  ctx["closed"] = true;
  ctx["storage"]["clear"]();
  for(let entry of ctx["entries"].values()){
    entry["listeners"].clear();
    entry["state"] = {"status":"closed"};
    events.set_input(entry["model"],{"data":[{}]});
    events.set_output(entry["model"],null,false,null,null,null);
  };
  ctx["entries"].clear();
  delete(ctx["node"]["spaces"][ctx["space"]]);
}

export function createBackbone(actor,transport,opts){
  opts = (opts || {});
  let node = opts["node"] || substrate.node_create({"id":"finfolk:" + actor});
  let space = opts["space"] || ("member:" + actor);
  let schema = {
    "Result":{
        "id":{"ident":"id","type":"text","primary":true,"order":0},
        "value":{"ident":"value","type":"jsonb","order":1}
      }
  };
  let cache = memory.impl_memory(schema,{"Result":{"position":0}});
  let storage = opts["storage"] || {
    "get":function (key){
        let found = cache_util.get_entry(cache["rows"],"Result",key);
        return found ? {"data":found["record"]["data"]["value"]} : null;
      },
    "put":function (key,value,_spec){
        memory.record_add(cache,"Result",[{"id":key,"value":value}]);
      },
    "remove":function (key){
        memory.record_delete(cache,"Result",[key]);
      },
    "clear":function (){
        memory.clear_db(cache);
      }
  };
  let ctx = {
    "queues":new Map(),
    "offlineReads":opts["offlineReads"],
    "transport":transport,
    "space":space,
    "onBlocked":opts["onBlocked"] || (function (_domain){

      }),
    "onCached":opts["onCached"] || (function (_saved){

      }),
    "onInvalidate":opts["onInvalidate"] || (function (_key){

      }),
    "storage":storage,
    "cache":cache,
    "closed":false,
    "onPublish":opts["onPublish"] || (function (_key,_state){

      }),
    "sequence":0,
    "entries":new Map(),
    "blocked":new Set(),
    "pending":new Map(),
    "actor":actor,
    "node":node,
    "onMutation":opts["onMutation"] || (function (){

      })
  };
  ctx["call"] = (function (name,values,options){
    return call(ctx,name,values,options);
  });
  return {
    "recover":async function (){
        let domains = Array.from(ctx["blocked"]);
        if(domains["length"] == 0){
          return true;
        }
        let reads = Array.from(ctx["entries"].values()).filter(function (entry){
          return !entry["spec"]["write"] && domains.includes(entry["spec"]["domain"]);
        });
        if(reads["length"] == 0){
          return false;
        }
        try{
          await ctx["onMutation"](domains);
          await Promise.all(reads.map(function (entry){
            return refreshEntry(ctx,entry);
          }));
          ctx["blocked"].clear();
          return true;
        }
        catch(error){
          return false;
        }
      },
    "forget":function (){
        for(let entry of ctx["entries"].values()){
          entry["revision"] = (1 + entry["revision"]);
          publish(ctx,entry,{"status":"idle","data":undefined,"cached":false});
        };
      },
    "space":space,
    "call":ctx["call"],
    "read":function (name,values){
        let entry = storage["get"](name + ":" + stableKey(values || {}));
        return entry ? entry["data"] : undefined;
      },
    "cache":ctx["cache"],
    "clearCache":function (){
        storage["clear"]();
        for(let entry of ctx["entries"].values()){
          entry["revision"] = (1 + entry["revision"]);
          publish(ctx,entry,{"status":"idle","data":undefined,"cached":false});
        };
      },
    "invalidate":function (domains){
        return invalidate(ctx,domains);
      },
    "kind":"xt.substrate+xt.db",
    "close":function (){
        close(ctx);
      },
    "supports":function (name){
        return !!registry.operations[name];
      },
    "subscribe":function (name,values,callback){
        let entry = ensureModel(ctx,name,values || {});
        entry["listeners"].add(callback);
        callback(entry["state"]);
        return function (){
          entry["listeners"].delete(callback);
        };
      },
    "actor":actor,
    "node":node
  };
}