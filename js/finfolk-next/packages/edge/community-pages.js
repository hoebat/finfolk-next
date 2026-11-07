// Generated from finfolk-web.lib.community-pages; do not edit.
export function approvedPosts(posts){
  return posts.filter(function (post){
    return (post["status"] == "approved") && post["public_consent"];
  });
}

export async function featuredExtras(read,member,listed){
  let missing = (member["featuredLogs"] || []).filter(function (id){
    return !(listed["sessions"] || []).some(function (row){
      return row["id"] == id;
    });
  });
  let results = await Promise.allSettled(missing.map(function (id){
    return read("session",{"id":id});
  }));
  return results.filter(function (result){
    return result["status"] == "fulfilled";
  }).map(function (result){
    return result["value"];
  });
}

export function publicLogs(rows,selected,owner){
  let available = rows.filter(function (row){
    return row && (row["visibility"] == "public") && (row["ownerId"] == owner);
  });
  if(Array.isArray(selected)){
    return selected.map(function (id){
      return available.find(function (row){
        return row["id"] == id;
      });
    }).filter(Boolean);
  }
  return available.slice(0,6);
}

export async function loadProfile(read,inputs,actor){
  let own = !inputs["target"];
  let me = await read("me",{});
  let id = inputs["target"] || actor;
  let [member,connections] = await Promise.all([
    own ? Object.assign({},me["profile"],{"id":id}) : read("profile",{"target":id}),
    read("connections",{})
  ]);
  if(member["restricted"]){
    return {"member":member};
  }
  let sites = inputs["sites"] || [];
  let selected = sites.find(function (site){
    return site["id"] == inputs["location"];
  }) || sites.find(function (site){
    return site["id"] == (me["profile"]["beaches"] || [])[0];
  }) || sites.find(function (site){
    return site["id"] == "bondi";
  }) || sites[0];
  let [posts,listed,blocks,stats] = await Promise.all([
    own ? read("posts",{}) : (member["posts"] || []),
    read("sessions",{"owner":id,"publicOnly":true}),
    own ? read("blocks",{}) : [],
    (!own && selected) ? read("stats",{"target":id,"beachId":selected["id"]}) : null
  ]);
  let extra = await featuredExtras(read,member,listed);
  return {
    "member":member,
    "connections":connections,
    "blocks":blocks,
    "stats":(stats && stats["stats"]) || {},
    "selected":selected,
    "posts":own ? approvedPosts(posts) : posts,
    "logs":publicLogs(
        (listed["sessions"] || []).concat(extra),
        member["featuredLogs"],
        id
      )
  };
}

export async function loadEditor(read,inputs,actor){
  let [me,listed,posts] = await Promise.all([read("me",{}),read("sessions",{}),read("posts",{})]);
  let profile = me["profile"];
  let extra = await featuredExtras(read,profile,listed);
  let logs = (listed["sessions"] || []).concat(extra).filter(function (row){
    return row && (row["ownerId"] == actor) && (row["visibility"] == "public");
  });
  return {"profile":profile,"logs":logs,"posts":approvedPosts(posts)};
}

export async function loadPeople(read,inputs,actor){
  let [data,me] = await Promise.all([read("people",inputs["query"]),read("me",{})]);
  return {
    "people":data["people"] || [],
    "cursor":data["cursor"],
    "open":me["profile"]["open"]
  };
}