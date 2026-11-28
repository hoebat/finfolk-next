(ns finfolkdb.fn.social.social-commands
  "Native command registry and channel-aware parsing. No provider I/O."
  (:require [lang.core :as l]))

(l/script :postgres
  {:require [[postgres.core :as pg]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

(defn.pg ^{:props [:immutable :parallel-safe]}
  social-command-registry
  []
  (return
   (:jsonb
    "{\"help\":{\"public\":true},\"ping\":{\"public\":true},\"site\":{\"public\":true},\"privacy\":{\"public\":true},\"status\":{\"public\":true},\"claim\":{\"public\":true,\"privateChannel\":true,\"instagramOnly\":true},\"connect\":{\"public\":true,\"privateChannel\":true},\"disconnect\":{\"member\":true,\"privateChannel\":true},\"whoami\":{\"member\":true,\"privateChannel\":true,\"mockOnly\":true}}")))

(defn.pg ^{:props [:immutable :parallel-safe]}
  parse-social-command
  [:text i-channel :text i-text]
  (let [(:text v-text) (pg/btrim (pg/coalesce i-text ""))
        (:text v-name) ""
        (:text v-args) ""
        (:text v-topic) ""
        o-registry (-/social-command-registry)
        o-policy nil]
    (when (not (or (== i-channel "message") (== i-channel "mention") (== i-channel "owned")))
      [:raise-exception "Unknown social command channel"])
    (when (or (> (pg/length v-text) 2000)
              (> (#{"strpos"} v-text (#{"chr"} 10)) 0)
              (> (#{"strpos"} v-text (#{"chr"} 13)) 0))
      (return (pg/jsonb-build-object "command" "help" "error" "one_command" "args" (:jsonb "{}"))))
    (when (and (== i-channel "mention")
               (not (pg/coalesce (#{"regexp_like"}
                                  v-text
                                  "(^|[[:space:]])@finfolk[.]com[.]au([!?,]?)([[:space:]]|$)"
                                  "i")
                                 false)))
      (return (pg/jsonb-build-object "command" "none" "args" (:jsonb "{}"))))
    (when (not= i-channel "message")
      (:= v-text
          (pg/btrim (pg/regexp-replace v-text
                                       "(^|[[:space:]])@finfolk[.]com[.]au([!?,]?)([[:space:]]|$)"
                                       " "
                                       "gi"))))
    (when (== (pg/lower v-text) "help")
      (:= v-text "/help"))
    (when (not (#{"starts_with"} v-text "/"))
      (return (pg/jsonb-build-object "command" "none" "args" (:jsonb "{}"))))
    (:= v-name (pg/lower (pg/regexp-replace v-text "^/([A-Za-z]+).*$" "\\1")))
    (:= v-args (pg/btrim (pg/regexp-replace v-text "^/[A-Za-z]+" "")))
    (when (== v-name "menu")
      (:= v-name "help"))
    (when (not (pg/jsonb-exists o-registry v-name))
      (return
       (pg/jsonb-build-object "command" "help" "error" "unknown_command" "args" (:jsonb "{}"))))
    (:= o-policy (:-> o-registry v-name))
    (when (and (not= i-channel "message")
               (pg/coalesce (:boolean (:->> o-policy "privateChannel")) false))
      (return (pg/jsonb-build-object "command" "help"
                                     "guidance" "use_dm"
                                     "args" (pg/jsonb-build-object "command" v-name))))
    (when (== v-name "help")
      (:= v-topic (pg/lower v-args))
      (when (not (or (== v-topic "") (== v-topic "account") (== v-topic "diagnostics")))
        (return
         (pg/jsonb-build-object "command" "help" "error" "unknown_topic" "args" (:jsonb "{}"))))
      (return (pg/jsonb-build-object "command" "help"
                                     "args" (pg/jsonb-build-object "topic" v-topic)
                                     "policy" o-policy)))
    (when (not= v-args "")
      (return (pg/jsonb-build-object "command" "help"
                                     "error" "unexpected_arguments"
                                     "args" (pg/jsonb-build-object "command" v-name))))
    (return (pg/jsonb-build-object "command" v-name "args" (:jsonb "{}") "policy" o-policy))))

(defn.pg social-command-help
  "Build help from enabled registry entries, respecting the current channel/provider."
  [:text i-channel :text i-provider :jsonb i-enabled]
  (let [o-registry (-/social-command-registry)
        (:text v-help) "Available commands:"
        (:text v-name) nil
        o-policy nil]
    (when (not= (pg/jsonb-typeof i-enabled) "array")
      [:raise-exception "Enabled commands must be an array"])
    [:for v-name :in :select (pg/jsonb-array-elements-text i-enabled)
     (loop []
       (:= o-policy (:-> o-registry v-name))
       (when (and [o-policy :is-not-null]
                  (or (== i-channel "message")
                      (not (pg/coalesce (:boolean (:->> o-policy "privateChannel")) false)))
                  (or (== i-provider "mock")
                      (not (pg/coalesce (:boolean (:->> o-policy "mockOnly")) false)))
                  (or (not (pg/coalesce (:boolean (:->> o-policy "instagramOnly")) false)) (== i-provider "instagram") (== i-provider "mock")))
         (:= v-help (#{"concat"} v-help (#{"chr"} 10) "/" v-name))))]
    (return (pg/jsonb-build-object "reply" v-help))))

(defn.pg social-public-reply
  "Fixed public replies are database business logic, never adapter templates."
  [:jsonb i-parsed :text i-channel :text i-provider :jsonb i-enabled]
  (let [(:text v-command) (:->> i-parsed "command")
        (:text v-guidance) (:->> i-parsed "guidance")
        (:text v-topic) (:->> (:-> i-parsed "args") "topic")]
    (when (and (or [v-guidance :is-not-null] [(:->> i-parsed "error") :is-not-null])
               (not (pg/jsonb-exists i-enabled "help")))
      (return nil))
    (when (== v-guidance "use_dm")
      (return
       (pg/jsonb-build-object
        "reply"
        "For account commands, send a DM to @finfolk.com.au. Connection codes and personal details are never posted in comments.")))
    (when [(:->> i-parsed "error") :is-not-null]
      (return (pg/jsonb-build-object
               "reply"
               "Please send one supported command at a time. Send /help for available commands.")))
    (when (not (pg/jsonb-exists i-enabled v-command))
      (return nil))
    (when (== v-command "ping")
      (return (pg/jsonb-build-object "reply" "Pong.")))
    (when (== v-command "site")
      (return (pg/jsonb-build-object "reply" "Explore FinFolk: https://finfolk.com.au")))
    (when (== v-command "privacy")
      (return (pg/jsonb-build-object
               "reply"
               "Privacy and deletion information: https://api.finfolk.com.au/privacy")))
    (when (== v-command "help")
      (when (and (== v-topic "diagnostics") (not (pg/jsonb-exists i-enabled "ping")))
        (return (pg/jsonb-build-object "reply" "Diagnostics are not enabled.")))
      (when (and (== v-topic "account") (not (pg/jsonb-exists i-enabled "connect")))
        (return (pg/jsonb-build-object "reply" "Account linking is not enabled. Manage existing connections privately on FinFolk.")))
      (when (== v-topic "account")
        (return
         (pg/jsonb-build-object
          "reply"
          "Send /connect in a DM, then enter the private code in your signed-in FinFolk account. Use /claim in a DM for a business page ownership code. Enter that code on the matching FinFolk business page. Connecting never enables public sharing automatically.")))
      (when (== v-topic "diagnostics")
        (return (pg/jsonb-build-object "reply" "Send /ping to check that FinFolk is responding.")))
      (return (-/social-command-help i-channel i-provider i-enabled)))
    (return nil)))
