import { supabase } from "./supabaseClient.js";

const VAPID_PUBLIC_KEY = "BGsQiMiAboAB92_7Daaqox6xtZuqpgwEOcGX0PbH-stjljv16sg11w9pDNTJhBOpTi6ngKsXgL6bOHKT-IzEQvQ";

// Vérifie si les notifications push sont supportées
export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window;
}

// Vérifie si l'utilisateur est déjà abonné
export async function isSubscribed() {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

// Demande la permission et abonne l'utilisateur
export async function subscribeToPush(userId) {
  if (!isPushSupported()) return { error: "Push non supporté sur ce navigateur." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { error: "Permission refusée." };

  const reg = await navigator.serviceWorker.ready;

  // Convertir la clé VAPID en Uint8Array
  const appServerKey = urlB64ToUint8Array(VAPID_PUBLIC_KEY);

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: appServerKey,
  });

  const subJson = subscription.toJSON();

  // Sauvegarder en base
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: userId, subscription: subJson }, { onConflict: "user_id" });

  if (error) return { error: error.message };
  return { success: true };
}

// Désabonner l'utilisateur
export async function unsubscribeFromPush(userId) {
  if (!isPushSupported()) return;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();

  await supabase.from("push_subscriptions").delete().eq("user_id", userId);
}

// Envoyer une notification via l'Edge Function
export async function sendPushNotification({ userIds, title, body, url }) {
  const { data, error } = await supabase.functions.invoke("send-push", {
    body: { user_ids: userIds, title, body, url },
  });
  if (error) console.error("Push error:", error);
  return data;
}

// Envoyer à tous les admins
export async function notifyAdmins(title, body, url) {
  const { data: admins } = await supabase
    .from("users")
    .select("id")
    .eq("role", "admin")
    .eq("status", "approved");

  if (!admins?.length) return;
  return sendPushNotification({
    userIds: admins.map((a) => a.id),
    title,
    body,
    url,
  });
}

// Envoyer à tous les bénévoles approuvés
export async function notifyAll(title, body, url) {
  const { data: users } = await supabase
    .from("users")
    .select("id")
    .eq("status", "approved");

  if (!users?.length) return;
  return sendPushNotification({
    userIds: users.map((u) => u.id),
    title,
    body,
    url,
  });
}

// Helper : convertir clé VAPID base64url en Uint8Array
function urlB64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
