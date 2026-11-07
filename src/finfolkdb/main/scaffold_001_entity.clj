(ns finfolkdb.main.scaffold-001-entity
  "Fresh entity database entrypoint."
  (:require [lang.core :as l]))

(l/script :postgres
  {:require [[finfolkdb.fn.user.user-manage :as user]
             [finfolkdb.common.type-user-activity :as activity]
             [finfolkdb.common.fn-system-util :as util]
             [finfolkdb.fn.directory.directory-manage :as directory]
             [finfolkdb.fn.event.event-manage :as event]
             [finfolkdb.common.type-social-post :as post]
             [finfolkdb.common.type-media-import :as media]
             [finfolkdb.common.type-user-report :as report]
             [finfolkdb.fn.user.user-manage-logbook :as logbook]
             [finfolkdb.fn.user.user-manage-posts :as post-api]
             [finfolkdb.fn.user.user-manage-trips :as trips]
             [finfolkdb.common.type-environment-base :as environment]
             [finfolkdb.common.type-import-base :as reference-import]
             [finfolkdb.common.type-site-base :as site]
             [finfolkdb.common.type-social-instagram :as instagram]
             [finfolkdb.common.type-social-tiktok :as tiktok]
             [finfolkdb.fn.messaging.messaging-manage :as messaging]
             [finfolkdb.fn.messaging.messaging-authorization :as messaging-auth]
             [finfolkdb.fn.messaging.messaging-oauth :as messaging-oauth]
             [finfolkdb.fn.messaging.messaging-chat :as messaging-chat]
             [finfolkdb.common.type-user-reward :as reward]
             [finfolkdb.fn.site.site-notes :as site-notes]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})
