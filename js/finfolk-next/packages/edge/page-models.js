// Generated from finfolk-web.lib.page-models; do not edit.
import * as operations from '@finfolk/edge/operations.js'

import * as logbook from '@finfolk/edge/logbook-pages.js'

import * as atlas from '@finfolk/edge/atlas-pages.js'

import * as community from '@finfolk/edge/community-pages.js'

import * as account from '@finfolk/edge/account-pages.js'

export var pages = {
  "messaging-settings":{
    "routes":[],
    "area":"member",
    "loader":"messaging-settings",
    "models":{
      "state":{"operation":"messagingSettings","bindings":{}},
      "events":{
        "operation":"messagingEvents",
        "bindings":{},
        "defaults":{"limit":25}
      }
    },
    "actions":{
      "save":{"operation":"messagingSettingsSave","bindings":{}},
      "authorize":{"operation":"messagingAuthorize","bindings":{}},
      "retry":{"operation":"messagingEventRetry","bindings":{}}
    }
  },
  "logbook-editor":{
    "routes":[],
    "area":"member",
    "models":{},
    "actions":{
      "save":{
        "operation":"saveSession",
        "bindings":{},
        "sdk":{"method":["save"],"args":["id","values"]}
      },
      "assignImportedMedia":{"operation":"assignImportedMedia","bindings":{}}
    },
    "sdk-actions":{
      "upload":{"method":["upload"]},
      "remove-photo":{"method":["removePhoto"]},
      "photo":{"method":["photo"]},
      "social-posts":{"method":["instagramPosts"]}
    }
  },
  "map":{
    "routes":["/map"],
    "area":"public",
    "models":{
      "listings":{"operation":"publicDirectory","bindings":{"*":"query"}},
      "events":{"operation":"publicEvents","bindings":{"*":"query"}},
      "listing":{"operation":"publicDirectoryDetail","bindings":{"id":"id"}},
      "event":{"operation":"publicEvent","bindings":{"id":"id"}},
      "popular":{"operation":"discoverPopular","bindings":{}}
    },
    "actions":{},
    "uses":["atlas"]
  },
  "post-manager":{
    "routes":["/account/posts"],
    "area":"member",
    "loader":"post-manager",
    "models":{
      "myPosts":{"operation":"myPosts","bindings":{}},
      "followedPosts":{"operation":"followedPosts","bindings":{}}
    },
    "actions":{
      "post":{"operation":"post","bindings":{}},
      "removePost":{"operation":"removePost","bindings":{}}
    }
  },
  "instagram-link":{
    "routes":[],
    "area":"member",
    "models":{"status":{"operation":"instagramClaimStatus","bindings":{}}},
    "actions":{
      "disconnect":{"operation":"instagramDisconnect","bindings":{}},
      "link":{"operation":"instagramProfileLink","bindings":{}},
      "connect":{"operation":"instagramCodeConnect","bindings":{}}
    }
  },
  "member-chooser":{"routes":["/members"],"area":"public","models":{},"actions":{}},
  "pages":{
    "routes":["/pages"],
    "area":"member",
    "models":{"mine":{"operation":"directoryMine","bindings":{}}},
    "actions":{"create":{"operation":"directoryCreate","bindings":{}}}
  },
  "site-notes":{
    "routes":[],
    "area":"mixed",
    "loader":"site-notes",
    "topics":{
      "access":"Entry & access",
      "facilities":"Facilities",
      "wildlife":"Marine life",
      "conditions":"Conditions"
    },
    "models":{
      "public":{
        "operation":"publicSiteNotes",
        "bindings":{"site":"site","*":"query"}
      },
      "member":{
        "operation":"siteNotes",
        "bindings":{"site":"site","*":"query"}
      }
    },
    "actions":{
      "save":{"operation":"siteNoteSave","bindings":{"site":"site"}},
      "vote":{"operation":"siteNoteVote","bindings":{"site":"site"}},
      "withdraw":{"operation":"siteNoteWithdraw","bindings":{"site":"site"}},
      "report":{"operation":"siteNoteReport","bindings":{"site":"site"}},
      "moderate":{"operation":"siteNoteModerate","bindings":{"site":"site"}}
    }
  },
  "account-checkin":{
    "routes":["/account/checkin"],
    "area":"member",
    "models":{"checkins":{"operation":"myCheckins","bindings":{}}},
    "actions":{
      "checkin":{"operation":"checkin","bindings":{}},
      "remove":{"operation":"removeCheckin","bindings":{}}
    }
  },
  "account-settings":{
    "routes":["/account/settings"],
    "area":"member",
    "models":{},
    "actions":{},
    "adapters":["theme","offline-storage","messaging-settings"]
  },
  "page-owner":{
    "routes":[],
    "area":"member",
    "models":{"access":{"operation":"pageAccess","bindings":{"id":"id"}}},
    "actions":{
      "save":{"operation":"directoryOwnerSave","bindings":{"id":"id"}},
      "invite":{"operation":"pageInvite","bindings":{"id":"id"}},
      "revoke":{"operation":"pageInviteRevoke","bindings":{"id":"id"}},
      "remove-admin":{"operation":"pageAdminRemove","bindings":{"id":"id"}}
    }
  },
  "account-privacy":{
    "routes":["/account/privacy"],
    "area":"member",
    "order":["connections","blocks"],
    "models":{
      "connections":{"operation":"connections","bindings":{}},
      "blocks":{"operation":"blocks","bindings":{}}
    },
    "actions":{
      "preferences":{"operation":"preferences","bindings":{}},
      "connection":{"operation":"connection","bindings":{}},
      "block":{"operation":"block","bindings":{}},
      "unblock":{"operation":"unblock","bindings":{}}
    },
    "auth-actions":{
      "google":{"method":["google"],"check-error":false},
      "sign-up":{"method":["auth","signUp","email"],"check-error":true},
      "email":{"method":["email"],"check-error":false},
      "reset":{"method":["reset"],"check-error":false},
      "refresh":{"method":["refresh"],"check-error":false},
      "verify":{"method":["verify"],"check-error":false},
      "verify-code":{"method":["verifyCode"],"check-error":false},
      "sign-out":{"method":["signOut"],"check-error":false},
      "delete-account":{"method":["deleteAccount"],"check-error":false},
      "reset-password":{"method":["resetPassword"],"check-error":false},
      "reauthenticate":{"method":["reauthenticate"],"check-error":false}
    }
  },
  "you-hub":{"routes":["/you"],"area":"public","models":{},"actions":{}},
  "directory-review":{
    "routes":["/pages/review"],
    "area":"member",
    "order":["mine","review"],
    "models":{
      "mine":{"operation":"directoryMine","bindings":{}},
      "review":{
        "operation":"directoryAdmin",
        "bindings":{},
        "require":[["models","mine","admin"]],
        "denied":"Administrator access required."
      }
    },
    "actions":{
      "save":{"operation":"directoryAdminSave","bindings":{}},
      "discover":{"operation":"directoryDiscover","bindings":{}},
      "merge":{"operation":"directoryMerge","bindings":{}},
      "claim-review":{"operation":"directoryClaimReview","bindings":{}},
      "report-resolve":{"operation":"directoryReportResolve","bindings":{}}
    }
  },
  "trip-manager":{
    "routes":[],
    "area":"member",
    "models":{"tripList":{"operation":"tripList","bindings":{}}},
    "actions":{
      "tripImportBatch":{"operation":"tripImportBatch","bindings":{}},
      "tripPublish":{"operation":"tripPublish","bindings":{}},
      "tripImportConfirm":{"operation":"tripImportConfirm","bindings":{}},
      "tripUnpublish":{"operation":"tripUnpublish","bindings":{}},
      "tripSave":{"operation":"tripSave","bindings":{}},
      "tripDives":{"operation":"tripDives","bindings":{}},
      "tripPreview":{"operation":"tripPreview","bindings":{}},
      "tripGet":{"operation":"tripGet","bindings":{}},
      "tripImportBegin":{"operation":"tripImportBegin","bindings":{}}
    }
  },
  "post-review":{
    "routes":[],
    "area":"member",
    "models":{
      "reviewPosts":{"operation":"reviewPosts","bindings":{"url":"url"}},
      "communityMetrics":{"operation":"communityMetrics","bindings":{}}
    },
    "actions":{
      "resolvePostReport":{"operation":"resolvePostReport","bindings":{}},
      "reviewPost":{"operation":"reviewPost","bindings":{}}
    }
  },
  "atlas":{
    "routes":[],
    "area":"public",
    "lifetime":"atlas-layout",
    "adapter":{
      "snapshot":"snapshot",
      "subscribe":"subscribe",
      "attach":"attach",
      "destroy":"destroy"
    },
    "models":{
      "siteCatalog":{"operation":"siteCatalog","bindings":{}},
      "discoverPopular":{"operation":"discoverPopular","bindings":{}}
    },
    "actions":{},
    "adapters":["map-engine","datasets","offline-packages","navigation"]
  },
  "people":{
    "routes":["/people"],
    "area":"member",
    "loader":"people",
    "models":{
      "people":{"operation":"community","bindings":{}},
      "me":{"operation":"me","bindings":{}}
    },
    "actions":{"connect":{"operation":"connection","bindings":{}}}
  },
  "finnies-shop":{
    "routes":["/shop"],
    "area":"public",
    "models":{"wallet":{"operation":"finniesWallet","bindings":{}}},
    "actions":{"redeem":{"operation":"finniesRedeem","bindings":{}}}
  },
  "directory":{
    "routes":["/directory"],
    "area":"public",
    "models":{
      "listings":{"operation":"publicDirectory","bindings":{"*":"query"}}
    },
    "actions":{}
  },
  "account-review":{
    "routes":["/account/review"],
    "area":"member",
    "models":{},
    "actions":{},
    "adapters":["site-review","post-review","trip-review"]
  },
  "profile":{
    "routes":["/profile","/members/[id]"],
    "area":"member",
    "loader":"profile",
    "models":{
      "me":{"operation":"me","bindings":{}},
      "profile":{"operation":"profile","bindings":{}},
      "connections":{"operation":"connections","bindings":{}},
      "posts":{"operation":"myPosts","bindings":{}},
      "sessions":{"operation":"sessions","bindings":{}},
      "session":{"operation":"session","bindings":{}},
      "blocks":{"operation":"blocks","bindings":{}},
      "stats":{"operation":"stats","bindings":{}}
    },
    "actions":{
      "connection":{"operation":"connection","bindings":{}},
      "block":{"operation":"block","bindings":{}},
      "unblock":{"operation":"unblock","bindings":{}}
    }
  },
  "trip-review":{
    "routes":[],
    "area":"member",
    "models":{
      "tripReviewInbox":{"operation":"tripReviewInbox","bindings":{}}
    },
    "actions":{"tripReview":{"operation":"tripReview","bindings":{}}}
  },
  "offline-templates":{
    "routes":["/offline-app/[screen]"],
    "kind":"internal",
    "area":"public",
    "models":{},
    "actions":{},
    "reason":"Build-only public shell templates, rendered at canonical application routes."
  },
  "event":{
    "routes":["/events/[id]"],
    "area":"member",
    "order":["event","roster"],
    "models":{
      "event":{"operation":"eventDetail","bindings":{"id":"id"}},
      "roster":{
        "operation":"eventRoster",
        "bindings":{"id":"id"},
        "when":[["models","event","canManage"]]
      }
    },
    "actions":{
      "cancel":{"operation":"eventCancel","bindings":{"id":"id"}},
      "invite":{"operation":"eventInvite","bindings":{"id":"id"}},
      "revoke":{"operation":"eventRevoke","bindings":{"id":"id"}},
      "rsvp":{"operation":"eventRsvp","bindings":{"id":"id"}},
      "moderate":{"operation":"eventModerate","bindings":{"id":"id"}}
    }
  },
  "community-catalog":{
    "routes":[],
    "area":"public",
    "models":{"catalog":{"operation":"siteCatalog","bindings":{}}},
    "actions":{}
  },
  "instagram-tools":{
    "routes":["/account/instagram"],
    "area":"member",
    "models":{
      "instagramStatus":{"operation":"instagramStatus","bindings":{}},
      "instagramActions":{"operation":"instagramActions","bindings":{}},
      "invitationStatus":{"operation":"invitationStatus","bindings":{}},
      "instagramAdminInbox":{"operation":"instagramAdminInbox","bindings":{}}
    },
    "actions":{
      "instagramCancel":{"operation":"instagramCancel","bindings":{}},
      "instagramConfirm":{"operation":"instagramConfirm","bindings":{}},
      "instagramPointsConsent":{"operation":"instagramPointsConsent","bindings":{}},
      "instagramReconcile":{"operation":"instagramReconcile","bindings":{}},
      "instagramRetryEvent":{"operation":"instagramRetryEvent","bindings":{}},
      "instagramReversePoints":{"operation":"instagramReversePoints","bindings":{}},
      "instagramReview":{"operation":"instagramReview","bindings":{}},
      "invitationClaim":{"operation":"invitationClaim","bindings":{}}
    },
    "retired-actions":{
      "instagramVerify":"Use /connect in Instagram, then enter the code on FinFolk."
    }
  },
  "practice-hub":{
    "routes":["/practice"],
    "area":"public",
    "models":{},
    "actions":{}
  },
  "logbook":{
    "routes":["/logbook"],
    "area":"mixed",
    "loader":"logbook",
    "models":{
      "session":{
        "operation":"session",
        "bindings":{},
        "sdk":{"method":["get"],"args":["id"]}
      },
      "profile":{
        "operation":"profile",
        "bindings":{},
        "sdk":{"method":["profile"],"args":["target"]}
      },
      "ensure":{
        "operation":"me",
        "bindings":{},
        "sdk":{"method":["ensureProfile"],"args":[],"optional":true}
      }
    },
    "actions":{
      "assignImportedMedia":{"operation":"assignImportedMedia","bindings":{}},
      "delete":{
        "operation":"deleteSession",
        "bindings":{},
        "sdk":{"method":["deleteSession"],"args":["id"]}
      },
      "visibility":{
        "operation":"visibility",
        "bindings":{},
        "sdk":{"method":["visibility"],"args":["id","visibility"]}
      }
    },
    "auth-actions":{
      "google":{"method":["google"],"check-error":false},
      "sign-up":{"method":["auth","signUp","email"],"check-error":true},
      "email":{"method":["email"],"check-error":false},
      "reset":{"method":["reset"],"check-error":false},
      "refresh":{"method":["refresh"],"check-error":false},
      "verify":{"method":["verify"],"check-error":false},
      "verify-code":{"method":["verifyCode"],"check-error":false},
      "sign-out":{"method":["signOut"],"check-error":false},
      "delete-account":{"method":["deleteAccount"],"check-error":false},
      "reset-password":{"method":["resetPassword"],"check-error":false},
      "reauthenticate":{"method":["reauthenticate"],"check-error":false}
    },
    "sdk-actions":{
      "upload":{"method":["upload"]},
      "remove-photo":{"method":["removePhoto"]},
      "photo":{"method":["photo"]},
      "social-posts":{"method":["instagramPosts"]}
    }
  },
  "place-community":{
    "routes":[],
    "area":"member",
    "models":{
      "community":{
        "operation":"community",
        "bindings":{"beachId":"beachId"},
        "defaults":{"cursor":null}
      }
    },
    "actions":{
      "checkin":{"operation":"checkin","bindings":{"beachId":"beachId"}},
      "community":{"operation":"community","bindings":{"beachId":"beachId"}},
      "stats":{"operation":"stats","bindings":{"beachId":"beachId"}},
      "connection":{"operation":"connection","bindings":{}},
      "block":{"operation":"block","bindings":{}},
      "report":{"operation":"report","bindings":{}},
      "reportPost":{"operation":"reportPost","bindings":{}}
    }
  },
  "instagram-commands":{
    "routes":[],
    "area":"member",
    "models":{
      "instagramCommandStatus":{
        "operation":"instagramCommandStatus",
        "bindings":{},
        "activity":"Instagram comment commands"
      }
    },
    "actions":{
      "instagramCommandConfirm":{"operation":"instagramCommandConfirm","bindings":{}},
      "instagramCommandResolve":{"operation":"instagramCommandResolve","bindings":{}},
      "instagramCommandReview":{"operation":"instagramCommandReview","bindings":{}},
      "instagramCommandVerify":{"operation":"instagramCommandVerify","bindings":{}}
    }
  },
  "discover":{
    "routes":["/discover"],
    "area":"public",
    "models":{},
    "actions":{},
    "uses":["atlas"],
    "resources":{"location":{"path":"/api/location"}}
  },
  "page-invitation":{
    "routes":["/pages/invitation"],
    "area":"member",
    "models":{},
    "actions":{
      "accept":{"operation":"pageInviteRedeem","bindings":{"token":"token"}}
    }
  },
  "account-integration":{
    "routes":[],
    "area":"member",
    "models":{
      "status":{"operation":"instagramDiscoveryStatus","bindings":{}}
    },
    "actions":{}
  },
  "profile-editor":{
    "routes":["/profile/edit"],
    "area":"member",
    "loader":"profile-editor",
    "models":{
      "me":{"operation":"me","bindings":{}},
      "sessions":{"operation":"sessions","bindings":{}},
      "session":{"operation":"session","bindings":{}},
      "posts":{"operation":"myPosts","bindings":{}}
    },
    "actions":{"save":{"operation":"preferences","bindings":{}}}
  },
  "logbook-extras":{
    "routes":[],
    "area":"mixed",
    "loader":"logbook-extras",
    "models":{"trips":{"operation":"publicTrips","bindings":{}}},
    "actions":{},
    "sdk-actions":{
      "upload":{"method":["upload"]},
      "remove-photo":{"method":["removePhoto"]},
      "photo":{"method":["photo"]},
      "social-posts":{"method":["instagramPosts"]}
    }
  },
  "event-public":{
    "routes":[],
    "area":"public",
    "models":{"event":{"operation":"publicEvent","bindings":{"id":"id"}}},
    "actions":{}
  },
  "site-submissions":{
    "routes":["/account/sites"],
    "area":"member",
    "models":{
      "submissions":{"operation":"mySiteSubmissions","bindings":{}}
    },
    "actions":{
      "save":{"operation":"siteSubmissionSave","bindings":{}},
      "withdraw":{"operation":"siteSubmissionWithdraw","bindings":{}}
    }
  },
  "place-trips":{
    "routes":[],
    "area":"public",
    "loader":"place-trips",
    "models":{"trips":{"operation":"publicTrips","bindings":{}}},
    "actions":{}
  },
  "event-invitation":{
    "routes":["/events/invitation"],
    "area":"member",
    "models":{},
    "actions":{
      "accept":{"operation":"eventAccept","bindings":{"token":"token"}}
    }
  },
  "place-public":{
    "routes":[],
    "area":"public",
    "models":{
      "publicInstagram":{"operation":"publicInstagram","bindings":{}},
      "publicTrips":{"operation":"publicTrips","bindings":{}},
      "publicPosts":{"operation":"publicPosts","bindings":{}}
    },
    "actions":{
      "referral":{"operation":"publicReferral","bindings":{}},
      "report":{"operation":"publicInstagramReport","bindings":{}}
    }
  },
  "account":{
    "routes":["/account"],
    "area":"member",
    "order":["me","status"],
    "models":{
      "me":{"operation":"me","bindings":{}},
      "status":{"operation":"postStatus","bindings":{}}
    },
    "actions":{},
    "auth-actions":{
      "google":{"method":["google"],"check-error":false},
      "sign-up":{"method":["auth","signUp","email"],"check-error":true},
      "email":{"method":["email"],"check-error":false},
      "reset":{"method":["reset"],"check-error":false},
      "refresh":{"method":["refresh"],"check-error":false},
      "verify":{"method":["verify"],"check-error":false},
      "verify-code":{"method":["verifyCode"],"check-error":false},
      "sign-out":{"method":["signOut"],"check-error":false},
      "delete-account":{"method":["deleteAccount"],"check-error":false},
      "reset-password":{"method":["resetPassword"],"check-error":false},
      "reauthenticate":{"method":["reauthenticate"],"check-error":false}
    }
  },
  "logbook-list":{
    "routes":[],
    "area":"mixed",
    "models":{
      "sessions":{
        "operation":"sessions",
        "bindings":{"owner":"owner","publicOnly":"publicOnly"},
        "sdk":{"method":["list"],"args":["$values"]},
        "defaults":{"cursor":null}
      }
    },
    "actions":{
      "more":{
        "operation":"sessions",
        "bindings":{},
        "sdk":{"method":["list"],"args":["$values"]}
      }
    }
  },
  "location-resource":{
    "routes":["/api/location"],
    "kind":"resource",
    "area":"public",
    "models":{},
    "actions":{},
    "reason":"IP hint resource; never an offline document."
  },
  "legacy-app":{
    "routes":["/app"],
    "kind":"compatibility",
    "area":"public",
    "models":{},
    "actions":{},
    "adapters":["legacyDestination"]
  },
  "place-media":{
    "routes":[],
    "area":"mixed",
    "loader":"place-media",
    "models":{
      "feed":{"operation":"publicInstagram","bindings":{}},
      "trips":{"operation":"publicTrips","bindings":{}}
    },
    "actions":{},
    "sdk-actions":{"shared":{"method":["instagramPosts"],"optional":true}}
  },
  "events":{
    "routes":["/events"],
    "area":"public",
    "models":{
      "events":{"operation":"publicEvents","bindings":{"*":"query"}}
    },
    "actions":{}
  },
  "listing":{
    "routes":["/directory/[id]"],
    "area":"public",
    "models":{
      "listing":{"operation":"publicDirectoryDetail","bindings":{"id":"id"}},
      "events":{"operation":"publicEvents","bindings":{"page":"id"}},
      "mine":{"operation":"directoryMine","bindings":{}}
    },
    "actions":{
      "claim":{"operation":"directoryClaim","bindings":{"id":"id"}},
      "report":{"operation":"directoryReport","bindings":{"id":"id"}}
    }
  },
  "account-identity":{
    "routes":[],
    "area":"member",
    "models":{"me":{"operation":"me","bindings":{}}},
    "actions":{}
  },
  "instagram-discovery":{
    "routes":[],
    "area":"member",
    "loader":"instagram-discovery",
    "models":{
      "instagramStatus":{"operation":"instagramStatus","bindings":{}},
      "instagramMyPosts":{"operation":"instagramMyPosts","bindings":{}},
      "instagramDiscoveryInbox":{"operation":"instagramDiscoveryInbox","bindings":{}}
    },
    "actions":{
      "instagramBindMediaOwner":{"operation":"instagramBindMediaOwner","bindings":{}},
      "instagramChoosePostBeach":{"operation":"instagramChoosePostBeach","bindings":{}},
      "instagramDiscoveryRetry":{"operation":"instagramDiscoveryRetry","bindings":{}},
      "instagramHidePost":{"operation":"instagramHidePost","bindings":{}},
      "instagramRemoveAllPosts":{"operation":"instagramRemoveAllPosts","bindings":{}},
      "instagramReviewPost":{"operation":"instagramReviewPost","bindings":{}},
      "instagramSharing":{"operation":"instagramSharing","bindings":{}},
      "instagramSuppressSource":{"operation":"instagramSuppressSource","bindings":{}}
    }
  },
  "home":{
    "routes":["/"],
    "area":"public",
    "models":{},
    "actions":{},
    "styles":[
      "landing",
      "identity",
      "landing-identity",
      "coastal-conditions",
      "feature-demos",
      "landing-theme"
    ],
    "effects":["landing"],
    "adapters":["homeDestination","landing-effects"]
  },
  "event-editor":{
    "routes":["/events/new"],
    "area":"member",
    "order":["eligible","event"],
    "models":{
      "eligible":{
        "operation":"directoryMine",
        "bindings":{},
        "select":"eligible-pages"
      },
      "event":{
        "operation":"eventDetail",
        "bindings":{"id":"id"},
        "when":[["inputs","id"],["models","eligible","length"]]
      }
    },
    "actions":{"save":{"operation":"eventSave","bindings":{}}}
  },
  "my-events":{
    "routes":["/events/my"],
    "area":"member",
    "models":{"events":{"operation":"eventMine","bindings":{}}},
    "actions":{}
  },
  "site-review":{
    "routes":[],
    "area":"member",
    "loader":"site-review",
    "models":{
      "sites":{"operation":"siteAdmin","bindings":{}},
      "batch":{"operation":"siteImportDetail","bindings":{}}
    },
    "actions":{
      "save":{"operation":"siteDraftSave","bindings":{}},
      "publish":{"operation":"siteDraftPublish","bindings":{}},
      "reject":{"operation":"siteDraftReject","bindings":{}},
      "stage":{"operation":"siteImportStage","bindings":{}},
      "publish-import":{"operation":"siteImportPublish","bindings":{}}
    }
  },
  "finnies-admin":{
    "routes":["/shop/manage"],
    "area":"member",
    "models":{"items":{"operation":"finniesAdmin","bindings":{}}},
    "actions":{
      "save":{"operation":"finniesSave","bindings":{}},
      "grant":{"operation":"finniesGrant","bindings":{}},
      "complete":{"operation":"finniesComplete","bindings":{}}
    }
  },
  "place-feed":{
    "routes":[],
    "area":"mixed",
    "loader":"place-feed",
    "models":{
      "member":{"operation":"posts","bindings":{}},
      "public":{"operation":"publicPosts","bindings":{}}
    },
    "actions":{}
  },
  "logbook-inbox":{
    "routes":[],
    "area":"member",
    "order":["result","tiktok"],
    "models":{
      "result":{"operation":"mediaInbox","bindings":{}},
      "tiktok":{"operation":"tiktokStatus","bindings":{}}
    },
    "actions":{
      "list":{
        "operation":"sessions",
        "bindings":{},
        "sdk":{"method":["list"],"args":["$values"]}
      },
      "tiktokSync":{"operation":"tiktokSync","bindings":{}},
      "tiktokDisconnect":{"operation":"tiktokDisconnect","bindings":{}},
      "tiktokConnect":{"operation":"tiktokConnect","bindings":{}},
      "updateImportedMedia":{"operation":"updateImportedMedia","bindings":{}},
      "assignImportedMedia":{"operation":"assignImportedMedia","bindings":{}},
      "hideImportedMedia":{"operation":"hideImportedMedia","bindings":{}}
    }
  },
  "public-report":{
    "routes":["/reports/[id]"],
    "area":"public",
    "models":{
      "report":{
        "operation":"publicTrip",
        "bindings":{"id":"id"},
        "validate":{
          "id":{
            "pattern":"^[a-f0-9-]{36}$",
            "message":"Choose a valid trip report."
          }
        },
        "not-found":"Trip report unavailable.",
        "error-body":true
      }
    },
    "actions":{}
  },
  "profiles-compatibility":{
    "routes":["/profiles"],
    "kind":"compatibility",
    "area":"public",
    "models":{},
    "actions":{},
    "adapters":["profileDestination"]
  },
  "trip-report":{
    "routes":[],
    "area":"member",
    "models":{},
    "actions":{"tripReport":{"operation":"tripReport","bindings":{}}}
  },
  "community-hub":{
    "routes":["/community"],
    "area":"public",
    "models":{},
    "actions":{}
  }
};

export function definition(key){
  let found = pages[key];
  if(!found){
    throw new Error("Unknown page: " + key);
  }
  return found;
}

export function bind(entry,inputs,payload){
  let values = Object.assign({},payload || {});
  Object.entries(entry["bindings"]).forEach(function ([target,source]){
    if(!Object.prototype.hasOwnProperty.call(inputs,source) || (inputs[source] == null)){
      throw new Error("Missing page binding: " + source);
    }
    if(target == "*"){
      Object.assign(values,inputs[source]);
    }
    else{
      values[target] = inputs[source];
    }
  });
  return values;
}

export function requestValues(spec,input){
  let path = spec["path"].replace(new RegExp(":([a-z]+)","g"),function (_,key){
    if(input[key] == null){
      throw new Error("Missing operation input: " + key);
    }
    return encodeURIComponent(input[key]);
  });
  let url = new URL(path,"https://local.invalid");
  if(spec["method"] == "GET"){
    Object.entries(input).forEach(function ([key,value]){
      if((value != null) && !spec["path"].includes(":" + key)){
        url["searchParams"].set(key,String(value));
      }
    });
    url["searchParams"].sort();
  }
  let values = {"__rest":true,"path":url["pathname"] + url["search"]};
  if(spec["method"] != "GET"){
    let body = Object.assign({},input);
    Object.keys(body).forEach(function (key){
      if(spec["path"].includes(":" + key)){
        delete(body[key]);
      }
    });
    values["body"] = body;
  }
  return values;
}

export async function invokeSdk(client,entry,args){
  let path = entry["method"];
  let owner = client;
  path.slice(0,-1).forEach(function (part){
    owner = owner[part];
  });
  let method = owner[path[path["length"] - 1]];
  if(entry["optional"] && ((typeof method) != "function")){
    return undefined;
  }
  return await method.apply(owner,args);
}

export function sdkArgs(entry,values){
  return entry["args"].map(function (key){
    return (key == "$values") ? values : values[key];
  });
}

export async function runSdkAction(client,key,name,args){
  let entry = (definition(key)["sdk-actions"] || {})[name];
  if(!entry){
    throw new Error("Undeclared SDK adapter: " + name);
  }
  return await invokeSdk(client,entry,args);
}

export function resolveModel(key,name,inputs,payload = null){
  let entry = definition(key)["models"][name];
  if(!entry){
    throw new Error("Undeclared page model: " + name);
  }
  let spec = operations.operation(entry["operation"]);
  let values = bind(
    entry,
    inputs,
    Object.assign({},entry["defaults"] || {},payload || {})
  );
  Object.entries(entry["validate"] || {}).forEach(function ([field,rule]){
    if(!new RegExp(rule["pattern"]).test(values[field])){
      throw new Error(rule["message"]);
    }
  });
  if(spec["auth"] && (spec["transport"] == "rest")){
    values = requestValues(spec,values);
  }
  return {"name":entry["operation"],"values":values,"spec":spec};
}

export async function runAction(client,key,name,inputs,payload,options = null){
  let page = definition(key);
  let retired = (page["retired-actions"] || {})[name];
  if(retired){
    throw Object.assign(new Error(retired),{"status":410,"code":"claim_retired"});
  }
  let entry = page["actions"][name];
  if(!entry){
    throw new Error("Undeclared page action: " + name);
  }
  let spec = operations.operation(entry["operation"]);
  let input = bind(entry,inputs,payload);
  if(entry["sdk"]){
    return await invokeSdk(client,entry["sdk"],sdkArgs(entry["sdk"],input));
  }
  if(spec["transport"] == "rest"){
    let request = requestValues(spec,input);
    return await client.request(request["path"],Object.assign(
      {},
      options || {},
      {"method":spec["method"],"body":request["body"]}
    ));
  }
  return await client.call(entry["operation"],input);
}

export async function runModel(client,key,name,inputs,payload = null){
  let model = resolveModel(key,name,inputs,payload);
  let entry = definition(key)["models"][name];
  if(entry["sdk"]){
    return await invokeSdk(client,entry["sdk"],sdkArgs(entry["sdk"],model["values"]));
  }
  if(model["spec"]["auth"] && (model["spec"]["transport"] == "rest")){
    return await client.request(model["values"]["path"],{
      "method":model["spec"]["method"],
      "body":model["values"]["body"]
    });
  }
  return await client.call(model["name"],model["values"]);
}

export function conditionsMet(conditions,context){
  return (conditions || []).every(function (path){
    let value = context;
    path.forEach(function (key){
      value = ((value == null) ? null : value[key]);
    });
    return !!value;
  });
}

export function selectOutput(selector,value){
  if(selector == "eligible-pages"){
    return value["listings"].filter(function (page){
      return (page["status"] == "published") && page["owner_id"];
    });
  }
  return value;
}

export function assertPageActor(client,tracked,actor){
  if(tracked && (actor != (client["user"] && client["user"]["uid"]))){
    throw new Error("Account changed. Sign in again.");
  }
}

export async function runPage(client,key,inputs,services = null){
  let page = definition(key);
  let tracked = Object.prototype.hasOwnProperty.call(client,"user");
  let actor = client["user"] && client["user"]["uid"];
  let read = async function (name,values){
    assertPageActor(client,tracked,actor);
    let model = resolveModel(key,name,inputs,values);
    let selected = (services && !model["spec"]["auth"]) ? services["publicClient"] : client;
    let result = await runModel(selected,key,name,inputs,values);
    assertPageActor(client,tracked,actor);
    return result;
  };
  let sdk = async function (name,args){
    assertPageActor(client,tracked,actor);
    let result = await runSdkAction(client,key,name,args);
    assertPageActor(client,tracked,actor);
    return result;
  };
  if(page["loader"]){
    if((page["loader"] == "messaging-settings") && ((typeof client["request"]) != "function")){
      return {"forbidden":true};
    }
    let loaders = {
      "messaging-settings":account.loadMessaging,
      "post-manager":account.loadPostManager,
      "site-notes":atlas.loadSiteNotes,
      "people":community.loadPeople,
      "profile":community.loadProfile,
      "logbook":logbook.loadLogbook,
      "profile-editor":community.loadEditor,
      "logbook-extras":function (read,inputs,actor,sdk){
            return logbook.loadExtras(read,sdk,inputs,actor);
          },
      "place-trips":atlas.loadTrips,
      "place-media":function (read,inputs,actor,sdk){
            return atlas.loadMedia(read,sdk,inputs,actor);
          },
      "instagram-discovery":account.loadDiscovery,
      "site-review":account.loadSiteReview,
      "place-feed":atlas.loadFeed
    };
    let loader = loaders[page["loader"]];
    if(!loader){
      throw new Error("Unknown page loader.");
    }
    let result = await loader(read,inputs,actor,sdk);
    assertPageActor(client,tracked,actor);
    return result;
  }
  let output = {};
  let context = {"inputs":inputs,"models":output};
  for(let name of page["order"] || Object.keys(page["models"])){
    let entry = page["models"][name];
    assertPageActor(client,tracked,actor);
    if(!conditionsMet(entry["require"],context)){
      throw new Error(entry["denied"] || "Page access denied.");
    }
    if(conditionsMet(entry["when"],context)){
      output[name] = selectOutput(entry["select"],await read(name,{}));
    }
    else{
      output[name] = null;
    }
    assertPageActor(client,tracked,actor);
  };
  return output;
}

export async function runAuthAction(client,key,name,args){
  let entry = definition(key)["auth-actions"][name];
  if(!entry){
    throw new Error("Undeclared authentication action: " + name);
  }
  let path = entry["method"];
  let owner = client;
  path.slice(0,-1).forEach(function (part){
    owner = owner[part];
  });
  let method = owner[path[path["length"] - 1]];
  let result = await method.apply(owner,args || []);
  if(entry["check-error"] && result && result["error"]){
    throw new Error(result["error"]["message"]);
  }
  return result;
}

export function assertClientOperation(key,name,write){
  let page = definition(key);
  let entries = write ? Object.assign({},page["models"],page["actions"]) : page["models"];
  if(!Object.values(entries).some(function (entry){
    return entry["operation"] == name;
  })){
    throw new Error("Undeclared page operation: " + name);
  }
  return true;
}

export function bindPageClient(key,client){
  definition(key);
  return {
    "call":function (name,values,options){
        assertClientOperation(key,name,true);
        return client.call(name,values,options);
      },
    "read":function (name,values){
        assertClientOperation(key,name,false);
        return client["read"] ? client.read(name,values) : undefined;
      },
    "subscribe":function (name,values,callback){
        assertClientOperation(key,name,false);
        return client.subscribe(name,values,callback);
      }
  };
}

export function createPageAdapter(key,owner){
  let spec = definition(key)["adapter"];
  if(!spec){
    throw new Error("No page adapter: " + key);
  }
  Object.values(spec).forEach(function (method){
    if((typeof owner[method]) != "function"){
      throw new Error("Missing adapter method: " + method);
    }
  });
  let closed = false;
  return {
    "owner":owner,
    "snapshot":function (){
        return owner[spec["snapshot"]].call(owner);
      },
    "subscribe":function (callback){
        return owner[spec["subscribe"]].call(owner,callback);
      },
    "attach":function (host){
        closed = false;
        return owner[spec["attach"]].call(owner,host);
      },
    "destroy":function (){
        if(!closed){
          closed = true;
          return owner[spec["destroy"]].call(owner);
        }
      }
  };
}

export function runLocalEffect(key,name,effect){
  if(!(definition(key)["effects"] || []).includes(name)){
    throw new Error("Undeclared page effect: " + name);
  }
  return effect();
}

export async function runPageResource(key,name){
  let resource = (definition(key)["resources"] || {})[name];
  if(!resource){
    throw new Error("Undeclared page resource: " + name);
  }
  let response = await fetch(resource["path"],{"cache":"no-store"});
  return response["ok"] ? await response.json() : null;
}

export function runCompatibility(key,name,handler,args){
  if(!(definition(key)["adapters"] || []).includes(name)){
    throw new Error("Undeclared compatibility adapter: " + name);
  }
  return handler.apply(null,args);
}