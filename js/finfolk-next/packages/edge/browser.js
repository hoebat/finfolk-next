// Generated from finfolk-web.lib.browser; do not edit.
export var Configuration = {"promise":null};

export async function appConfiguration(){
  if(!Configuration["promise"]){
    let url = new URL("./neon-config.json",import.meta["url"]);
    url["searchParams"].set("v",import.meta["url"]);
    Configuration["promise"] = fetch(url,{"cache":"no-cache","signal":AbortSignal.timeout(5000)}).catch(function (_){
      return fetch(
        new URL("./neon-config.json",import.meta["url"]),
        {"cache":"no-cache","signal":AbortSignal.timeout(5000)}
      );
    }).then(function (response){
      if(!response["ok"]){
        throw new Error("Account configuration unavailable.");
      }
      return response.json();
    });
  }
  try{
    return await Configuration["promise"];
  }
  catch(error){
    Configuration["promise"] = Promise.resolve({"backbone":false});
    return {"backbone":false};
  }
}

export async function httpOperation(config,name,input,options){
  options = (options || {});
  let runtime = await import("./next-backbone.js");
  let spec = runtime["operations"][name];
  if(!spec || spec["auth"] || (spec["transport"] != "rest")){
    throw new Error("Invalid public operation.");
  }
  let path = spec["path"].replace(new RegExp(":([a-z]+)","g"),function (_,key){
    return encodeURIComponent(input[key]);
  });
  let base = config["apiUrl"];
  let url = new URL(
    path.replace(new RegExp("^/"),""),
    base.endsWith("/") ? base : (base + "/")
  );
  if(!spec["write"]){
    for(let key of Object.keys(input)){
      let value = input[key];
      if((value != null) && !spec["path"].includes(":" + key)){
        url["searchParams"].set(key,String(value));
      }
    };
  }
  let init = {
    "method":spec["method"],
    "cache":"no-store",
    "referrerPolicy":"no-referrer",
    "signal":options["signal"]
  };
  if(spec["write"]){
    let body = Object.assign({},input);
    Object.keys(body).forEach(function (key){
      if(spec["path"].includes(":" + key)){
        delete(body[key]);
      }
    });
    Object.assign(init,{
      "headers":{"Content-Type":"application/json"},
      "body":JSON.stringify(body),
      "keepalive":name == "publicReferral"
    });
  }
  let response = await fetch(url,init);
  let result = await response.json();
  if(!response["ok"]){
    let error = result["error"];
    throw Object.assign(
      new Error((error && error["message"]) || error || "Request failed."),
      {"status":response["status"]}
    );
  }
  return result;
}

export async function applicationBackbone(config){
  if(config){
    Configuration["promise"] = Promise.resolve(config);
  }
  config = (config || await appConfiguration());
  if(!config["backbone"]){
    return null;
  }
  let runtime = await import("./next-backbone.js");
  let app = runtime.createApplicationBackbone(config);
  app.setPublicTransport(function (name,input,options){
    return httpOperation(config,name,input,options);
  });
  return app;
}

export async function publicOperation(name,input,apiUrl,legacy,options){
  if(!Configuration["promise"]){
    return legacy();
  }
  let config = await appConfiguration();
  if(!config["backbone"]){
    return legacy();
  }
  if(apiUrl && (new URL(apiUrl)["origin"] != new URL(config["apiUrl"])["origin"])){
    throw new Error("Public API environment mismatch.");
  }
  let app = await applicationBackbone(config);
  return app["public"].call(name,input,options || {});
}