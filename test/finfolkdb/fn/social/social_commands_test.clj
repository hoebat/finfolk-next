(ns finfolkdb.fn.social.social-commands-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.jdbc :as jdbc]))
(l/script- :postgres
  {:runtime :jdbc.client
   :config (local/config)
   :require [[finfolkdb.fn.social.social-commands :as commands]]})
(fact:global {:setup [(local/prepare!) (l/rt:restart) (l/rt:teardown :postgres)
                      (l/rt:setup :postgres)]
              :teardown [(l/rt:teardown :postgres) (l/rt:stop) (local/cleanup!)]})

(fact "the native registry distinguishes public, member and mock-only commands"
  (select-keys (commands/social-command-registry) [:ping :connect :whoami])
  =>
  {:ping {:public true}
   :connect {:public true :private-channel true}
   :whoami {:member true :private-channel true :mock-only true}})

(fact "private messages parse public commands and aliases in the database"
  (:command (commands/parse-social-command "message" " /PiNg  ")) => "ping"
  (:command (commands/parse-social-command "message" "/menu")) => "help"
  (:command (commands/parse-social-command "message" "help")) => "help"
  (:args (commands/parse-social-command "message" "/help ACCOUNT")) => {:topic "account"}
  (:command (commands/parse-social-command "message" "ordinary greeting")) => "none")

(fact "unsupported or malformed commands retain no private arguments"
  (:error (commands/parse-social-command "message" "/unsupported private-code"))
  =>
  "unknown_command"
  (:args (commands/parse-social-command "message" "/unsupported private-code")) => {}
  (:error (commands/parse-social-command "message" "/ping extra")) => "unexpected_arguments"
  (with-open [db (local/connection)]
    (jdbc/scalar db
                 "SELECT finfolk_rpc.parse_social_command('message',?)->>'error'"
                 "/ping\n/connect"))
  =>
  "one_command"
  (:error (commands/parse-social-command "message" "/help unknown")) => "unknown_topic")

(fact "public comment commands use their own channel policy"
  (:command (commands/parse-social-command "mention" "/ping @finfolk.com.au")) => "ping"
  (:command (commands/parse-social-command "owned" "/help")) => "help"
  (:command (commands/parse-social-command "mention" "/ping")) => "none"
  (:error (commands/parse-social-command "message" "/claim secret")) => "unexpected_arguments"
  (:command (commands/parse-social-command "message" "/claim")) => "claim"
  (:guidance (commands/parse-social-command "mention" "@finfolk.com.au /claim")) => "use_dm"
  (:error (commands/parse-social-command "message" "/cancel")) => "unknown_command"
  (select-keys (commands/parse-social-command "mention" "/connect PRIVATE-CODE @finfolk.com.au")
               [:command :guidance :args])
  =>
  {:command "help" :guidance "use_dm" :args {:command "connect"}}
  (:command (commands/parse-social-command "mention" "Great dive @finfolk.com.au")) => "none"
  (commands/parse-social-command "invalid" "/ping") => (throws))

(fact "enabled help comes from the database registry and channel policy"
  (commands/social-command-help "message" "mock" "[\"help\",\"ping\",\"connect\",\"whoami\"]")
  =>
  {:reply "Available commands:\n/help\n/ping\n/connect\n/whoami"}
  (commands/social-command-help "mention" "mock" "[\"help\",\"ping\",\"connect\",\"whoami\"]")
  =>
  {:reply "Available commands:\n/help\n/ping"}
  (commands/social-command-help "message" "instagram" "[\"ping\",\"whoami\",\"unknown\"]")
  =>
  {:reply "Available commands:\n/ping"})

(fact "public replies are composed by the DSL and respect command enablement"
  (commands/social-public-reply (commands/parse-social-command "message" "/ping")
                                "message"
                                "mock"
                                "[\"ping\",\"help\"]")
  =>
  {:reply "Pong."}
  (commands/social-public-reply (commands/parse-social-command "message" "/ping")
                                "message"
                                "mock"
                                "[\"help\"]")
  =>
  nil
  (commands/social-public-reply (commands/parse-social-command "message" "hello")
                                "message"
                                "mock"
                                "[\"help\"]")
  =>
  nil
  (:reply (commands/social-public-reply
           (commands/parse-social-command "mention" "/connect SECRET @finfolk.com.au")
           "mention"
           "mock"
           "[\"help\"]"))
  =>
  "For account commands, send a DM to @finfolk.com.au. Connection codes and personal details are never posted in comments.")


(fact "disabled help and diagnostics cannot be advertised by fallback replies"
 (commands/social-public-reply (commands/parse-social-command "message" "/unsupported SECRET")
                               "message" "mock" "[\"ping\"]") => nil
 (commands/social-public-reply (commands/parse-social-command "message" "/help diagnostics")
                               "message" "mock" "[\"help\"]") => {:reply "Diagnostics are not enabled."}
 (commands/social-public-reply (commands/parse-social-command "message" "/help account")
                               "message" "mock" "[\"help\"]")
 => {:reply "Account linking is not enabled. Manage existing connections privately on FinFolk."})
