(ns finfolk-web.groups.finnies)
(def OPERATIONS
  (into {} (for [[name path method admin] [["finniesWallet" "/v1/me/finnies" "GET" false]
                                          ["finniesRedeem" "/v1/me/finnies/redeem" "POST" false]
                                          ["finniesAdmin" "/v1/admin/finnies" "GET" true]
                                          ["finniesSave" "/v1/admin/finnies/items" "POST" true]
                                          ["finniesGrant" "/v1/admin/finnies/grant" "POST" true]
                                          ["finniesComplete" "/v1/admin/finnies/complete" "POST" true]]]
             [name {"name" name "path" path "method" method "transport" "rest" "auth" true
                    "admin" admin "cache" false "write" (= method "POST") "domain" "finnies"}])))
