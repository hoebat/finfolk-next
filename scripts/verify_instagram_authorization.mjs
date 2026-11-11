// Privileged operator recovery; credentials remain encrypted at rest and are never printed.
import { randomUUID } from "node:crypto";
import { database } from "../backend/db.mjs";
import {
  messagingConfig,
  unseal,
  oauthFlowKey,
} from "../backend/messaging-config.mjs";
import { authorizationDiagnostics } from "../backend/messaging-diagnostics.mjs";
import { completeMessagingAuthorization } from "../backend/messaging-authorization.mjs";
if (!["--inspect", "--verify"].includes(process.argv[2]))
  throw Error(
    "Use --inspect (read-only) or --verify (complete the approved connection).",
  );
const db = database(
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
);
try {
  const config = await messagingConfig(db.query, process.env, {
    credentials: true,
  });
  if (process.argv[2] === "--inspect") {
    console.log(JSON.stringify(await authorizationDiagnostics(db, process.env)));
  } else {
    if (!config.checks.pendingVerification || !config.credential_ciphertext)
      throw Error(
        "No pending approved authorization. Start authorization from FinFolk Settings.",
      );
    const payload = unseal(
      config.credential_ciphertext,
      process.env,
      config.scope,
    );
    if (payload.flowKey !== oauthFlowKey(process.env))
      throw Error(
        "Authorization configuration changed. Reconnect from Settings.",
      );
    const actor = payload.authorizedBy;
    const active = (
      await db.query(
        'SELECT 1 FROM neon_auth."user" u JOIN finfolk.members m ON m.user_id=u.id::text WHERE m.user_id=$1 AND u."emailVerified" AND NOT coalesce(u.banned,false) AND NOT m.deleted',
        [actor],
      )
    ).length;
    if (!active)
      throw Error(
        "The administrator who approved this grant is no longer active and verified.",
      );
    console.log(
      JSON.stringify(
        await completeMessagingAuthorization(
          db,
          process.env,
          {
            token: payload.accessToken,
            expiresAt: payload.expiresAt,
            tokenKind: payload.tokenKind,
          },
          actor,
          randomUUID(),
          { expectedCredential: config.credential_ciphertext },
        ),
      ),
    );
  }
} catch (error) {
  console.error(
    JSON.stringify({
      errorCode: error.code || "verification_failed",
      message: error.status ? error.message : "Verification could not finish.",
    }),
  );
  process.exitCode = 1;
} finally {
  await db.pool.end();
}
