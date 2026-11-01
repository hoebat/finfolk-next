(ns finfolk-web.groups.invitations
  "Browser bindings for invitations; HTTP permissions remain server-owned.")

(def OPERATIONS
 {"invitationClaim" {"auth" true
 "domain" "invitations"
 "name" "invitationClaim"
 "transport" "action"
 "write" true}
 "invitationStatus" {"auth" true
 "domain" "invitations"
 "name" "invitationStatus"
 "transport" "action"
 "write" false}})
