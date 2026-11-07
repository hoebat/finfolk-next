// Generated from finfolk-web.lib.atlas-pages; do not edit.
export async function loadSiteNotes(read,inputs,actor){
  return await read(actor ? "member" : "public",{});
}

export async function optionalRead(read,name,values,fallback){
  try{
    return await read(name,values);
  }
  catch(error){
    return fallback;
  }
}

export async function loadMedia(read,sdk,inputs,actor){
  let values = {"beachId":inputs["beachId"]};
  let shared = actor ? sdk("shared",[values]).catch(function (){
    return [];
  }) : [];
  let [feed,trips,posts] = await Promise.all([
    optionalRead(read,"feed",values,{"posts":[]}),
    optionalRead(read,"trips",values,{"trips":[]}),
    shared
  ]);
  return {"feed":feed,"trips":trips["trips"] || [],"shared":posts || []};
}

export async function loadTrips(read,inputs,actor){
  return await optionalRead(read,"trips",{"beachId":inputs["beachId"]},{"trips":[]});
}

export async function loadFeed(read,inputs,actor){
  let values = {
    "beachId":inputs["beachId"],
    "cursor":inputs["cursor"] || "",
    "postId":inputs["postId"] || ""
  };
  if(actor){
    return await read("member",values);
  }
  if(!values["cursor"]){
    delete(values["cursor"]);
  }
  if(!values["postId"]){
    delete(values["postId"]);
  }
  return await read("public",values);
}