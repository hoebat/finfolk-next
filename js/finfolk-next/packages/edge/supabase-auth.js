// Generated from finfolk-web.lib.supabase-auth; do not edit.
export async function verifiedIdentity(config,authorization){
  if(((typeof authorization) != "string") || !authorization.startsWith("Bearer ")){
    throw Object.assign(new Error("Sign in first."),{"status":401});
  }
  let base = new URL(config.supabaseUrl);
  if(!((base.protocol == "https:") || ((base.protocol == "http:") && ["127.0.0.1","localhost"].includes(base.hostname)))){
    throw new Error("Invalid Supabase Auth origin");
  }
  let response = await fetch(new URL("/auth/v1/user",base),{
    "headers":{"apikey":config.publishableKey,"Authorization":authorization},
    "redirect":"manual",
    "signal":AbortSignal.timeout(10000)
  });
  if(!response.ok){
    throw Object.assign(
      new Error("Your sign-in expired. Please sign in again."),
      {"status":[401,403].includes(response.status) ? 401 : 503}
    );
  }
  let user = await response.json();
  if(!user.id || !new RegExp(
    "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
  ).test(user.id)){
    throw Object.assign(new Error("Account unavailable."),{"status":401});
  }
  return {
    "id":user.id,
    "email":user.email,
    "verified":!!user.email_confirmed_at
  };
}