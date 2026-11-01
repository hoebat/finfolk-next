// Generated from finfolk-web.lib.kernel; do not edit.
import * as sqlite from '@finfolk/edge/sqlite.js'

import * as backbone from '@finfolk/edge/backbone.js'

export var SCOPES = new Map();

export var CLIENTS = new Set();

export var HTTP = new Map();

export var STORE = null;

export var BOOT = null;

export var SEQUENCE = 0;

export var Epoch = crypto.randomUUID();

export var Release = null;

export function send(client,message){
  try{
    client["port"].postMessage(message);
  }
  catch(error){
    null;
  }
}

export function errorData(error){
  return {
    "message":error["message"] || "Worker request failed.",
    "status":error["status"],
    "code":error["code"],
    "name":error["name"],
    "mutationCommitted":error["mutationCommitted"],
    "result":error["result"],
    "mutationOutcomeUnknown":error["mutationOutcomeUnknown"],
    "requestId":error["requestId"]
  };
}

export async function boot(ephemeral){
  if(!BOOT){
    BOOT = new Promise(function (resolve,reject){
      let open = async function (){
        try{
          STORE = await sqlite.openStore("/finfolk-next/application-cache",ephemeral);
          resolve(STORE);
        }
        catch(error){
          reject(error);
        }
      };
      if(!ephemeral && globalThis["navigator"]["locks"]){
        globalThis["navigator"]["locks"].request("finfolk-sqlite-writer",async function (){
          await open();
          if(STORE && (STORE["mode"] == "persistent")){
            await new Promise(function (hold){
              Release = hold;
            });
          }
        }).catch(reject);
      }
      else{
        open();
      }
    });
  }
  return await BOOT;
}

export function transport(scope,name,values,options){
  let clients = scope["clients"];
  let client = Array.from(clients).find(function (c){
    return c["id"] == options["client"];
  });
  client = (client || Array.from(clients)[0]);
  if(!client){
    return Promise.reject(
      new Error("No signed-in page is available to refresh this account.")
    );
  }
  SEQUENCE = (1 + SEQUENCE);
  let id = Epoch + "-http-" + SEQUENCE;
  return new Promise(function (resolve,reject){
    let timer = setTimeout(function (){
      HTTP.delete(id);
      send(client,{"type":"http-abort","id":id});
      reject(new Error("Account request timed out."));
    },30000);
    HTTP.set(id,{
      "resolve":resolve,
      "reject":reject,
      "timer":timer,
      "client":client,
      "scope":scope["id"],
      "request":options["request"]
    });
    send(client,{
      "type":"http",
      "id":id,
      "scope":scope["id"],
      "name":name,
      "values":values,
      "request":options["request"],
      "options":{"idempotencyKey":options["idempotencyKey"]}
    });
  });
}

export function scope(client,actor){
  let id = client["environment"] + "|" + actor;
  let scope = SCOPES.get(id);
  if(!scope){
    scope = {"id":id,"actor":actor,"clients":new Set()};
    let onMutation = function (domains){
      let publicScope = SCOPES.get(client["environment"] + "|public");
      if(publicScope && (actor != "public")){
        return publicScope["backbone"].invalidate(domains);
      }
    };
    scope["backbone"] = backbone.createBackbone(actor,function (name,values,options){
      return transport(scope,name,values,options);
    },{
      "space":id,
      "storage":sqlite.adapter(STORE,id),
      "offlineReads":true,
      "onMutation":onMutation,
      "onInvalidate":function (key){
            for(let target of scope["clients"]){
              send(target,{"type":"invalidated","scope":id,"key":key});
            };
          },
      "onPublish":function (key,state){
            for(let target of scope["clients"]){
              send(target,{
                "type":"snapshot",
                "scope":id,
                "key":key,
                "state":Object.assign({},state,{"error":null})
              });
            };
          },
      "onBlocked":function (domain){
            for(let target of scope["clients"]){
              send(target,{"type":"blocked","scope":id,"domain":domain});
            };
          },
      "onCached":function (saved){
            for(let target of scope["clients"]){
              send(target,{"type":"cached","savedAt":saved["savedAt"]});
            };
          }
    });
    SCOPES.set(id,scope);
  }
  scope["clients"].add(client);
  client["scopes"].add(id);
  return scope;
}

export function purge(scope){
  for(let client of scope["clients"]){
    client["scopes"].delete(scope["id"]);
    send(
      client,
      {"type":"cleared","scope":scope["id"],"actor":scope["actor"]}
    );
  };
  for(let [id,task] of HTTP){
    if(task["scope"] == scope["id"]){
      clearTimeout(task["timer"]);
      task["reject"](new Error("Account context closed."));
      send(task["client"],{"type":"http-abort","id":id});
      HTTP.delete(id);
    }
  };
  scope["backbone"].close();
  SCOPES.delete(scope["id"]);
}

export function detach(client){
  for(let scope_id of client["scopes"]){
    let scope = SCOPES.get(scope_id);
    if(scope){
      scope["clients"].delete(client);
    }
  };
  for(let stop of client["subscriptions"].values()){
    stop();
  };
  client["subscriptions"].clear();
  CLIENTS.delete(client);
}

export async function handle(client,message){
  let type = message["type"];
  if(type == "http-result"){
    let task = HTTP.get(message["id"]);
    if(task && (task["client"] == client)){
      HTTP.delete(message["id"]);
      clearTimeout(task["timer"]);
      if(message["error"]){
        task["reject"](
          Object.assign(new Error(message["error"]["message"]),message["error"])
        );
      }
      else{
        task["resolve"](message["result"]);
      }
    }
    return;
  }
  if(type == "detach"){
    detach(client);
    return;
  }
  if(type == "cancel"){
    for(let [id,task] of HTTP){
      if((task["client"] == client) && (task["request"] == message["request"])){
        send(client,{"type":"http-abort","id":id});
      }
    };
    return;
  }
  try{
    let result = null;
    if(type == "hello"){
      if(message["protocol"] != 1){
        throw new Error("Reload FinFolk to update its cache connection.");
      }
      client["environment"] = message["environment"];
      client["id"] = message["client"];
      result = sqlite.storageStats(STORE);
    }
    else if(!client["environment"]){
      throw new Error("Worker connection is not initialized.");
    }
    else if(type == "attach"){
      let opened = scope(client,message["actor"]);
      result = opened["id"];
    }
    else if(type == "stats"){
      result = sqlite.storageStats(STORE);
    }
    else if(type == "evict"){
      let allowed = sqlite.storageStats(STORE)["entries"];
      let ids = message["ids"].filter(function (id){
        return id.startsWith(client["environment"] + "|");
      });
      sqlite.removeIds(STORE,ids);
      for(let scope of SCOPES.values()){
        if(scope["id"].startsWith(client["environment"] + "|")){
          scope["backbone"].forget();
          for(let target of scope["clients"]){
            send(target,{"type":"evicted","scope":scope["id"]});
          };
        }
      };
      result = true;
    }
    else{
      let scope = SCOPES.get(message["scope"]);
      if(!scope || !client["scopes"].has(scope["id"])){
        throw new Error("Account context closed.");
      }
      let model = scope["backbone"];
      if(type == "call"){
        result = await model.call(message["name"],message["values"],Object.assign(
          {},
          message["options"],
          {"client":client["id"],"request":message["id"]}
        ));
      }
      else if(type == "subscribe"){
        let sub = message["subscription"];
        let stop = model.subscribe(message["name"],message["values"],function (state){
          send(client,{
            "type":"state",
            "scope":scope["id"],
            "subscription":sub,
            "key":message["name"] + ":" + backbone.stableKey(message["values"]),
            "state":Object.assign(
                        {},
                        state,
                        {"error":state["error"] ? errorData(state["error"]) : null}
                      )
          });
        });
        client["subscriptions"].set(sub,stop);
      }
      else if(type == "unsubscribe"){
        let stop = client["subscriptions"].get(message["subscription"]);
        if(stop){
          stop();
        }
        client["subscriptions"].delete(message["subscription"]);
      }
      else if(type == "invalidate"){
        await model.invalidate(message["domains"]);
      }
      else if(type == "recover"){
        result = await model.recover();
      }
      else if(type == "clear-cache"){
        sqlite.clearScope(STORE,scope["id"]);
        model.forget();
        for(let target of scope["clients"]){
          send(target,{"type":"evicted","scope":scope["id"]});
        };
      }
      else if(type == "purge"){
        purge(scope);
      }
      else{
        throw new Error("Unknown worker operation.");
      }
    }
    send(client,{"type":"result","id":message["id"],"result":result});
    if(type == "call"){
      for(let target of CLIENTS){
        if(target["environment"] == client["environment"]){
          send(target,{"type":"changed"});
        }
      };
    }
  }
  catch(error){
    send(
      client,
      {"type":"result","id":message["id"],"error":errorData(error)}
    );
  }
}

export async function accept(port,ephemeral){
  try{
    await boot(ephemeral);
    let client = {"port":port,"scopes":new Set(),"subscriptions":new Map()};
    CLIENTS.add(client);
    port["onmessage"] = (function (event){
      handle(client,event["data"]);
    });
    port.start();
    send(client,{"type":"ready","protocol":1,"epoch":Epoch});
  }
  catch(error){
    port.postMessage({"type":"fatal","error":errorData(error)});
  }
}

export function start(){
  globalThis["onmessage"] = (function (event){
    if(event["data"]["type"] == "broker"){
      let broker = event["ports"][0];
      broker["onmessage"] = (function (request){
        if(request["data"]["type"] == "shutdown"){
          if(STORE){
            STORE["db"].close();
          }
          if(Release){
            Release(true);
          }
          setTimeout(function (){
            globalThis.close();
          },0);
        }
        if(request["data"]["type"] == "connect"){
          accept(request["ports"][0],false);
        }
      });
      broker.start();
    }
    if(event["data"]["type"] == "connect"){
      accept(event["ports"][0],event["data"]["ephemeral"]);
    }
  });
}

export var Started = start();