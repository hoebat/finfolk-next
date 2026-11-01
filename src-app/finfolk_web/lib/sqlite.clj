(ns finfolk-web.lib.sqlite
  "SQLite/OPFS storage owned by the dedicated kernel worker."
  (:refer-clojure :exclude [key])
  (:require [lang.core :as l]
            [xt.lang.common-protocol :refer [defimpl.xt]]))
(l/script :js
  {:require [[xt.lang.common-protocol :as proto]
             [xt.net.conn-sql :as sql]
             [xt.db.system.impl-sqlite :as sqlite]]
   :import [["@sqlite.org/sqlite-wasm" :as initSqlite]]})

(defn.js query [client statement]
  (var columns [])
  (var values (. (. client ["raw"]) (exec {"sql" statement "rowMode" "array" "columnNames" columns "returnValue" "resultRows"})))
  (when (and (== (. values ["length"]) 1) (== (. values [0] ["length"]) 1))
    (var value (. values [0] [0]))
    (when (and (== (typeof value) "string")
               (or (. value (startsWith "[")) (. value (startsWith "{")) (== value "true") (== value "false") (== value "null")))
      (return (JSON.parse value)))
    (return value))
  (return (:? (. columns ["length"]) [{"columns" columns "values" values}] values)))
(defn.js connect [client _opts] (return (Promise.resolve client)))
(defn.js disconnect [client] (. (. client ["raw"]) (close)))
(defn.js queryAsync [client statement] (return (Promise.resolve (-/query client statement))))
(defimpl.xt ^{:lang :js} CacheClient [raw]
  sql/ISqlClient {sql/connect -/connect sql/disconnect -/disconnect sql/query -/query sql/query-async -/queryAsync})

(def.js SCHEMA
  {"Result" {"id" {"ident" "id" "type" "text" "primary" true "order" 0}
             "scope" {"ident" "scope" "type" "text" "order" 1}
             "value" {"ident" "value" "type" "jsonb" "order" 2}
             "used" {"ident" "used" "type" "integer" "order" 3}
             "size" {"ident" "size" "type" "integer" "order" 4}}})
(defn.js rows [store statement bindings]
  (return (. (. store ["db"]) (exec {"sql" statement "bind" (or bindings []) "rowMode" "object" "returnValue" "resultRows"}))))
(defn.js initializeStore [store]
  (var db (. store ["db"]))
  (var impl (. store ["impl"]))
  (var version (. db (selectValue "PRAGMA user_version")))
  (when (> version 1) (. db (close)) (throw (new Error "Application cache was written by a newer version. Reload all FinFolk tabs.")))
  (try
    (when (not= (. db (selectValue "PRAGMA quick_check")) "ok") (throw (new Error "Application cache needs rebuilding.")))
    (when (== version 0) (. db (exec "PRAGMA auto_vacuum=INCREMENTAL")) (sqlite/clear-db impl) (. db (exec "PRAGMA user_version=1")))
    (. db (exec "SELECT 1 FROM Result LIMIT 1"))
    (catch error
      (sqlite/clear-db impl) (. db (exec "PRAGMA user_version=1"))
      (:= (. store ["reason"]) "Application cache was rebuilt. Saved maps are unaffected.")))
  (return store))

(defn.js ^{:- [:async]} openStore [directory ephemeral options]
  (var init (or (. initSqlite ["default"]) initSqlite))
  (var module (await (init (Object.assign {"locateFile" (fn [name] (return (. (new URL (:? (== name "sqlite3.wasm") "./sqlite3.wasm" name) (. import.meta ["url"])) ["href"])))} (or options {})))))
  (var db nil) (var mode "memory") (var reason nil)
  (when (not ephemeral)
    (try
      (var pool (await (. module (installOpfsSAHPoolVfs {"directory" directory "preserveOnInitFailure" true}))))
      (:= db (new (. pool ["OpfsSAHPoolDb"]) "/cache.sqlite3"))
      (:= mode "persistent")
      (catch error (:= reason "Persistent application storage is unavailable for this visit."))))
  (when (not db) (:= db (new (. module ["oo1"] ["DB"]) ":memory:" "c")))
  (. db (exec "PRAGMA secure_delete=ON; PRAGMA journal_mode=DELETE;"))
  (var client (-/CacheClient db))
  (var impl (sqlite/impl-sqlite client -/SCHEMA {"Result" {"position" 0}}))
  (var store {"db" db "impl" impl "mode" mode "reason" reason "memory" (new Map)})
  (return (-/initializeStore store)))

(defn.js cacheKey [scope id] (return (+ scope "|" id)))
(defn.js getEntry [store scope id]
  (var key (-/cacheKey scope id))
  (-/rows store "UPDATE Result SET used=? WHERE id=?" [(Date.now) key])
  (when (. (. store ["memory"]) (has key)) (return (. (. store ["memory"]) (get key))))
  (var record (. (-/rows store "SELECT value FROM Result WHERE id=?" [key]) [0]))
  (when record
    (-/rows store "UPDATE Result SET used=? WHERE id=?" [(Date.now) key])
    (return (JSON.parse (. record ["value"])))))
(defn.js putEntry [store scope id value spec]
  (var key (-/cacheKey scope id))
  (var entry {"data" value "savedAt" (Date.now) "domain" (. spec ["domain"])})
  (. (. store ["memory"]) (set key entry))
  (when (and (not (. spec ["admin"])) (not (. spec ["write"])) (not= (. spec ["domain"]) "admin"))
    (try
      (sqlite/record-add (. store ["impl"]) "Result"
        [{"id" key "scope" scope "value" entry "used" (Date.now) "size" (. (new TextEncoder) (encode (JSON.stringify entry)) ["byteLength"])}])
      (catch error (:= (. store ["reason"]) "Application cache could not be saved. Online requests still work.")))))
(defn.js removeEntry [store scope id]
  (var key (-/cacheKey scope id))
  (. (. store ["memory"]) (delete key))
  (try (sqlite/record-delete (. store ["impl"]) "Result" [key])
       (catch error (:= (. store ["reason"]) "Application storage is unavailable."))))
(defn.js clearScope [store scope]
  (for:iter [id (. (. store ["memory"]) (keys))]
    (when (. id (startsWith (+ scope "|"))) (. (. store ["memory"]) (delete id))))
  (-/rows store "DELETE FROM Result WHERE scope=?" [scope]))
(defn.js invalidateDomains [store scope domains]
  (for:iter [[id entry] (. store ["memory"])]
    (when (and (. id (startsWith (+ scope "|")))
               (or (not (. entry ["domain"])) (. domains (includes (. entry ["domain"])))))
      (. (. store ["memory"]) (delete id))))
  (when (> (. domains ["length"]) 0)
    (var slots (. (. domains (map (fn [] (return "?")))) (join ",")))
    (-/rows store (+ "DELETE FROM Result WHERE scope=? AND (json_extract(value,'$.domain') IS NULL OR json_extract(value,'$.domain') IN (" slots "))") (. [scope] (concat domains)))))
(defn.js adapter [store scope]
  (return {"get" (fn [id] (return (-/getEntry store scope id)))
           "put" (fn [id value spec] (-/putEntry store scope id value spec))
           "remove" (fn [id] (-/removeEntry store scope id))
           "invalidate" (fn [domains] (-/invalidateDomains store scope domains))
           "clear" (fn [] (-/clearScope store scope))}))
(defn.js storageStats [store]
  (return {"mode" (. store ["mode"]) "message" (. store ["reason"])
           "bytes" (* (. (. store ["db"]) (selectValue "PRAGMA page_count")) (. (. store ["db"]) (selectValue "PRAGMA page_size")))
           "entries" (-/rows store "SELECT id,size AS bytes,used FROM Result ORDER BY used" [])}))
(defn.js removeIds [store ids]
  (for:array [id ids]
    (sqlite/record-delete (. store ["impl"]) "Result" [id])
    (. (. store ["memory"]) (delete id)))
  (when (> (. ids ["length"]) 0) (. (. store ["db"]) (exec "PRAGMA incremental_vacuum"))))
