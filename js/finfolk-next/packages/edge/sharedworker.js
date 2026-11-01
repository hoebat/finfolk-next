// Generated from finfolk-web.lib.sharedworker; do not edit.
import * as registry from '@finfolk/edge/operations.js'

export var Clients = new Set();

export var Host = null;

export var Kernel = null;

export var Generation = 0;

export var Uncertain = new Map();

export function send(client,message){
  try{
    client["port"].postMessage(message);
  }
  catch(error){
    null;
  }
}

export function flag(scope,domain,type){
  Generation = (Generation + 1);
  Uncertain.set(scope + "|" + domain,Generation);
  for(let target of Clients){
    send(target,{"type":type,"scope":scope,"domain":domain});
  };
}

export function attach(client){
  let channel = new MessageChannel();
  client["kernel"] = channel["port2"];
  channel["port2"]["onmessage"] = (function (event){
    let data = event["data"];
    if(data["type"] == "blocked"){
      flag(data["scope"],data["domain"],"blocked");
    }
    if(data["type"] == "result"){
      let write = client["writes"].get(data["id"]);
      if(write && data["error"] && data["error"]["mutationOutcomeUnknown"]){
        flag(write["scope"],write["domain"],"uncertain");
      }
      client["writes"].delete(data["id"]);
    }
    send(client,event["data"]);
  });
  channel["port2"].start();
  Kernel.postMessage({"type":"connect"},[channel["port1"]]);
}

export function elect(){
  if(!Host){
    Host = Array.from(Clients).find(function (client){
      return client["active"];
    });
    if(Host){
      send(Host,{"type":"spawn"});
    }
  }
}

export function uncertain(client){
  for(let write of client["writes"].values()){
    flag(write["scope"],write["domain"],"uncertain");
  };
  client["writes"].clear();
}

export function restart(){
  if(Kernel){
    Kernel.postMessage({"type":"shutdown"});
    Kernel.close();
  }
  if(Host){
    send(Host,{"type":"stop-kernel"});
  }
  Kernel = null;
  Host = null;
  for(let client of Clients){
    uncertain(client);
    if(client["kernel"]){
      client["kernel"].close();
    }
    client["kernel"] = null;
    send(client,{"type":"restarting"});
  };
  elect();
}

export function detach(client){
  uncertain(client);
  Clients.delete(client);
  if(client["kernel"]){
    client["kernel"].postMessage({"type":"detach"});
    client["kernel"].close();
  }
  client["kernel"] = null;
  if(client == Host){
    restart();
  }
  else{
    if(!Host){
      elect();
    }
  }
}

export function message(client,event){
  let data = event["data"];
  client["seen"] = Date.now();
  if(data["type"] == "coordinator"){
    send(client,{
      "type":"result",
      "id":data["id"],
      "result":{
            "generation":Generation,
            "pendingWrites":Array.from(Clients).reduce(function (n,c){
                  return n + c["writes"]["size"];
                },0),
            "uncertainDomains":Uncertain["size"],
            "clients":Clients["size"],
            "kernel":!!Kernel,
            "host":!!Host
          }
    });
  }
  else if(data["type"] == "ping"){
    send(client,{"type":"pong"});
    client["active"] = true;
    if(!Clients.has(client)){
      Clients.add(client);
      send(client,{"type":"restarting"});
      if(Kernel){
        attach(client);
      }
    }
    if(!Host){
      elect();
    }
  }
  else if(data["type"] == "yield"){
    client["active"] = false;
    if(client == Host){
      restart();
    }
  }
  else if(data["type"] == "detach"){
    detach(client);
  }
  else if(data["type"] == "kernel"){
    if((client == Host) && !Kernel){
      Kernel = event["ports"][0];
      Kernel.start();
      for(let target of Clients){
        attach(target);
      };
    }
  }
  else if(data["type"] == "kernel-failed"){
    if(client == Host){
      for(let target of Clients){
        send(target,{
          "type":"fatal",
          "error":{"message":"SQLite worker could not start."}
        });
      };
    }
  }
  else{
    if(client["kernel"]){
      if(data["type"] == "call"){
        let spec = registry.operations[data["name"]];
        if(spec && spec["write"]){
          client["writes"].set(data["id"],{"scope":data["scope"],"domain":spec["domain"]});
        }
      }
      let spec = registry.operations[data["name"]];
      let fence = Uncertain.get(data["scope"] + "|" + (spec && spec["domain"]));
      if(spec && spec["write"] && fence && (fence >= client["born"])){
        client["writes"].delete(data["id"]);
        send(client,{
          "type":"result",
          "id":data["id"],
          "error":{
                    "message":"Reload before making another change: confirm whether the previous change was saved.",
                    "mutationOutcomeUnknown":true
                  }
        });
      }
      else{
        client["kernel"].postMessage(data);
      }
    }
  }
}

export function start(){
  globalThis["onconnect"] = (function (event){
    Generation = (Generation + 1);
    let client = {
      "born":Generation,
      "port":event["ports"][0],
      "seen":Date.now(),
      "active":true,
      "writes":new Map()
    };
    Clients.add(client);
    client["port"]["onmessage"] = (function (event){
      message(client,event);
    });
    client["port"].start();
    if(Kernel){
      attach(client);
    }
    else{
      elect();
    }
  });
  setInterval(function (){
    for(let client of Clients){
      if((Date.now() - client["seen"]) > 8000){
        detach(client);
      }
    };
  },2000);
}

export var Started = start();