// Generated from finfolk-web.lib.worker-bridge; do not edit.
import * as registry from '@finfolk/edge/operations.js'

import * as backbone from '@finfolk/edge/backbone.js'

export function announce(type,detail){
  if(globalThis["dispatchEvent"]){
    globalThis.dispatchEvent(new CustomEvent(type,{"detail":detail}));
  }
}

export function error(data){
  return Object.assign(new Error(data["message"] || "Worker request failed."),data);
}

export function post(ctx,message){
  ctx["port"].postMessage(message);
}

export function request(ctx,message,signal){
  if(signal && signal["aborted"]){
    return Promise.reject(new DOMException("Request cancelled.","AbortError"));
  }
  ctx["sequence"] = (1 + ctx["sequence"]);
  let id = "page-" + ctx["sequence"];
  return new Promise(function (resolve,reject){
    let abort = function (){
      post(ctx,{"type":"cancel","request":id});
      let task = ctx["pending"].get(id);
      if(task){
        task["reject"](new DOMException("Request cancelled.","AbortError"));
      }
    };
    let finish = function (callback,value){
      ctx["pending"].delete(id);
      clearTimeout(timer);
      if(signal){
        signal.removeEventListener("abort",abort);
      }
      callback(value);
    };
    let timer = setTimeout(function (){
      finish(reject,new Error("Application cache connection timed out."));
    },45000);
    ctx["pending"].set(id,{
      "message":message,
      "resolve":function (v){
            finish(resolve,v);
          },
      "reject":function (e){
            finish(reject,e);
          }
    });
    if(signal){
      signal.addEventListener("abort",abort,{"once":true});
    }
    post(ctx,Object.assign({},message,{"id":id}));
  });
}

export function markClosed(facade){
  facade["closed"] = true;
  facade["snapshots"].clear();
  for(let entry of facade["subscriptions"].values()){
    try{
      entry["callback"]({"status":"closed"});
    }
    catch(error){
      console.error("Cache subscriber failed.");
    }
  };
  facade["subscriptions"].clear();
}

export function connectionReady(ctx){
  let ready = new Promise(function (resolve,reject){
    ctx["resolve"] = resolve;
    ctx["reject"] = reject;
    ctx["timer"] = setTimeout(function (){
      reject(new Error("SQLite worker startup timed out."));
    },12000);
  });
  return ready.then(async function (){
    let result = await request(ctx,{
      "type":"hello",
      "protocol":1,
      "client":ctx["client"],
      "environment":ctx["environment"]
    },null);
    announce("finfolk:cache-status",result);
    return result;
  });
}

export function reconnect(ctx){
  ctx["connected"] = false;
  announce(
    "finfolk:cache-status",
    {"message":"Reconnecting application cache."}
  );
  for(let task of ctx["pending"].values()){
    let message = task["message"];
    let facade = ctx["scopes"].get(message["scope"]);
    let spec = registry.operations[message["name"]];
    if(facade && spec && spec["write"]){
      facade["blocked"].add(spec["domain"]);
    }
    task["reject"](Object.assign(new Error(
      "Application cache restarted. Reload to confirm whether your change was saved."
    ),{"mutationOutcomeUnknown":!!(spec && spec["write"])}));
  };
  for(let controller of ctx["http"].values()){
    controller.abort();
  };
  ctx["http"].clear();
  ctx["ready"] = connectionReady(ctx);
  for(let facade of ctx["scopes"].values()){
    if(!facade["closed"]){
      facade["snapshots"].clear();
      facade["ready"] = ctx["ready"].then(async function (){
        await request(ctx,{"type":"attach","actor":facade["actor"]},null);
        for(let [sub,entry] of facade["subscriptions"]){
          await request(ctx,{
            "type":"subscribe",
            "scope":facade["id"],
            "name":entry["name"],
            "values":entry["values"],
            "subscription":sub
          },null);
        };
        return true;
      });
    }
  };
}

export async function receive(ctx,message){
  let type = message["type"];
  if(type == "spawn"){
    let channel = new MessageChannel();
    let kernel = new Worker(
      new URL("./workers/kernel.js",import.meta["url"]),
      {"type":"module"}
    );
    ctx["kernel"] = kernel;
    kernel["onerror"] = (function (){
      post(ctx,{"type":"kernel-failed"});
    });
    kernel.postMessage({"type":"broker"},[channel["port1"]]);
    ctx["port"].postMessage({"type":"kernel"},[channel["port2"]]);
    return;
  }
  if(type == "stop-kernel"){
    if(ctx["kernel"]){
      ctx["kernel"].terminate();
    }
    return;
  }
  if(type == "restarting"){
    reconnect(ctx);
    return;
  }
  if(type == "pong"){
    ctx["lastPong"] = Date.now();
    return;
  }
  if(type == "ready"){
    if(ctx["connected"] && (ctx["epoch"] != message["epoch"])){
      reconnect(ctx);
    }
    ctx["epoch"] = message["epoch"];
    ctx["connected"] = true;
    ctx["lastPong"] = Date.now();
    clearTimeout(ctx["timer"]);
    ctx["resolve"](true);
    return;
  }
  if(type == "fatal"){
    ctx["reject"](error(message["error"]));
    return;
  }
  if(type == "result"){
    let task = ctx["pending"].get(message["id"]);
    if(task){
      if(message["error"]){
        task["reject"](error(message["error"]));
      }
      else{
        task["resolve"](message["result"]);
      }
    }
    return;
  }
  if(type == "http-abort"){
    let controller = ctx["http"].get(message["id"]);
    if(controller){
      controller.abort();
    }
    return;
  }
  if(type == "changed"){
    announce("finfolk:cache-changed",{});
    return;
  }
  if(type == "cached"){
    announce(
      "finfolk:cache-status",
      {"cached":true,"savedAt":message["savedAt"]}
    );
    return;
  }
  let facade = ctx["scopes"].get(message["scope"]);
  if(type == "http"){
    let controller = new AbortController();
    ctx["http"].set(message["id"],controller);
    try{
      if(!facade || facade["closed"]){
        throw new Error("Account context closed.");
      }
      let result = await facade["transport"](
        message["name"],
        message["values"],
        Object.assign({},message["options"],{"signal":controller["signal"]})
      );
      post(
        ctx,
        {"type":"http-result","id":message["id"],"result":result}
      );
    }
    catch(error){
      post(ctx,{
        "type":"http-result",
        "id":message["id"],
        "error":{
                "message":error["message"],
                "name":error["name"],
                "status":error["status"],
                "code":error["code"],
                "requestId":error["requestId"]
              }
      });
    }
    finally{
      ctx["http"].delete(message["id"]);
    }
    return;
  }
  if(!facade){
    return;
  }
  if((type == "uncertain") || (type == "blocked")){
    facade["blocked"].add(message["domain"]);
    if(type == "uncertain"){
      for(let task of ctx["pending"].values()){
        let input = task["message"];
        let spec = registry.operations[input["name"]];
        if(spec && spec["write"] && (input["scope"] == message["scope"]) && (spec["domain"] == message["domain"])){
          task["reject"](Object.assign(new Error(
            "Application cache restarted. Reload to confirm whether your change was saved."
          ),{"mutationOutcomeUnknown":true}));
        }
      };
    }
    return;
  }
  if(type == "invalidated"){
    facade["snapshots"].delete(message["key"]);
    facade["revisions"].set(
      message["key"],
      1 + (facade["revisions"].get(message["key"]) || 0)
    );
    return;
  }
  if(type == "cleared"){
    markClosed(facade);
    announce("finfolk:member-cleared",{"actor":message["actor"]});
    return;
  }
  if(type == "evicted"){
    facade["snapshots"].clear();
    return;
  }
  if((type == "state") || (type == "snapshot")){
    let state = message["state"];
    if(!(state["data"] === undefined) && ((state["status"] == "ready") || state["cached"])){
      facade["snapshots"].set(message["key"],state["data"]);
    }
    else{
      facade["snapshots"].delete(message["key"]);
    }
    let entry = facade["subscriptions"].get(message["subscription"]);
    if(entry){
      try{
        entry["callback"](state);
      }
      catch(error){
        console.error("Cache subscriber failed.");
      }
    }
    if(state["cached"]){
      announce(
        "finfolk:cache-status",
        {"cached":true,"savedAt":state["savedAt"]}
      );
    }
  }
}

export function createScope(ctx,actor,transport){
  let facade = {
    "actor":actor,
    "transport":transport,
    "snapshots":new Map(),
    "revisions":new Map(),
    "subscriptions":new Map(),
    "blocked":new Set(),
    "closed":false
  };
  let ready = ctx["ready"].then(function (){
    return request(ctx,{"type":"attach","actor":actor},null);
  });
  ready = ready.then(async function (id){
    facade["id"] = id;
    ctx["scopes"].set(id,facade);
    await request(ctx,{"type":"recover","scope":id},null);
    return true;
  });
  facade["ready"] = ready.catch(function (error){
    facade["local"] = backbone.createBackbone(actor,function (name,values,options){
      return facade["transport"](name,values,options);
    });
    announce("finfolk:cache-status",{
      "mode":"unavailable",
      "message":"Application storage unavailable. Using the online memory cache."
    });
    return true;
  });
  let api = {
    "ready":facade["ready"],
    "call":async function (name,values,options){
        if(facade["closed"]){
          throw new Error("Account context closed.");
        }
        let spec = registry.operation(name);
        if(spec["write"] && facade["blocked"].has(spec["domain"])){
          throw new Error(
            "Reload before making another change: confirm whether the previous change was saved."
          );
        }
        await facade["ready"];
        if(facade["closed"]){
          throw new Error("Account context closed.");
        }
        if(spec["write"] && facade["blocked"].has(spec["domain"])){
          throw new Error(
            "Reload before making another change: confirm whether the previous change was saved."
          );
        }
        values = (values || {});
        options = (options || {});
        let key = name + ":" + backbone.stableKey(values);
        let revision = facade["revisions"].get(key) || 0;
        if(facade["local"]){
          return facade["local"].call(name,values,options);
        }
        let result = await request(ctx,{
          "type":"call",
          "scope":facade["id"],
          "name":name,
          "values":values,
          "options":{"idempotencyKey":options["idempotencyKey"]}
        },options["signal"]);
        if(facade["closed"]){
          throw new Error("Account context closed.");
        }
        if(!registry.operation(name)["write"] && (revision == (facade["revisions"].get(key) || 0))){
          facade["snapshots"].set(name + ":" + backbone.stableKey(values),result);
        }
        return result;
      },
    "setTransport":function (transport){
        facade["transport"] = transport;
      },
    "read":function (name,values){
        if(facade["closed"]){
          return undefined;
        }
        if(facade["local"]){
          return facade["local"].read(name,values);
        }
        return facade["snapshots"].get(name + ":" + backbone.stableKey(values || {}));
      },
    "clearCache":async function (){
        await facade["ready"];
        facade["snapshots"].clear();
        if(facade["local"]){
          return facade["local"].clearCache();
        }
        return request(ctx,{"type":"clear-cache","scope":facade["id"]},null);
      },
    "invalidate":async function (domains){
        await facade["ready"];
        facade["snapshots"].clear();
        if(facade["closed"]){
          return;
        }
        if(facade["local"]){
          return facade["local"].invalidate(domains);
        }
        return request(
          ctx,
          {"type":"invalidate","scope":facade["id"],"domains":domains},
          null
        );
      },
    "kind":"xt.substrate+xt.db+sqlite",
    "close":function (){
        if(facade["closed"]){
          return Promise.resolve();
        }
        markClosed(facade);
        return facade["ready"].then(function (){
          if(facade["local"]){
            return facade["local"].close();
          }
          else{
            return request(ctx,{"type":"purge","scope":facade["id"]},null);
          }
        });
      },
    "supports":function (name){
        return !!registry.operations[name];
      },
    "subscribe":function (name,values,callback){
        values = (values || {});
        let sub = "sub-" + Math.random();
        let stopped = false;
        let localStop = null;
        facade["subscriptions"].set(sub,{"callback":callback,"name":name,"values":values});
        callback({"status":"loading"});
        facade["ready"].then(function (){
          if(stopped || facade["closed"]){
            return;
          }
          if(facade["local"]){
            localStop = facade["local"].subscribe(name,values,callback);
          }
          else{
            return request(ctx,{
              "type":"subscribe",
              "scope":facade["id"],
              "name":name,
              "values":values,
              "subscription":sub
            },null);
          }
        }).catch(function (error){
          if(!stopped){
            callback({"status":"error","error":error});
          }
        });
        return function (){
          stopped = true;
          facade["subscriptions"].delete(sub);
          if(localStop){
            localStop();
          }
          if(facade["id"] && !facade["closed"]){
            request(
              ctx,
              {"type":"unsubscribe","scope":facade["id"],"subscription":sub},
              null
            ).catch(function (){

            });
          }
        };
      },
    "actor":actor
  };
  return api;
}

export function createWorkerBridge(config){
  if(((typeof Worker) == "undefined") || ((typeof MessageChannel) == "undefined")){
    return null;
  }
  let ctx = {
    "scopes":new Map(),
    "pending":new Map(),
    "http":new Map(),
    "sequence":0,
    "client":crypto.randomUUID(),
    "environment":JSON.stringify([config["authUrl"],config["apiUrl"]])
  };
  let channel = new MessageChannel();
  let worker = null;
  let shared = (typeof SharedWorker) != "undefined";
  if(shared){
    worker = new SharedWorker(new URL(
      "./workers/finfolk.sharedworker.js?protocol=2",
      import.meta["url"]
    ),{"type":"module","name":"finfolk-next-sqlite-v2"});
    ctx["port"] = worker["port"];
  }
  else{
    worker = new Worker(
      new URL("./workers/kernel.js",import.meta["url"]),
      {"type":"module"}
    );
    ctx["port"] = channel["port1"];
    worker.postMessage({"type":"connect","ephemeral":true},[channel["port2"]]);
  }
  ctx["ready"] = connectionReady(ctx);
  ctx["worker"] = worker;
  worker["onerror"] = (function (){
    ctx["reject"](new Error("SQLite worker could not start."));
  });
  ctx["port"].addEventListener("message",function (event){
    receive(ctx,event["data"]);
  });
  ctx["port"].start();
  ctx["ready"].catch(function (){

  });
  let heartbeat = null;
  if(globalThis["addEventListener"]){
    if(shared){
      heartbeat = setInterval(function (){
        if(ctx["connected"] && ((Date.now() - ctx["lastPong"]) > 8000)){
          ctx["connected"] = false;
          try{
            post(ctx,{"type":"detach"});
            ctx["port"].close();
          }
          catch(error){
            null;
          }
          let replacement = new SharedWorker(new URL(
            "./workers/finfolk.sharedworker.js?protocol=2",
            import.meta["url"]
          ),{"type":"module","name":"finfolk-next-sqlite-v2"});
          ctx["worker"] = replacement;
          ctx["port"] = replacement["port"];
          reconnect(ctx);
          ctx["port"].addEventListener("message",function (event){
            receive(ctx,event["data"]);
          });
          ctx["port"].start();
        }
        post(ctx,{"type":"ping"});
      },2000);
      globalThis.addEventListener("pageshow",function (){
        post(ctx,{"type":"ping"});
      });
    }
    globalThis.addEventListener("pagehide",function (event){
      post(ctx,{"type":event["persisted"] ? "yield" : "detach"});
      if(!event["persisted"]){
        clearInterval(heartbeat);
      }
      if(ctx["kernel"]){
        ctx["kernel"].terminate();
      }
    });
  }
  return {
    "open":function (actor,transport){
        return createScope(ctx,actor,transport);
      },
    "health":function (){
        return request(ctx,{"type":"coordinator"},null);
      },
    "ready":ctx["ready"],
    "stats":async function (){
        await ctx["ready"];
        return request(ctx,{"type":"stats"},null);
      },
    "evict":async function (ids){
        await ctx["ready"];
        return request(ctx,{"type":"evict","ids":ids},null);
      }
  };
}