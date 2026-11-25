(ns finfolkdb.schema.note-contracts
  (:require [finfolkdb.schema.directory-contracts :as d]))
(def NOTE (d/object {:id d/U :site d/U :topic {:type "string" :enum ["access" "facilities" "wildlife" "conditions"]}
                     :text d/S :author d/S :createdAt d/S :observedOn {:type ["string" "null"]}
                     :revision d/N :score d/N :own d/B :upvoted d/B :downvoted d/B}
                    ["id" "site" "topic" "text" "author" "createdAt" "observedOn" "revision" "score" "own" "upvoted" "downvoted"]))
(def BASE {:site d/U :id d/U})
(def LIST (d/object {:site d/U :sort {:type "string" :enum ["helpful" "newest"]}
                     :topic {:type "string" :enum ["all" "access" "facilities" "wildlife" "conditions"]}
                     :offset {:type ["integer" "string"]}} ["site"]))
(def OWNED (d/object {:id d/U :topic d/S :text d/S :observedOn {:type ["string" "null"]}
                       :revision d/N :withdrawn d/B :hidden d/B}
                      ["id" "topic" "text" "observedOn" "revision" "withdrawn" "hidden"]))
(def FEED (d/object {:enabled d/B :notes (d/array-of NOTE) :next {:type ["integer" "null"]} :ownNote (assoc OWNED :type ["object" "null"])} ["enabled" "notes" "next" "ownNote"]))
(defn op [action request result write & [public]]
  {:rpc (str "native_notes_" (.replace action "-" "_")) :arguments ["$actor" "$verified" "$values"]
   :actor "server" :action action :request request :result result :write write :public (boolean public)
   :not-found "Note unavailable."})
(def OPERATIONS
  {"publicSiteNotes" (op "public-list" LIST FEED false true)
   "siteNotes" (op "list" LIST FEED false)
   "siteNoteSave" (op "save" (d/object (merge BASE {:revision {:type "integer" :minimum 1} :topic d/S :text d/S :observedOn {:type ["string" "null"]}}) ["site" "id" "topic" "text"])
                      (d/object {:id d/U :revision d/N} ["id" "revision"]) true)
   "siteNoteVote" (op "vote" (assoc (d/object (assoc BASE :upvoted d/B :vote {:type "integer" :enum [-1 0 1]}) ["site" "id"]) :anyOf [{:required ["vote"]} {:required ["upvoted"]}]) NOTE true)
   "siteNoteWithdraw" (op "withdraw" (d/object (merge BASE {:revision d/N :withdrawn d/B}) ["site" "id" "revision" "withdrawn"])
                          (d/object {:id d/U :revision d/N :withdrawn d/B} ["id" "revision" "withdrawn"]) true)
   "siteNoteReport" (op "report" (d/object (assoc BASE :reason d/S) ["site" "id" "reason"])
                        (d/object {:reported d/B} ["reported"]) true)
   "siteNoteModerate" (op "moderate" (d/object (assoc BASE :hidden d/B) ["site" "id" "hidden"])
                          (d/object {:id d/U :hidden d/B} ["id" "hidden"]) true)})
