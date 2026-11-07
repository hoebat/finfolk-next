// Generated from finfolk-web.lib.account-pages; do not edit.
export async function loadSiteReview(read,inputs,actor){
  let data = await read("sites",{});
  let batches = [];
  for(let batch of data["imports"].filter(function (item){
    return item["status"] == "draft";
  })){
    batches.push(await read("batch",{"id":batch["id"]}));
  };
  return Object.assign({},data,{"batches":batches});
}

export async function loadPostManager(read,inputs,actor){
  let posts = await read("myPosts",{});
  try{
    return {"posts":posts,"followed":await read("followedPosts",{})};
  }
  catch(error){
    return {"posts":posts,"followedError":true};
  }
}

export async function loadDiscovery(read,inputs,actor){
  let state = await read("instagramStatus",{});
  let data = await read("instagramMyPosts",{});
  return {"data":data,"admin":state["admin"]};
}

export async function loadMessaging(read,inputs,actor){
  try{
    let state = await read("state",{});
    let events = await read("events",{});
    return {"state":state,"events":events["events"]};
  }
  catch(error){
    if([401,403].includes(error["status"])){
      return {"forbidden":true};
    }
    throw error;
  }
}