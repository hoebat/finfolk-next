// Generated from finfolk-web.lib.sqlite; do not edit.
import initSqlite from '@sqlite.org/sqlite-wasm'

import * as proto from '@xtalk/lang/common-protocol.js'

import * as sqlite from '@xtalk/db/system/impl-sqlite.js'

import * as sql from '@xtalk/net/conn-sql.js'

export function CacheClient(raw){
  globalThis["xt_lang_common_protocol$$IMPLEMENTATIONS"]["finfolk_web.lib.sqlite/CacheClient"] = true;
  proto.register_protocol_impl(sql.ISqlClient["on"],"finfolk_web.lib.sqlite/CacheClient",{
    "connect":connect,
    "disconnect":disconnect,
    "query":query,
    "query_async":queryAsync
  });
  return {
    "::":"finfolk_web.lib.sqlite/CacheClient",
    "::/protocols":[sql.ISqlClient["on"]],
    "::/protocol-impls":{
        [sql.ISqlClient["on"]]:{
          "connect":connect,
          "disconnect":disconnect,
          "query":query,
          "query_async":queryAsync
        }
      },
    "raw":raw
  };
}

export function query(client,statement){
  let columns = [];
  let values = client["raw"].exec({
    "sql":statement,
    "rowMode":"array",
    "columnNames":columns,
    "returnValue":"resultRows"
  });
  if((values["length"] == 1) && (values[0]["length"] == 1)){
    let value = values[0][0];
    if(((typeof value) == "string") && (value.startsWith("[") || value.startsWith("{") || (value == "true") || (value == "false") || (value == "null"))){
      return JSON.parse(value);
    }
    return value;
  }
  return columns["length"] ? [{"columns":columns,"values":values}] : values;
}

export function connect(client,_opts){
  return Promise.resolve(client);
}

export function disconnect(client){
  client["raw"].close();
}

export function queryAsync(client,statement){
  return Promise.resolve(query(client,statement));
}

export var SCHEMA = {
  "Result":{
    "id":{"ident":"id","type":"text","primary":true,"order":0},
    "scope":{"ident":"scope","type":"text","order":1},
    "value":{"ident":"value","type":"jsonb","order":2},
    "used":{"ident":"used","type":"integer","order":3},
    "size":{"ident":"size","type":"integer","order":4}
  }
};

export function rows(store,statement,bindings){
  return store["db"].exec({
    "sql":statement,
    "bind":bindings || [],
    "rowMode":"object",
    "returnValue":"resultRows"
  });
}

export function initializeStore(store){
  let db = store["db"];
  let impl = store["impl"];
  let version = db.selectValue("PRAGMA user_version");
  if(version > 1){
    db.close();
    throw new Error(
      "Application cache was written by a newer version. Reload all FinFolk tabs."
    );
  }
  try{
    if(db.selectValue("PRAGMA quick_check") != "ok"){
      throw new Error("Application cache needs rebuilding.");
    }
    if(version == 0){
      db.exec("PRAGMA auto_vacuum=INCREMENTAL");
      sqlite.clear_db(impl);
      db.exec("PRAGMA user_version=1");
    }
    db.exec("SELECT 1 FROM Result LIMIT 1");
  }
  catch(error){
    sqlite.clear_db(impl);
    db.exec("PRAGMA user_version=1");
    store["reason"] = "Application cache was rebuilt. Saved maps are unaffected.";
  }
  return store;
}

export async function openStore(directory,ephemeral,options){
  let init = initSqlite["default"] || initSqlite;
  let module = await init(Object.assign({
    "locateFile":function (name){
        return new URL(
          (name == "sqlite3.wasm") ? "./sqlite3.wasm" : name,
          import.meta["url"]
        )["href"];
      }
  },options || {}));
  let db = null;
  let mode = "memory";
  let reason = null;
  if(!ephemeral){
    try{
      let pool = await module.installOpfsSAHPoolVfs({"directory":directory,"preserveOnInitFailure":true});
      db = new pool["OpfsSAHPoolDb"]("/cache.sqlite3");
      mode = "persistent";
    }
    catch(error){
      reason = "Persistent application storage is unavailable for this visit.";
    }
  }
  if(!db){
    db = new module["oo1"]["DB"](":memory:","c");
  }
  db.exec("PRAGMA secure_delete=ON; PRAGMA journal_mode=DELETE;");
  let client = CacheClient(db);
  let impl = sqlite.impl_sqlite(client,SCHEMA,{"Result":{"position":0}});
  let store = {
    "db":db,
    "impl":impl,
    "mode":mode,
    "reason":reason,
    "memory":new Map()
  };
  return initializeStore(store);
}

export function cacheKey(scope,id){
  return scope + "|" + id;
}

export function getEntry(store,scope,id){
  let key = cacheKey(scope,id);
  rows(store,"UPDATE Result SET used=? WHERE id=?",[Date.now(),key]);
  if(store["memory"].has(key)){
    return store["memory"].get(key);
  }
  let record = rows(store,"SELECT value FROM Result WHERE id=?",[key])[0];
  if(record){
    rows(store,"UPDATE Result SET used=? WHERE id=?",[Date.now(),key]);
    return JSON.parse(record["value"]);
  }
}

export function putEntry(store,scope,id,value,spec){
  let key = cacheKey(scope,id);
  let entry = {"data":value,"savedAt":Date.now(),"domain":spec["domain"]};
  store["memory"].set(key,entry);
  if((spec["cache"] != false) && !spec["admin"] && !spec["write"] && (spec["domain"] != "admin")){
    try{
      sqlite.record_add(store["impl"],"Result",[
        {
              "id":key,
              "scope":scope,
              "value":entry,
              "used":Date.now(),
              "size":new TextEncoder().encode(JSON.stringify(entry))["byteLength"]
            }
      ]);
    }
    catch(error){
      store["reason"] = "Application cache could not be saved. Online requests still work.";
    }
  }
}

export function removeEntry(store,scope,id){
  let key = cacheKey(scope,id);
  store["memory"].delete(key);
  try{
    sqlite.record_delete(store["impl"],"Result",[key]);
  }
  catch(error){
    store["reason"] = "Application storage is unavailable.";
  }
}

export function clearScope(store,scope){
  for(let id of store["memory"].keys()){
    if(id.startsWith(scope + "|")){
      store["memory"].delete(id);
    }
  };
  rows(store,"DELETE FROM Result WHERE scope=?",[scope]);
}

export function invalidateDomains(store,scope,domains){
  for(let [id,entry] of store["memory"]){
    if(id.startsWith(scope + "|") && (!entry["domain"] || domains.includes(entry["domain"]))){
      store["memory"].delete(id);
    }
  };
  if(domains["length"] > 0){
    let slots = domains.map(function (){
      return "?";
    }).join(",");
    rows(
      store,
      "DELETE FROM Result WHERE scope=? AND (json_extract(value,'$.domain') IS NULL OR json_extract(value,'$.domain') IN (" + slots + "))",
      [scope].concat(domains)
    );
  }
}

export function adapter(store,scope){
  return {
    "get":function (id){
        return getEntry(store,scope,id);
      },
    "put":function (id,value,spec){
        putEntry(store,scope,id,value,spec);
      },
    "remove":function (id){
        removeEntry(store,scope,id);
      },
    "invalidate":function (domains){
        invalidateDomains(store,scope,domains);
      },
    "clear":function (){
        clearScope(store,scope);
      }
  };
}

export function storageStats(store){
  return {
    "mode":store["mode"],
    "message":store["reason"],
    "bytes":store["db"].selectValue("PRAGMA page_count") * store["db"].selectValue("PRAGMA page_size"),
    "entries":rows(
        store,
        "SELECT id,size AS bytes,used FROM Result ORDER BY used",
        []
      )
  };
}

export function removeIds(store,ids){
  for(let id of ids){
    sqlite.record_delete(store["impl"],"Result",[id]);
    store["memory"].delete(id);
  };
  if(ids["length"] > 0){
    store["db"].exec("PRAGMA incremental_vacuum");
  }
}