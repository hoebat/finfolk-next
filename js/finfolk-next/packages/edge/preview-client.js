// Generated from finfolk-web.lib.preview-client; do not edit.
import * as registry from '@finfolk/edge/operations.js'

import * as application from '@finfolk/edge/application.js'

export function createPreviewClient(config,actor){
  let app = application.createApplicationBackbone(config);
  app.authProvider = "preview";
  app.configuration = config;
  let user = (actor == "guest") ? null : {
    "uid":actor,
    "email":"preview@example.test",
    "emailVerified":true
  };
  let selectActor = function (nextActor){
    sessionStorage.setItem("finfolk:preview:actor",nextActor);
    let url = new URL(location.href);
    url.searchParams.delete("previewActor");
    location.assign(url.href);
    return Promise.resolve({});
  };
  let transport = async function (operation,values){
    let response = await fetch("/api/preview/operation",{
      "method":"POST",
      "headers":{"Content-Type":"application/json"},
      "body":JSON.stringify({"operation":operation,"values":values,"actor":actor})
    });
    let result = await response.json();
    if(!response.ok){
      throw Object.assign(new Error(result.error),{"status":response.status});
    }
    return result;
  };
  app.setPublicTransport(transport);
  let model = user ? app.member(actor,transport) : app.public;
  let client = {
    "ready":app.ready,
    "observe":function (listener){
        listener(user);
        return function (){

        };
      },
    "google":function (){
        return selectActor("alice");
      },
    "call":function (name,values){
        return model.call(name,values || {});
      },
    "user":user,
    "auth":{
        "signUp":{
            "email":function (_input){
                return selectActor("alice");
              }
          }
      },
    "configuration":config,
    "email":function (_email,_password){
        return selectActor("alice");
      },
    "reset":function (_email){
        throw new Error("Mock preview does not send password reset emails.");
      },
    "refresh":function (){
        return Promise.resolve();
      },
    "authProvider":"preview",
    "application":app,
    "request":async function (path,options){
        let method = (options && options.method) || "GET";
        let pathname = new URL(path,"http://preview")["pathname"];
        let name = Object.keys(registry.operations).find(function (key){
          let spec = registry.operations[key];
          return (spec.transport == "rest") && (spec.method == method) && new RegExp(
            "^" + spec.path.replace(new RegExp(":[a-z]+","g"),"[^/]+") + "$"
          ).test(pathname);
        });
        if(name){
          let values = {"__rest":true,"path":path};
          if(method != "GET"){
            values.body = (options.body || {});
          }
          return await model.call(name,values);
        }
        let response = await fetch("/api/preview/request?path=" + encodeURIComponent(path),{
          "method":"POST",
          "headers":{"Content-Type":"application/json"},
          "body":JSON.stringify({"actor":actor,"options":options})
        });
        let result = await response.json();
        if(!response.ok){
          throw Object.assign(new Error(result.error),{"status":response.status});
        }
        return result;
      },
    "supports":function (_){
        return true;
      },
    "notice":user ? "" : "Mock preview: use any email and password to sign in as Alice. No real authentication or email delivery occurs.",
    "signOut":function (){
        return selectActor("guest");
      },
    "subscribe":function (name,values,listener){
        return model.subscribe(name,values,listener);
      }
  };
  client.ensureProfile = async function (){
    let me = await client.call("me",{});
    return Object.assign({},me.profile,{"id":actor,"uid":actor});
  };
  client.profile = (function (target){
    return client.call("profile",{"target":target});
  });
  client.list = (function (values){
    return client.call("sessions",values || {});
  });
  client.get = (function (id){
    return client.call("session",{"id":id});
  });
  client.save = async function (id,values){
    let result = await client.call("saveSession",{"id":id,"values":values});
    return result.id;
  };
  client.visibility = (function (id,visibility){
    return client.call("visibility",{"id":id,"visibility":visibility});
  });
  client.deleteSession = (function (id){
    return client.call("deleteSession",{"id":id});
  });
  return client;
}