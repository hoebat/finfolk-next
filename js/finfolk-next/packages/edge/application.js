// Generated from finfolk-web.lib.application; do not edit.
import * as worker from '@finfolk/edge/worker-bridge.js'

import * as page from '@xtalk/substrate/page-core.js'

import * as events from '@xtalk/event/base-model.js'

import * as substrate from '@xtalk/substrate/substrate.js'

import * as backbone from '@finfolk/edge/backbone.js'

export var APPLICATIONS = new Map();

export function createBridge(config){
  if(config["cacheBackend"] == "sqlite"){
    try{
      return worker.createWorkerBridge(config);
    }
    catch(error){
      worker.announce("finfolk:cache-status",{
        "mode":"unavailable",
        "message":"Application storage unavailable. Using the online memory cache."
      });
    }
  }
  return null;
}

export function state(ctx,name,value,write){
  let states = ctx["states"];
  let model = states.get(name);
  if(!model){
    let models = {};
    models[name] = {
      "defaults":{"args":[],"output":null},
      "handler":function (){
            return null;
          }
    };
    page.group_add_attach(ctx["node"],"application","state",models);
    model = page.model_ensure(ctx["node"],"application","state",name)[1];
    states.set(name,model);
  }
  if(write){
    events.set_output(model,value,false,null,null,null);
  }
  return page.model_get_output(ctx["node"],"application","state",name);
}

export async function auth(ctx,kind,work){
  state(ctx,"auth",{"status":"loading","kind":kind},true);
  try{
    let result = await work();
    state(ctx,"auth",{"status":"ready","kind":kind},true);
    return result;
  }
  catch(error){
    state(
      ctx,
      "auth",
      {"status":"error","kind":kind,"message":error["message"]},
      true
    );
    throw error;
  }
}

export function member(ctx,actor,transport){
  if(!ctx["member"] || (ctx["member"]["actor"] != actor)){
    if(ctx["member"]){
      ctx["member"].close();
    }
    ctx["member"] = (ctx["bridge"] ? ctx["bridge"].open(actor,transport) : backbone.createBackbone(actor,transport,{
      "node":ctx["node"],
      "onMutation":function (domains){
            return ctx["public"].invalidate(domains);
          }
    }));
  }
  return ctx["member"];
}

export function createApplicationBackbone(config){
  let key = JSON.stringify([
    config["authUrl"] || "",
    config["cacheApiUrl"] || config["apiUrl"] || "",
    config["cacheBackend"]
  ]);
  if(APPLICATIONS.has(key)){
    return APPLICATIONS.get(key);
  }
  let ctx = {
    "node":substrate.node_create({"id":"finfolk-app"}),
    "bridge":createBridge(config),
    "states":new Map(),
    "member":null,
    "publicTransport":null
  };
  let publicTransport = function (name,value,options){
    return ctx["publicTransport"](name,value,options);
  };
  ctx["public"] = (ctx["bridge"] ? ctx["bridge"].open("public",publicTransport) : backbone.createBackbone(
    "public",
    publicTransport,
    {"node":ctx["node"],"space":"public"}
  ));
  let app = {
    "ready":ctx["public"]["ready"] || Promise.resolve(),
    "member":function (actor,transport){
        return member(ctx,actor,transport);
      },
    "auth":function (kind,work){
        return auth(ctx,kind,work);
      },
    "storage":ctx["bridge"],
    "subscribeState":function (name,callback){
        state(ctx,name,null,false);
        let model = ctx["states"].get(name);
        let id = "ui-" + Math.random();
        events.add_listener(model,id,function (){
          callback(state(ctx,name,null,false));
        },null,null);
        return function (){
          events.remove_listener(model,id);
        };
      },
    "clearMember":function (){
        let member = ctx["member"];
        ctx["member"] = null;
        state(ctx,"auth",{"status":"signed-out"},true);
        return member ? member.close() : Promise.resolve();
      },
    "state":function (name,value){
        return state(ctx,name,value,arguments["length"] > 1);
      },
    "public":ctx["public"],
    "clearAccountCache":function (){
        if(ctx["member"]){
          return ctx["member"].clearCache();
        }
      },
    "node":ctx["node"],
    "setPublicTransport":function (transport){
        ctx["publicTransport"] = transport;
      }
  };
  APPLICATIONS.set(key,app);
  return app;
}