// Generated from finfolk-web.lib.directory-discovery; do not edit.
export function text(value,limit){
  return ((typeof value) == "string") ? value.trim().slice(0,limit) : "";
}

export function searchQuery(request){
  return "freediving " + request.category + " " + text(request.region,100) + " " + ((request.category == "Freediver") ? text(request.country,100) : "Australia") + " " + text(request.seed,100);
}

export function candidate(request,result){
  try{
    if(!result || !text(result.title,160) || ((typeof result.url) != "string") || (result.url.length > 2048)){
      return null;
    }
    let url = new URL(result.url);
    if((url.protocol != "https:") || url.username || url.password){
      return null;
    }
    url.hash = "";
    let host = url.hostname.toLowerCase().replace(new RegExp("^www[.]"),"");
    let social = "";
    if(["instagram.com","tiktok.com"].includes(host)){
      let match = url.pathname.match(new RegExp(
        (host == "instagram.com") ? "^/([a-zA-Z0-9._]{1,30})/?$" : "^/@([a-zA-Z0-9._]{1,30})/?$"
      ));
      if(!match || ["p","reel","explore","stories","accounts"].includes(match[1].toLowerCase())){
        return null;
      }
      social = (((host == "instagram.com") ? "instagram:" : "tiktok:") + match[1].toLowerCase());
    }
    return {
      "identity":social ? social : ("website:" + url.href.replace(new RegExp("/$"),"")),
      "document":{
            "sources":[url.href],
            "country":text(request.country,100) || "Australia",
            "image":"",
            "website":social ? "" : url.href,
            "name":text(result.title,160),
            "locality":text(request.region,100),
            "socials":social ? [social] : [],
            "state":request.state || "",
            "category":request.category,
            "description":""
          },
      "notes":text(result.description,2000)
    };
  }
  catch(error){
    return null;
  }
}

export function collectCandidates(request,pages){
  let result = [];
  for(let page of pages.slice(0,3)){
    if(page.web && Array.isArray(page.web.results)){
      for(let item of page.web.results.slice(0,20)){
        let value = candidate(request,item);
        if(value){
          result.push(value);
        }
      };
    }
  };
  return result;
}