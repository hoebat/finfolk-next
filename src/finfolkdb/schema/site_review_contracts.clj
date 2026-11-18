(ns finfolkdb.schema.site-review-contracts
  "Site authoring/review contracts shared by generated RPCs and page actions."
  (:require [finfolkdb.schema.directory-contracts :as d]))
(defn enum [values] {:type "string" :enum values})
(def POINT (d/array-of {:type "number"}))
(def ACCESS (d/object {:mode (enum ["shore" "departure"]) :name d/S :point POINT :source_url d/S :booking_url d/S :notes d/S :verified d/B} ["mode" "name" "point" "source_url"]))
(def DEPTH (d/object {:kind (enum ["surveyed" "reported"]) :depth_m {:type "number"} :reference d/S :source_url d/S :reviewed_at d/S :vertical_datum d/S :datum_type d/S :uncertainty_m {:type ["number" "null"]}} ["kind" "depth_m" "reference" "source_url"]))
(def FACT (d/object {:label d/S :text d/S :source_url d/S :reviewed_at d/S} ["label" "text" "source_url"]))
(def RESTRICTION (d/object {:activity d/S :status (enum ["restricted" "closed" "unknown"]) :text d/S :source_url d/S :reviewed_at d/S} ["activity" "status" "text" "source_url"]))
(def DOCUMENT (d/object {:id d/S :name d/S :state_id (enum ["VIC" "NSW" "JBT" "QLD" "SA" "WA" "NT" "TAS" "ACT" "EXT"])
                         :state d/S :area_name d/S :area_id d/S :timezone d/S :point POINT
                         :waterbody (enum ["ocean" "lake" "river" "quarry" "sinkhole" "pool" "unknown"])
                         :access_mode (enum ["shore" "boat_only" "shore_or_boat" "unknown"])
                         :source_url d/S :source_id d/S :reference_label d/S :description d/S :reviewed_at d/S :region d/S
                         :requirements d/S :booking_url d/S :activity_status (enum ["documented" "unknown"])
                         :coordinate_purpose (enum ["reference" "entry" "dive"]) :coordinate_provenance d/S :timezone_provenance d/S
                         :attribution d/S :licence d/S :archived d/B
                         :features (d/array-of (enum ["beach" "reef" "wreck" "wall" "training"]))
                         :activities (d/array-of (enum ["freediving" "ocean-swimming" "spearfishing"])) :aliases (d/array-of d/S)
                         :access_points (d/array-of ACCESS) :depth_evidence (d/array-of DEPTH)
                         :facts (d/array-of FACT) :restrictions (d/array-of RESTRICTION)}
                        ["id" "name" "state_id" "area_name" "timezone" "point" "source_url"]))
(def DRAFT (d/object {:id d/U :site_id {:type ["string" "null"]} :site_key d/S :owner_id {:type ["string" "null"]}
                      :import_id {:type ["string" "null"]} :base_revision d/N :version d/N
                      :status (enum ["draft" "submitted" "published" "rejected" "withdrawn"])
                      :payload DOCUMENT :reason d/S :reviewed_by {:type ["string" "null"]} :created_at d/S :updated_at d/S}
                     ["id" "site_id" "site_key" "owner_id" "import_id" "base_revision" "version" "status" "payload" "reason" "reviewed_by" "created_at" "updated_at"]))
(def SAVE (d/object {:id d/U :requestId d/U :version d/N :site DOCUMENT} ["site"]))
(def VERSION (d/object {:id d/U :version d/N} ["id" "version"]))
(def OK (d/object {:ok d/B} ["ok"]))
(defn op [action request result write]
  {:rpc (str "native_site_review_" (.replace action "-" "_")) :arguments ["$actor" "$verified" "$values"]
   :actor "server" :action action :request request :result result :write write})
(def OPERATIONS
  {"mySiteSubmissions" (op "mine" d/E (d/object {:submissions (d/array-of DRAFT) :admin d/B} ["submissions" "admin"]) false)
   "siteSubmissionSave" (op "submit" SAVE DRAFT true)
   "siteSubmissionWithdraw" (op "withdraw" VERSION OK true)
   "siteAdmin" (op "admin" d/E (d/object {:drafts (d/array-of DRAFT) :imports (d/array-of {:type "object" :additionalProperties true})} ["drafts" "imports"]) false)
   "siteDraftSave" (op "save" SAVE DRAFT true)
   "siteDraftPublish" (op "publish" VERSION (d/object {:ok d/B :site d/U :revision d/N} ["ok" "site" "revision"]) true)
   "siteDraftReject" (op "reject" (update (assoc-in VERSION [:properties :reason] d/S) :required conj "reason") OK true)})
