// Generated from finfolk-web.lib.logbook-pages; do not edit.
export async function loadLogbook(read,inputs,actor){
  let config = inputs["config"];
  if(inputs["session"]){
    let entry = await read("session",{"id":inputs["session"]});
    if((entry["visibility"] != "public") && (entry["ownerId"] != actor)){
      throw new Error("This session is private. Sign in with its owner account.");
    }
    return {
      "config":config,
      "entry":entry,
      "profile":await read("profile",{"target":entry["ownerId"]})
    };
  }
  if(inputs["profile"]){
    return {
      "config":config,
      "profile":await read("profile",{"target":inputs["profile"]})
    };
  }
  if(actor){
    await read("ensure",{});
  }
  return {"config":config};
}

export async function loadExtras(read,sdk,inputs,actor){
  let config = inputs["config"];
  let posts = (config["instagram"] && config["instagram"]["enabled"]) ? await sdk("social-posts",[{"owner":inputs["owner"]}]) : [];
  let trips = [];
  if(config["apiUrl"]){
    try{
      let result = await read("trips",{"ownerId":inputs["owner"]});
      trips = (result["trips"] || []);
    }
    catch(error){
      null;
    }
  }
  return {"posts":posts,"trips":trips};
}