(ns finfolkdb.common.type-social-post-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.behavior :as fixture]))
(l/script- :postgres
  {:runtime :jdbc.client
   :config (local/config)
   :require [[finfolkdb.main.scaffold-001-entity :as main]
             [postgres.core :as pg]
             [finfolkdb.common.type-social-post :as t]
             [finfolkdb.fn.user.user-manage-posts :as posts]
             [finfolkdb.common.type-user :as users]]})
(fact:global {:setup [(local/setup!)] :teardown [(local/teardown!)]})

^{:refer finfolkdb.common.type-social-post/SocialPost :id consent-and-blocks}
(fact "approval cannot invent consent and either direction of blocking hides a public post"
  (fixture/member "9d745d17-475e-5ddb-b3ec-4047ec80f348")
  (fixture/member "49e68bf7-802d-5a93-bc0f-c5758b12434c")
  (fixture/beach "8396a4a9-981c-55fa-804b-9a761dde79fa")
  (let
    [post (posts/insert-social-post "9d745d17-475e-5ddb-b3ec-4047ec80f348"
                                    "8396a4a9-981c-55fa-804b-9a761dde79fa"
                                    "https://www.instagram.com/p/TEST"
                                    "instagram" "ocean"
                                    false (fixture/op "create-post"
                                                      "9d745d17-475e-5ddb-b3ec-4047ec80f348"))
     id (:id post)]
    (:status post) => "pending"
    (posts/ret-social-post-public id "49e68bf7-802d-5a93-bc0f-c5758b12434c") => nil
    (pg/t:update t/SocialPost {:track {} :where {:id id} :set {:status "approved"}})
    (posts/ret-social-post-public id "49e68bf7-802d-5a93-bc0f-c5758b12434c") => nil
    (pg/t:update t/SocialPost {:track {} :where {:id id} :set {:public-consent true}})
    (:url (posts/ret-social-post-public id "49e68bf7-802d-5a93-bc0f-c5758b12434c"))
    =>
    "https://www.instagram.com/p/TEST"
    (pg/t:insert users/UserBlock
      {:owner "49e68bf7-802d-5a93-bc0f-c5758b12434c" :target "9d745d17-475e-5ddb-b3ec-4047ec80f348"}
      {:track {}})
    (posts/ret-social-post-public id "49e68bf7-802d-5a93-bc0f-c5758b12434c") => nil
    (pg/t:delete users/UserBlock {:where {:owner "49e68bf7-802d-5a93-bc0f-c5758b12434c"}})
    (pg/t:insert users/UserBlock
      {:owner "9d745d17-475e-5ddb-b3ec-4047ec80f348" :target "49e68bf7-802d-5a93-bc0f-c5758b12434c"}
      {:track {}})
    (posts/ret-social-post-public id "49e68bf7-802d-5a93-bc0f-c5758b12434c") => nil
    (:id (posts/ret-social-post-public id "")) => id
    (pg/t:update users/User
      {:track {} :where {:id "9d745d17-475e-5ddb-b3ec-4047ec80f348"} :set {:deleted true}})
    (posts/ret-social-post-public id "") => nil))

^{:refer finfolkdb.common.type-social-post/SocialReferral :id referral-identity}
(fact "provider referrals round-trip independently and prevent duplicate provider identities"
  (pg/t:insert t/SocialReferral {:platform "instagram"} {:track {}})
  (:platform (pg/t:get t/SocialReferral {:where {:platform "instagram"}})) => "instagram"
  (pg/t:insert t/SocialReferral {:platform "instagram"} {:track {}}) => (throws)
  (pg/t:insert t/SocialReferral {:platform "tiktok"} {:track {}})
  (:platform (pg/t:get t/SocialReferral {:where {:platform "tiktok"}})) => "tiktok")

^{:refer finfolkdb.common.type-social-post/SocialPostReport :id report-lifecycle}
(fact "a member reports a post once and deleting the post removes its reports"
  (fixture/member "bc24607a-ed58-5715-8cbe-f3956852e7bd")
  (fixture/beach "3554c359-0956-52b9-aee5-8c66334cc389")
  (let
    [post (posts/insert-social-post "bc24607a-ed58-5715-8cbe-f3956852e7bd"
                                    "3554c359-0956-52b9-aee5-8c66334cc389"
                                    "https://www.instagram.com/p/REPORT"
                                    "instagram" "bob"
                                    false (fixture/op "create-post"
                                                      "bc24607a-ed58-5715-8cbe-f3956852e7bd"))
     report
     (pg/t:insert t/SocialPostReport
       {:post (:id post) :reporter "bc24607a-ed58-5715-8cbe-f3956852e7bd" :reason "Wrong location"}
       {:track {}})]
    (:reason (pg/t:get t/SocialPostReport {:where {:id (:id report)}})) => "Wrong location"
    (pg/t:insert t/SocialPostReport
      {:post (:id post) :reporter "bc24607a-ed58-5715-8cbe-f3956852e7bd" :reason "Again"}
      {:track {}})
    =>
    (throws)
    (pg/t:delete t/SocialPost {:where {:id (:id post)}})
    (pg/t:get t/SocialPostReport {:where {:id (:id report)}}) => nil))
