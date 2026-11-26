// Generated from finfolk-web.lib.supabase-client; do not edit.
import * as contracts from '@finfolk/edge/native-account-contracts.js'

export function checked(response){
  if(response.error){
    throw response.error;
  }
  return response.data;
}

export async function requestAccount(config,operation,values,session,check){
  values = contracts.compactRequest(values);
  let spec = contracts.operations[operation];
  if(!spec){
    throw Object.assign(
      new Error("This feature is not available in this build."),
      {"status":501,"code":"native_operation_unavailable"}
    );
  }
  try{
    contracts.validate(spec.request,values);
  }
  catch(error){
    throw Object.assign(error,{"status":400,"code":"invalid_account_input"});
  }
  if(!session && !spec.public){
    throw Object.assign(new Error("Sign in first."),{"status":401});
  }
  check();
  let headers = {"Content-Type":"application/json"};
  if(session){
    headers.Authorization = ("Bearer " + session.access_token);
  }
  let response = await fetch(new URL("/v1/native/account",config.apiUrl),{
    "method":"POST",
    "headers":headers,
    "body":JSON.stringify({"operation":operation,"values":values}),
    "cache":"no-store"
  });
  let body = await response.json();
  check();
  if(!response.ok){
    throw Object.assign(new Error(body.error),{
      "status":response.status,
      "dataDeleted":body.dataDeleted,
      "code":body.code,
      "mutationOutcomeUnknown":spec.write && (response.status >= 500) && !body.dataDeleted
    });
  }
  contracts.validate(spec.result,body,"result");
  return body;
}

export function createAccountClient(auth,config,app){
  if(!app){
    throw new Error("An application backbone is required");
  }
  app.authProvider = "supabase";
  app.configuration = config;
  let ctx = {
    "revision":0,
    "user":null,
    "session":null,
    "model":null,
    "listeners":new Set(),
    "closed":false,
    "recovery":config.passwordRecovery == true,
    "notice":""
  };
  let transition = function (session,event = null){
    if(ctx.closed){
      return null;
    }
    let sameActor = session && ctx.user && (session.user.id == ctx.user.uid);
    if(!sameActor){
      ctx.revision = (ctx.revision + 1);
    }
    if(event == "SIGNED_IN"){
      ctx.notice = "";
    }
    if(event == "PASSWORD_RECOVERY"){
      ctx.recovery = true;
    }
    if(!session){
      ctx.recovery = false;
    }
    if(ctx.model && !sameActor){
      app.clearMember();
      ctx.model = null;
    }
    ctx.session = session;
    ctx.user = (session ? {
      "uid":session.user.id,
      "email":session.user.email,
      "emailVerified":!!session.user.email_confirmed_at,
      "recovery":ctx.recovery
    } : null);
    if(session && !ctx.model){
      let revision = ctx.revision;
      let check = function (){
        if((revision != ctx.revision) || ctx.closed){
          throw new Error("Account changed. Sign in again.");
        }
      };
      ctx.model = app.member(session.user.id,function (operation,values){
        return requestAccount(config,operation,values,ctx.session,check);
      });
    }
    ctx.listeners.forEach(function (listener){
      listener(ctx.user);
    });
  };
  let registration = auth.onAuthStateChange(function (event,session){
    transition(session,event);
  });
  let ready = auth.getSession().then(function (response){
    let data = checked(response);
    if(ctx.revision == 0){
      transition(data.session);
    }
  });
  let client = {
    "ready":ready,
    "save":async function (id,values){
        let input = {"values":values};
        if(id){
          input.id = id;
        }
        let result = await client.call("saveSession",input);
        return result.id;
      },
    "resetPassword":async function (_token,password){
        if(!ctx.user || !ctx.recovery){
          throw new Error("Open a valid password recovery link first.");
        }
        let data = checked(await auth.updateUser({"password":password}));
        ctx.recovery = false;
        transition(ctx.session);
        return data;
      },
    "list":function (values){
        let input = Object.assign({},values || {});
        Object.keys(input).forEach(function (key){
          if(input[key] == null){
            delete(input[key]);
          }
        });
        return client.call(ctx.model ? "sessions" : "publicSessions",input);
      },
    "observe":function (listener){
        ctx.listeners.add(listener);
        ready.then(function (){
          if(ctx.listeners.has(listener)){
            listener(ctx.user);
          }
        });
        return function (){
          ctx.listeners.delete(listener);
        };
      },
    "google":async function (){
        return checked(await auth.signInWithOAuth({
          "provider":"google",
          "options":{"redirectTo":config.authRedirectTo}
        }));
      },
    "call":function (operation,values){
        if(ctx.model){
          return ctx.model.call(operation,values || {});
        }
        let spec = contracts.operations[operation];
        if(!spec){
          throw Object.assign(
            new Error("This feature is not available in this build."),
            {"status":501,"code":"native_operation_unavailable"}
          );
        }
        if(!spec.public){
          throw new Error("Sign in first.");
        }
        return app.public.call(operation,values || {});
      },
    "github":async function (){
        return checked(await auth.signInWithOAuth({
          "provider":"github",
          "options":{"redirectTo":config.authRedirectTo}
        }));
      },
    "deleteSession":function (id){
        return client.call("deleteSession",{"id":id});
      },
    "ensureProfile":async function (){
        let me = await client.call("me",{});
        return Object.assign({},me.profile,{"id":me.id,"uid":me.id});
      },
    "featureHeaders":async function (){
        let session = checked(await auth.getSession()).session;
        return session ? {"Authorization":"Bearer " + session.access_token} : {};
      },
    "verifyCode":async function (code){
        if(!ctx.user){
          throw new Error("Sign in first.");
        }
        return checked(
          await auth.verifyOtp({"type":"signup","email":ctx.user.email,"token":code})
        );
      },
    "auth":{
        "signUp":{
            "email":async function (input){
                let response = await auth.signUp({
                  "email":input.email,
                  "password":input.password,
                  "options":{
                        "data":{"displayName":input.name},
                        "emailRedirectTo":config.authRedirectTo
                      }
                });
                return Object.assign({},response,{
                  "confirmationRequired":!response.error && !response.data.session
                });
              }
          }
      },
    "profile":async function (target){
        return await client.call(
          ctx.model ? "profile" : "publicProfile",
          target ? {"target":target} : {}
        );
      },
    "configuration":config,
    "email":async function (email,password){
        return checked(
          await auth.signInWithPassword({"email":email,"password":password})
        );
      },
    "reset":async function (email){
        return checked(
          await auth.resetPasswordForEmail(email,{"redirectTo":config.authRedirectTo})
        );
      },
    "refresh":async function (){
        let data = checked(await auth.getSession());
        if(!data.session){
          return null;
        }
        return checked(await auth.refreshSession());
      },
    "visibility":function (id,visibility){
        return client.call("visibility",{"id":id,"visibility":visibility});
      },
    "authProvider":"supabase",
    "verify":async function (){
        if(!ctx.user){
          throw new Error("Sign in first.");
        }
        return checked(await auth.resend({"type":"signup","email":ctx.user.email}));
      },
    "application":app,
    "request":async function (_path,_options){
        throw Object.assign(
          new Error("This feature is not available in this build."),
          {"status":501,"code":"native_operation_unavailable"}
        );
      },
    "deleteAccount":async function (password){
        let result = null;
        try{
          result = await client.call("deleteAccount",{"password":password});
          ctx.notice = "Your account has been deleted.";
        }
        catch(error){
          if(!error.dataDeleted){
            throw error;
          }
          ctx.notice = error.message;
          result = {"ok":false,"pending":true};
        }
        try{
          await auth.signOut({"scope":"local"});
        }
        catch(error){
          ctx.session = null;
        }
        finally{
          transition(null);
        }
        return result;
      },
    "close":function (){
        transition(null);
        ctx.closed = true;
        ctx.listeners.clear();
        registration.data.subscription.unsubscribe();
      },
    "supports":function (operation){
        return !!contracts.operations[operation];
      },
    "featureFlags":async function (){
        let response = await auth.getSession();
        let session = checked(response).session;
        let headers = {};
        if(session){
          headers.Authorization = ("Bearer " + session.access_token);
        }
        let result = await fetch(new URL("/v1/features",config.apiUrl),{
          "headers":headers,
          "cache":"no-store",
          "signal":AbortSignal.timeout(10000)
        });
        if(!result.ok){
          throw new Error("Feature settings unavailable");
        }
        return await result.json();
      },
    "signOut":async function (){
        let result = checked(await auth.signOut());
        transition(null);
        return result;
      },
    "subscribe":function (operation,values,listener){
        if(ctx.model){
          return ctx.model.subscribe(operation,values,listener);
        }
        let spec = contracts.operations[operation];
        if(!spec){
          throw Object.assign(
            new Error("This feature is not available in this build."),
            {"status":501,"code":"native_operation_unavailable"}
          );
        }
        if(!spec.public){
          throw new Error("Sign in first.");
        }
        return app.public.subscribe(operation,values,listener);
      },
    "get":function (id){
        return client.call(ctx.model ? "session" : "publicSession",{"id":id});
      },
    "reauthenticate":async function (password){
        if(!ctx.user){
          throw new Error("Sign in first.");
        }
        return checked(
          await auth.signInWithPassword({"email":ctx.user.email,"password":password})
        );
      }
  };
  app.setPublicTransport(function (operation,values){
    return requestAccount(config,operation,values,ctx.session,function (){
      if(ctx.closed){
        throw new Error("Client closed.");
      }
    });
  });
  Object.defineProperty(client,"notice",{
    "get":function (){
        return ctx.notice;
      }
  });
  Object.defineProperty(client,"user",{
    "get":function (){
        return ctx.user;
      }
  });
  return client;
}