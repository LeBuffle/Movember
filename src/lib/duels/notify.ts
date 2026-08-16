import "server-only";

import { expiryMessage } from "@/lib/duels/messages";
import { notify } from "@/lib/notifications/dispatch";
import { buildPayload } from "@/lib/notifications/payload";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The four moments of a duel (story 12.7).
 *
 * All four go through `notify`, like everything else: the preference of story
 * 6.7 is honoured in one place, and there is no route that can forget it.
 * They carry the category `defi_joueur`, which exists precisely so somebody
 * who wants their daily reminder but not the duels can say so — without that,
 * the only way out would be switching off `resultat`, and with it every
 * validation message in the game.
 *
 * **A send that fails never undoes what it announces.** The duel is the fact,
 * the notification is its consequence. Each function runs after the write,
 * logs its own failure, and returns nothing anybody has to act on.
 *
 * **Nothing personal travels in a payload**, the rule of story 6.2: the
 * pseudonym of the other participant is already on the screen the
 * notification opens, so it may travel; nothing else does.
 */

const BOARD = "/jeu/defis-joueurs";

type DuelRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  free: boolean;
  expires_at: string;
  expiry_message_key: string | null;
  duel_types: { name: string } | null;
};

const SELECTION =
  "id, sender_id, receiver_id, free, expires_at, expiry_message_key, duel_types (name)";

async function readDuel(duelId: string): Promise<DuelRow | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("duels")
    .select(SELECTION)
    .eq("id", duelId)
    .maybeSingle();

  if (error || !data) {
    console.error("[défis-joueurs] défi illisible pour la notification", {
      duel: duelId,
      code: error?.code,
    });
    return null;
  }

  return data as unknown as DuelRow;
}

/** The pseudonym of one participant, from the public view. Never the e-mail. */
async function nameOf(profileId: string): Promise<string> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("public_profiles")
    .select("display_name")
    .eq("id", profileId)
    .maybeSingle();

  return data?.display_name ?? "Un participant";
}

/**
 * Somebody has been challenged (AC 1).
 *
 * The most useful of the four: the 24 hours are running, and they run whether
 * or not the person knows.
 */
export async function notifyDuelReceived(duelId: string): Promise<void> {
  const duel = await readDuel(duelId);
  if (!duel) return;

  const sender = await nameOf(duel.sender_id);
  const what = duel.duel_types?.name ?? "un défi";

  await notify({
    profileIds: [duel.receiver_id],
    category: "defi_joueur",
    payload: buildPayload({
      title: duel.free ? `${sender} riposte !` : `${sender} vous défie`,
      body: `${what} — vous avez 24 heures.`,
      url: BOARD,
      tag: `defi-joueur-${duel.id}`,
    }),
    // The duel, not the day: two duels from the same person are two events,
    // and hearing about only one of them would be worse than hearing about
    // neither.
    dedupeKey: `defi-joueur-recu:${duel.id}`,
  });
}

/** Their duel was met (AC 2). Sent to the person who launched it. */
export async function notifyDuelMet(duelId: string): Promise<void> {
  const duel = await readDuel(duelId);
  if (!duel) return;

  const receiver = await nameOf(duel.receiver_id);

  await notify({
    profileIds: [duel.sender_id],
    category: "defi_joueur",
    payload: buildPayload({
      title: `${receiver} a relevé votre défi`,
      body: "Bien joué à lui. À vous de voir la suite.",
      url: BOARD,
      tag: `defi-joueur-${duel.id}`,
    }),
    dedupeKey: `defi-joueur-releve:${duel.id}`,
  });
}

/**
 * A duel expired (AC 3), announced to its sender with the drawn sentence.
 *
 * **The receiver gets nothing at all**, and that is a decision rather than an
 * omission (story 12.6 AC 7). They did nothing wrong: they did not ask for
 * this duel. Telling them "vous avez échoué" would punish them for having
 * been chosen.
 */
export async function notifyDuelExpired(duelId: string): Promise<void> {
  const duel = await readDuel(duelId);
  if (!duel) return;

  await notify({
    profileIds: [duel.sender_id],
    category: "defi_joueur",
    payload: buildPayload({
      title: "Défi non relevé",
      body: expiryMessage(duel.expiry_message_key),
      url: BOARD,
      tag: `defi-joueur-${duel.id}`,
    }),
    dedupeKey: `defi-joueur-expire:${duel.id}`,
  });
}

/**
 * The reminder before the deadline (AC 4).
 *
 * **The most useful of the four, and the easiest to make hateful.** Once, and
 * only during the day — the task that calls this runs between eight in the
 * morning and ten at night, exactly like the other reminders. The dedupe key
 * is the duel, so a task relaunched twice in an hour sends nothing more.
 */
export async function notifyDuelEndingSoon(duelId: string): Promise<void> {
  const duel = await readDuel(duelId);
  if (!duel) return;

  const sender = await nameOf(duel.sender_id);
  const what = duel.duel_types?.name ?? "un défi";

  await notify({
    profileIds: [duel.receiver_id],
    category: "defi_joueur",
    payload: buildPayload({
      title: "Il vous reste peu de temps",
      body: `${what}, lancé par ${sender}. C’est maintenant ou jamais.`,
      url: BOARD,
      tag: `defi-joueur-${duel.id}`,
    }),
    dedupeKey: `defi-joueur-rappel:${duel.id}`,
  });
}
