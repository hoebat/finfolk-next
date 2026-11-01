// Generated from finfolk-web.lib.application; do not edit.
import * as page from '@xtalk/substrate/page-core.js'

import * as events from '@xtalk/event/base-model.js'

import * as substrate from '@xtalk/substrate/substrate.js'

import * as backbone from '@finfolk/edge/backbone.js'

export var APPLICATIONS = new Map();

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
    ctx["member"] = backbone.createBackbone(actor,transport,{
      "node":ctx["node"],
      "onMutation":function (domains){
            return ctx["public"].invalidate(domains);
          }
    });
  }
  return ctx["member"];
}

export function createApplicationBackbone(config){
  let key = JSON.stringify([config["authUrl"] || "",config["apiUrl"] || ""]);
  if(APPLICATIONS.has(key)){
    return APPLICATIONS.get(key);
  }
  let ctx = {
    "node":substrate.node_create({"id":"finfolk-app"}),
    "states":new Map(),
    "member":null,
    "publicTransport":null
  };
  ctx["public"] = backbone.createBackbone("public",function (name,value,options){
    return ctx["publicTransport"](name,value,options);
  },{"node":ctx["node"],"space":"public"});
  let app = {
    "node":ctx["node"],
    "public":ctx["public"],
    "state":function (name,value){
        return state(ctx,name,value,arguments["length"] > 1);
      },
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
    "setPublicTransport":function (transport){
        ctx["publicTransport"] = transport;
      },
    "member":function (actor,transport){
        return member(ctx,actor,transport);
      },
    "clearMember":function (){
        if(ctx["member"]){
          ctx["member"].close();
        }
        ctx["member"] = null;
        state(ctx,"auth",{"status":"signed-out"},true);
      },
    "auth":function (kind,work){
        return auth(ctx,kind,work);
      }
  };
  APPLICATIONS.set(key,app);
  return app;
}