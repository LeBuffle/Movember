/**
 * The two keys Web Push runs on.
 *
 * **The public one identifies us to the push service; the private one signs.**
 * Confusing them is the classic Web Push mistake, and it produces no visible
 * error — the browser subscribes happily and every send is then rejected.
 * Hence one file, and a name for each that says which side it belongs on.
 *
 * The public key is a `NEXT_PUBLIC_` variable on purpose: the browser needs
 * it to subscribe at all. The private key is read only by the sending code
 * (story 6.3) and never appears in this module, so nothing importable from a
 * client component can reach it.
 *
 * Generated once, with `npx web-push generate-vapid-keys`, and then never
 * changed: rotating them invalidates every existing subscription silently.
 */

/** Whether the browser can be asked to subscribe at all. */
export function pushConfigured(): boolean {
  return vapidPublicKey() !== null;
}

export function vapidPublicKey(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();

  return key && key.length > 0 ? key : null;
}

/**
 * The key as the browser wants it.
 *
 * `pushManager.subscribe` takes raw bytes, and the key is published in
 * base64url. The conversion is four lines and it is the kind of thing that is
 * copied wrongly once and then debugged for an hour, so it lives here with a
 * test rather than inline in a component.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");

  const raw = atob(normalised);

  /* Built over an explicit `ArrayBuffer` rather than from a length. Same
     bytes, but the type then says "not shared memory", which is what
     `pushManager.subscribe` asks for. */
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));

  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }

  return bytes;
}
