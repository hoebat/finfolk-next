(ns finfolkdb.common.type-social-post-test
  (:use code.test)
  (:require [lang.core :as l] [finfolkbuild.testing.neon :as neon]
            [finfolkbuild.testing.behavior :as fixture]))
(l/script- :postgres
  {:runtime :jdbc.client :config (neon/config)
   :require [[finfolkdb.main.scaffold-001-entity :as main] [postgres.core :as pg]
             [finfolkdb.common.type-social-post :as t]
             [finfolkdb.fn.user.user-manage-posts :as posts]
             [finfolkdb.common.type-user :as users]]})
(fact:global {:setup [(neon/setup!)] :teardown [(neon/teardown!)]})

^{:refer finfolkdb.common.type-social-post/SocialPost :id consent-and-blocks}
(fact "approval cannot invent consent and either direction of blocking hides a public post"
  (fixture/member "posts-alice") (fixture/member "posts-bob") (fixture/beach "posts-beach")
  (let [post (posts/insert-social-post "posts-alice" "posts-beach" "https://www.instagram.com/p/TEST"
                                     "instagram" "ocean" false (fixture/op "create-post" "posts-alice"))
        id (:id post)]
    (:status post) => "pending"
    (posts/ret-social-post-public id "posts-bob") => nil
    (pg/t:update t/SocialPost {:track {} :where {:id id} :set {:status "approved"}})
    (posts/ret-social-post-public id "posts-bob") => nil
    (pg/t:update t/SocialPost {:track {} :where {:id id} :set {:public-consent true}})
    (:url (posts/ret-social-post-public id "posts-bob")) => "https://www.instagram.com/p/TEST"
    (pg/t:insert users/UserBlock {:owner "posts-bob" :target "posts-alice"} {:track {}})
    (posts/ret-social-post-public id "posts-bob") => nil
    (pg/t:delete users/UserBlock {:where {:owner "posts-bob"}})
    (pg/t:insert users/UserBlock {:owner "posts-alice" :target "posts-bob"} {:track {}})
    (posts/ret-social-post-public id "posts-bob") => nil
    (:id (posts/ret-social-post-public id "")) => id
    (pg/t:update users/User {:track {} :where {:id "posts-alice"} :set {:deleted true}})
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
  (fixture/member "report-bob") (fixture/beach "report-beach")
  (let [post (posts/insert-social-post "report-bob" "report-beach" "https://www.instagram.com/p/REPORT"
                                     "instagram" "bob" false (fixture/op "create-post" "report-bob"))
        report (pg/t:insert t/SocialPostReport {:post (:id post) :reporter "report-bob" :reason "Wrong location"} {:track {}})]
    (:reason (pg/t:get t/SocialPostReport {:where {:id (:id report)}})) => "Wrong location"
    (pg/t:insert t/SocialPostReport {:post (:id post) :reporter "report-bob" :reason "Again"} {:track {}}) => (throws)
    (pg/t:delete t/SocialPost {:where {:id (:id post)}})
    (pg/t:get t/SocialPostReport {:where {:id (:id report)}}) => nil))

