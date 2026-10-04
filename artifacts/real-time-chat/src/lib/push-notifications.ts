import { customFetch } from "@workspace/api-client-react";

function decodeVapidKey(encodedKey: string) {
  const padding = "=".repeat((4 - (encodedKey.length % 4)) % 4);
  const base64 = `${encodedKey}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const key = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    key[index] = raw.charCodeAt(index);
  }
  return key;
}

export async function enableMessageNotifications() {
  if (
    !window.isSecureContext ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    throw new Error("Push notifications are not supported by this browser.");
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await navigator.serviceWorker.register(
    new URL(`${import.meta.env.BASE_URL}sw.js`, window.location.origin),
    { scope: import.meta.env.BASE_URL },
  );
  const { publicKey } = await customFetch<{ publicKey: string }>(
    "/api/push/vapid-public-key",
    { cache: "no-store" },
  );
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(publicKey),
    }));

  await customFetch<void>("/api/push/subscriptions", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
}
