import {instagramAccountURL,instagramLinks} from './instagram-urls.mjs';
import { issueConnectCode } from './instagram-connect.mjs';
import { commands } from "./messaging-config.mjs";
import { windowFor } from "./community-core.mjs";
const accountURL = "https://finfolk.com.au/?view=account&tab=instagram";
export const followRequiredReply =
  "Please follow @finfolk.com.au to use this feature.\nhttps://www.instagram.com/finfolk.com.au/\n\nOnce you’re following, send the same command again. You can use /help without following or connecting an account.";
export const helpText = (enabled = Object.keys(commands)) =>
  "Hey! Welcome to FinFolk 🌊\nYour coastal companion for finding beaches, exploring depths and keeping your dive memories together.\n\nAvailable here:\n" +
  Object.entries(commands)
    .filter(([name]) => enabled.includes(name))
    .map(([, c]) => c.syntax + " — " + c.description)
    .join("\n") +
  "\n\nGet started: https://finfolk.com.au\nExplore the map or sign in to start your logbook.\n\nYou don’t need to follow or connect your account to ask for help. Please follow @finfolk.com.au to connect your account and use member features, comments and posts.";
export const commandHelp = helpText();
export function parseInstagramCommand(text = "") {
  const match = String(text)
    .trim()
    .match(/^\/([a-z]+)(?:\s+([^\r\n]*))?$/i);
  if (!match)
    return {
      command: String(text).trim().startsWith("/") ? "unknown" : "prompt",
      args: "",
    };
  const command = match[1].toLowerCase()==="checkin"?"in":match[1].toLowerCase(),
    args = (match[2] || "").trim();
  if (command === "claim") return { command: "claim_retired", args: "" };
  if (!Object.keys(commands).includes(command))
    return { command: "unknown", args: "" };
  if (command !== "in" && args) return { command: "unknown", args: "" };
  return { command, args: args.slice(0, 200) };
}
const beachLabel = (b) =>
  [b.name, b.area_name, b.state].filter(Boolean).join(", ");
async function claimedMember(q, sender, scope) {
  return (
    await q(
      `SELECT c.user_id,c.handle,m.profile FROM finfolk.instagram_connections c JOIN finfolk.members m ON m.user_id=c.user_id JOIN LATERAL (SELECT (finfolk_rpc.auth_identity(m.user_id)->>'verified')::boolean AS "emailVerified",false AS banned) u ON true
    WHERE c.sender_id=$1 AND c.provider_scope=$2 AND c.status='connected' AND NOT m.deleted AND u."emailVerified" AND coalesce(u.banned,false)=false FOR UPDATE OF m`,
      [sender, scope],
    )
  )[0];
}
export async function commandResult(q, event, env, identity, identityError) {
  const accountURL=instagramAccountURL(env);
  if (event.command === "ping")
    return "Pong. Reference: " + event.correlation_id;
  if (event.command === "prompt") {
    const sent = await q(
      "UPDATE finfolk.instagram_dm_limits SET prompted_at=now() WHERE sender_id=$1 AND (prompted_at IS NULL OR prompted_at<now()-interval '24 hours') RETURNING sender_id",
      [event.rate_limit_key],
    );
    return sent.length
      ? "Hi! Send /help to see FinFolk commands. Everyone can message us. Please follow @finfolk.com.au to connect your account and use member features."
      : null;
  }
  if (["help", "unknown"].includes(event.command))
    return event.command === "help"
      ? instagramLinks(helpText(env.MESSAGING_ENABLED_COMMANDS),env)
      : "I don’t recognise that command.\n\n" +
          instagramLinks(helpText(env.MESSAGING_ENABLED_COMMANDS),env);
  if (event.command === "claim_retired") return "/claim has been retired. Follow @finfolk.com.au and send /connect to receive a code, then enter it on FinFolk: " + accountURL;
  if (event.command === "connect") return issueConnectCode(q, event, env, identity);
  const owner = await claimedMember(
    q,
    event.sender_id,
    env.MESSAGING_PROVIDER_SCOPE,
  );
  if (!owner)
    return (
      "This Instagram account is not connected yet. Follow @finfolk.com.au, send /connect, then enter the code at " +
      accountURL
    );
  if (event.command === "status")
    return `@${owner.handle} is connected to FinFolk. Your connection is active. Send /help for commands.`;
  if (event.command === "points") {
    const row = (
      await q(
        `SELECT (SELECT coalesce(sum(points),0) FROM finfolk.points_ledger WHERE user_id=$1 AND NOT reversed)::int AS participation,
      (SELECT count(*) FROM finfolk.invitation_joins WHERE inviter_id=$1 AND rewarded_at IS NOT NULL)::int AS referrals`,
        [owner.user_id],
      )
    )[0];
    return `Your FinFolk points: ${row.participation} participation + ${row.referrals} referral = ${Number(row.participation) + Number(row.referrals)} total. No points reward depth or breath-hold performance.`;
  }
  if (["in","out","checkin"].includes(event.command)) {
    return visitCommand(q,event,env,owner);
  }
  return commandHelp;
}

async function visitCommand(q,event,env,owner){
    const arrival=event.command!=="out",when=new Date(event.message_at);
    const latest=(await q("SELECT id,message_at FROM finfolk.instagram_dm_events WHERE owner_id=$1 AND sender_id=$2 AND provider_scope=$3 AND command IN ('in','out','checkin') AND processing_state='completed' AND reply IS NOT NULL ORDER BY message_at DESC,id DESC LIMIT 1",[owner.user_id,event.sender_id,env.MESSAGING_PROVIDER_SCOPE]))[0];
    const visits=await q("SELECT c.*,b.name,b.area_name,b.state FROM finfolk.checkins c JOIN finfolk.beaches b ON b.id=c.beach_id WHERE c.user_id=$1 AND c.checked_in_at IS NOT NULL ORDER BY greatest(c.checked_in_at,c.checked_out_at) DESC LIMIT 1",[owner.user_id]);
    const last=visits[0],previous=Math.max(...[latest?.message_at,last?.checked_in_at,last?.checked_out_at].map(value=>value?new Date(value).getTime():0));
    if(!Number.isFinite(when.getTime())||when.getTime()<=previous)return "That message is older than your latest visit update. Please send /in followed by a location, or /out, again.";
    const remember=async reply=>{await q("UPDATE finfolk.instagram_dm_events SET owner_id=$2,reply=$3 WHERE id=$1",[event.id,owner.user_id,reply]);return reply;};
    const active=last&&!last.checked_out_at?last:null;
    if(!arrival){
      if(!active)return remember("You’re not checked in anywhere. Send /in followed by a location when you arrive.");
      await q("UPDATE finfolk.checkins SET checked_out_at=$3 WHERE user_id=$1 AND beach_id=$2 AND checked_in_at IS NOT NULL AND checked_out_at IS NULL",[owner.user_id,active.beach_id,when]);
      return remember(`Checked out of ${beachLabel(active)}. Your visit is recorded.`);
    }
    if (!event.args) {
      const beaches = await q(
        "SELECT name,area_name,state FROM finfolk.beaches WHERE id IN (SELECT jsonb_array_elements_text(profile->'beaches') FROM finfolk.members WHERE user_id=$1) ORDER BY name LIMIT 5",
        [owner.user_id],
      );
      return (
        "Use /in followed by the beach name." +
        (beaches.length
          ? "\nYour followed beaches:\n" +
            beaches.map((b) => "/in " + beachLabel(b)).join("\n")
          : "\nExample: /in Bondi Beach")
      );
    }
    const name = event.args.toLowerCase().replace(/\s+/g, " ");
    const beaches = await q(
      `SELECT id,name,timezone,area_name,state FROM finfolk.beaches WHERE lower(name)=$1 OR lower(id)=$1
      OR lower(regexp_replace(name,' Beach$','','i'))=$1 OR lower(concat_ws(', ',name,nullif(area_name,''),nullif(state,'')))=$1
      OR lower(concat_ws(', ',name,nullif(area_name,'')))=$1 OR lower(concat_ws(', ',name,nullif(state,'')))=$1 ORDER BY (lower(id)=$1) DESC,name,id LIMIT 6`,
      [name],
    );
    if(beaches[0]?.id.toLowerCase()===name)beaches.splice(1);
    if (!beaches.length)
      return "I couldn’t find that beach. Use its full name, or send /in to see your followed beaches.";
    if (beaches.length > 1)
      return (
        "Which beach did you visit? Send one of these commands:\n" +
        beaches
          .slice(0, 5)
          .map(
            (b) =>
              "/in " +
              (beaches.filter((other) => beachLabel(other) === beachLabel(b))
                .length > 1
                ? b.id
                : beachLabel(b)),
          )
          .join("\n")
      );
    const beach = beaches[0],
      { today } = windowFor(when, beach.timezone);
    if(active){
      return active.beach_id===beach.id
        ? `You’re already checked in at ${beachLabel(active)}. Send /out when you leave.`
        : `You’re checked in at ${beachLabel(active)}. Send /out before checking in somewhere else.`;
    }
    await q(
      "INSERT INTO finfolk.checkins(user_id,beach_id,visit_day,checked_in_at) VALUES($1,$2,$3::date,$4) ON CONFLICT(user_id,beach_id,visit_day) DO UPDATE SET checked_in_at=excluded.checked_in_at,checked_out_at=NULL",
      [owner.user_id, beach.id, today,when],
    );
    return remember(`Checked in at ${beachLabel(beach)} for ${today}. Send /out when you leave. Your profile and sharing preferences still apply.`);

}
