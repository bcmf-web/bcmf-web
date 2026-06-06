import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Web Push (VAPID) implementation pour Deno
async function buildVapidHeaders(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 12 * 3600;

  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp, sub: subject };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const signingInput = `${encode(header)}.${encode(payload)}`;

  // Import private key
  const privKeyBytes = Uint8Array.from(
    atob(privateKey.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0)
  );

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    privKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `vapid t=${signingInput}.${sigB64},k=${publicKey}`;
}

async function sendNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPublic: string,
  vapidPrivate: string,
  vapidSubject: string
) {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const authHeader = await buildVapidHeaders(
    audience, vapidSubject, vapidPublic, vapidPrivate
  );

  // Chiffrement du payload (Web Push Encryption)
  const p256dh = Uint8Array.from(
    atob(subscription.keys.p256dh.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0)
  );
  const auth = Uint8Array.from(
    atob(subscription.keys.auth.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0)
  );

  // Générer les clés éphémères
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );

  const remoteKey = await crypto.subtle.importKey(
    "raw", p256dh,
    { name: "ECDH", namedCurve: "P-256" },
    true, []
  );

  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: remoteKey },
    localKeyPair.privateKey,
    256
  );

  // HKDF pour dériver les clés de chiffrement
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const localPublicKeyRaw = await crypto.subtle.exportKey("raw", localKeyPair.publicKey);

  const prk = await crypto.subtle.importKey("raw", new Uint8Array(sharedSecret), "HKDF", false, ["deriveKey"]);

  const authInfo = new TextEncoder().encode("Content-Encoding: auth\0");
  const authSecret = await crypto.subtle.importKey("raw", auth, "HKDF", false, ["deriveBits"]);
  const ikm = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: auth, info: authInfo },
    authSecret,
    256
  );

  const ikmKey = await crypto.subtle.importKey("raw", new Uint8Array(ikm), "HKDF", false, ["deriveKey"]);

  const keyInfo = new TextEncoder().encode("Content-Encoding: aesgcm\0");
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");

  const contentKey = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: keyInfo },
    ikmKey,
    { name: "AES-GCM", length: 128 },
    false,
    ["encrypt"]
  );

  const nonceBytes = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
    ikmKey,
    96
  );
  const nonce = new Uint8Array(nonceBytes);

  // Chiffrer le payload
  const payloadBytes = new TextEncoder().encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 2);
  paddedPayload.set(payloadBytes, 2);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    contentKey,
    paddedPayload
  );

  const localPubKeyB64 = btoa(String.fromCharCode(...new Uint8Array(localPublicKeyRaw)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const saltB64 = btoa(String.fromCharCode(...salt))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const resp = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aesgcm",
      "Crypto-Key": `dh=${localPubKeyB64};${authHeader.split(",k=")[1] ? `p256ecdsa=${authHeader.split(",k=")[1]}` : ""}`,
      "Encryption": `salt=${saltB64}`,
      "TTL": "86400",
    },
    body: encrypted,
  });

  return resp.status;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    const { user_ids, title, body, url } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const vapidPublic  = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT")!;

    // Récupérer les abonnements des utilisateurs ciblés
    let query = supabase.from("push_subscriptions").select("subscription");
    if (user_ids && user_ids.length > 0) {
      query = query.in("user_id", user_ids);
    }
    const { data: subs } = await query;

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({ title, body, url: url || "/" });

    let sent = 0;
    const errors = [];

    for (const row of subs) {
      try {
        const status = await sendNotification(
          row.subscription,
          payload,
          vapidPublic,
          vapidPrivate,
          vapidSubject
        );
        if (status < 300) sent++;
        else errors.push(status);
      } catch (e) {
        errors.push(String(e));
      }
    }

    return new Response(JSON.stringify({ sent, errors }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
