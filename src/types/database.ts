/**
 * Database types.
 *
 * Hand-written for now, mirroring `supabase/migrations/`. They are meant to
 * be replaced by generated ones once the CLI is linked to the project:
 *
 *   npx supabase gen types typescript --linked > src/types/database.ts
 *
 * Until then, this file and the migrations must be kept in step by hand —
 * the compiler cannot catch a drift between them.
 */

export type EditionStatus = "draft" | "open" | "running" | "closed";
export type ProfileRole = "participant" | "admin";
export type RegistrationStatus =
  "pending" | "active" | "refunded" | "cancelled";
export type PaymentKind = "registration" | "pack" | "refund";
export type AssignmentSource =
  | "draw"
  /** A repeat, handed out because the catalogue ran out (story 4.4). */
  | "catchup"
  | "common"
  | "manual";
export type AssignmentStatus = "open" | "completed" | "missed";
/** Where an activity came from (architecture D3). Garmin joins this list. */
export type ActivityProviderKey = "strava" | "manual" | "simulated";
export type CardRarity = "commune" | "rare" | "epique" | "legendaire";
/** Only `challenge` and `daily_draw` count towards the ranking (D8). */
export type CardGrantSource =
  "challenge" | "daily_draw" | "pack" | "purchase" | "manual";
/** A pack bought in the shop, before and after the webhook (story 10.3). */
export type PackPurchaseStatus = "pending" | "paid" | "abandoned";

import type { EvaluatorKey } from "@/lib/challenges/evaluators/registry";
import type { Difficulty, SportFamily } from "@/lib/challenges/sports";

/** Collective targets shown on the public page. */
export type CollectiveGoals = {
  kilometres?: number;
  hours?: number;
  amount_cents?: number;
};

export type Database = {
  public: {
    Tables: {
      editions: {
        Row: {
          id: string;
          year: number;
          name: string;
          starts_on: string;
          ends_on: string;
          registration_opens_on: string;
          status: EditionStatus;
          collective_goals: CollectiveGoals;
          created_at: string;
        };
        Insert: {
          id?: string;
          year: number;
          name: string;
          starts_on: string;
          ends_on: string;
          registration_opens_on: string;
          status?: EditionStatus;
          collective_goals?: CollectiveGoals;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["editions"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          email: string | null;
          avatar_url: string | null;
          role: ProfileRole;
          created_at: string;
          deleted_at: string | null;
          /** Set aside by the organisation (story 8.7). */
          suspended_at: string | null;
          /** Required whenever `suspended_at` is set — a constraint enforces it. */
          suspension_reason: string | null;
          suspended_by: string | null;
        };
        Insert: {
          id: string;
          display_name: string;
          email?: string | null;
          avatar_url?: string | null;
          role?: ProfileRole;
          created_at?: string;
          deleted_at?: string | null;
          suspended_at?: string | null;
          suspension_reason?: string | null;
          suspended_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      registration_tiers: {
        Row: {
          id: string;
          edition_id: string;
          slug: string;
          name: string;
          tagline: string;
          price_cents: number;
          donated_cents: number;
          perks: string[];
          position: number;
          available: boolean;
          /** Whether this tier has something physical to post (story 2.7). */
          requires_shipping: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          edition_id: string;
          slug: string;
          name: string;
          tagline?: string;
          price_cents: number;
          donated_cents: number;
          perks?: string[];
          position?: number;
          available?: boolean;
          requires_shipping?: boolean;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["registration_tiers"]["Insert"]
        >;
        Relationships: [];
      };
      registrations: {
        Row: {
          id: string;
          profile_id: string;
          edition_id: string;
          tier_id: string;
          status: RegistrationStatus;
          created_at: string;
          activated_at: string | null;
          welcome_email_sent_at: string | null;
          /* Both set together or neither — enforced by a check constraint.
             The date alone proves nothing: the terms change. */
          terms_accepted_at: string | null;
          terms_version: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          edition_id: string;
          tier_id: string;
          status?: RegistrationStatus;
          created_at?: string;
          activated_at?: string | null;
          welcome_email_sent_at?: string | null;
          terms_accepted_at?: string | null;
          terms_version?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["registrations"]["Insert"]
        >;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          registration_id: string | null;
          profile_id: string | null;
          edition_id: string;
          kind: PaymentKind;
          stripe_session_id: string | null;
          stripe_payment_intent_id: string | null;
          stripe_charge_id: string | null;
          /** Set on rows of kind `refund` only, and unique (story 2.8). */
          stripe_refund_id: string | null;
          gross_cents: number;
          /** Null means "not known yet" — never zero. See story 2.6. */
          fee_cents: number | null;
          net_cents: number | null;
          donation_cents: number;
          counterpart_cents: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          registration_id?: string | null;
          profile_id?: string | null;
          edition_id: string;
          kind?: PaymentKind;
          stripe_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_charge_id?: string | null;
          stripe_refund_id?: string | null;
          gross_cents: number;
          fee_cents?: number | null;
          net_cents?: number | null;
          donation_cents: number;
          counterpart_cents?: number;
          created_at?: string;
        };
        /* Deliberately narrow. Only what story 2.6 completes once Stripe has
           produced the balance transaction: the real fee, the net, and the
           charge identifier the statement is reconciled against. No amount
           already recorded can be rewritten through this type, and no policy
           allows anyone but the service-role client to update the table at
           all. */
        Update: {
          fee_cents?: number | null;
          net_cents?: number | null;
          stripe_charge_id?: string | null;
        };
        Relationships: [];
      };
      shipping_addresses: {
        Row: {
          id: string;
          profile_id: string;
          edition_id: string;
          recipient_name: string;
          line1: string;
          line2: string | null;
          postal_code: string;
          city: string;
          /** ISO 3166-1 alpha-2. */
          country: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          edition_id: string;
          recipient_name: string;
          line1: string;
          line2?: string | null;
          postal_code: string;
          city: string;
          country?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["shipping_addresses"]["Insert"]
        >;
        Relationships: [];
      };
      challenges: {
        Row: {
          id: string;
          edition_id: string;
          title: string;
          description: string;
          evaluator: EvaluatorKey;
          /** Never trusted as-is — see `src/lib/challenges/config.ts`. */
          config: Record<string, unknown>;
          sport_family: SportFamily;
          difficulty: Difficulty;
          points: number;
          duration_scope: "day" | "multi_day";
          duration_days: number | null;
          reward_rules: Record<string, unknown>;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          edition_id: string;
          title: string;
          description?: string;
          evaluator: EvaluatorKey;
          config?: Record<string, unknown>;
          sport_family?: SportFamily;
          difficulty?: Difficulty;
          points?: number;
          duration_scope?: "day" | "multi_day";
          duration_days?: number | null;
          reward_rules?: Record<string, unknown>;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["challenges"]["Insert"]>;
        Relationships: [];
      };
      common_challenges: {
        Row: {
          id: string;
          edition_id: string;
          challenge_id: string;
          scheduled_for: string;
          /** Explicit: replaces the day's draw, or adds to it (story 4.8). */
          mode: "replace" | "additional";
          cancelled_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          edition_id: string;
          challenge_id: string;
          scheduled_for: string;
          mode: "replace" | "additional";
          cancelled_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["common_challenges"]["Insert"]
        >;
        Relationships: [];
      };
      challenge_assignments: {
        Row: {
          id: string;
          profile_id: string;
          edition_id: string;
          challenge_id: string;
          assigned_for: string;
          source: AssignmentSource;
          status: AssignmentStatus;
          completed_at: string | null;
          /** Snapshot taken at completion — the catalogue's value can move. */
          points_awarded: number | null;
          /** What satisfied it (story 4.3). Written by the evaluation only. */
          evidence: Record<string, unknown>;
          /** Decided by hand (story 4.10). The reason is in the audit log. */
          arbitrated_at: string | null;
          arbitrated_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          edition_id: string;
          challenge_id: string;
          assigned_for: string;
          source?: AssignmentSource;
          status?: AssignmentStatus;
          completed_at?: string | null;
          points_awarded?: number | null;
          evidence?: Record<string, unknown>;
          arbitrated_at?: string | null;
          arbitrated_by?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["challenge_assignments"]["Insert"]
        >;
        Relationships: [];
      };
      /**
       * The single internal activity format (architecture D3).
       *
       * No GPS track, no heart rate, no power, no cadence — and this type is
       * one of the places that has to stay true to that (D9, story 3.4).
       */
      activities: {
        Row: {
          id: string;
          profile_id: string;
          provider: ActivityProviderKey;
          /** The identifier at the provider. Unique per provider, not globally. */
          provider_activity_id: string;
          name: string;
          sport_family: SportFamily;
          started_at: string;
          /** Calendar day in Europe/Paris, computed at the border. */
          local_date: string;
          distance_meters: number;
          duration_seconds: number;
          elevation_meters: number;
          /** Typed in by hand at the provider (story 3.4). Read by story 9.8. */
          is_manual: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          provider: ActivityProviderKey;
          provider_activity_id: string;
          name?: string;
          sport_family: SportFamily;
          started_at: string;
          local_date: string;
          distance_meters?: number;
          duration_seconds?: number;
          elevation_meters?: number;
          is_manual?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["activities"]["Insert"]>;
        Relationships: [];
      };
      /**
       * Append-only log of consent to activity data processing (story 3.2).
       * No Update type, deliberately: withdrawing adds a row, never edits one.
       */
      activity_consents: {
        Row: {
          id: string;
          profile_id: string;
          action: "granted" | "withdrawn";
          /** Which text was agreed to. Null on a withdrawal. */
          version: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          action: "granted" | "withdrawn";
          version?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      /**
       * A linked activity account (story 3.3).
       *
       * Tokens are encrypted by the application before they get here, and the
       * table carries no read policy for anyone — not even the owner. Row
       * level security filters rows, not columns, so a read policy would hand
       * a participant their own access token.
       */
      activity_connections: {
        Row: {
          id: string;
          profile_id: string;
          provider: ActivityProviderKey;
          /** The athlete's identifier at the provider. */
          provider_account_id: string;
          /** Ciphertext. Never a token in clear. */
          access_token: string;
          refresh_token: string;
          expires_at: string;
          /** What was actually granted, which can be narrower than asked. */
          scopes: string[];
          status: "active" | "broken";
          connected_at: string;
          last_synced_at: string | null;
          disconnected_at: string | null;
          /** Claim held while a refresh is in flight (story 3.7). */
          refreshing_at: string | null;
          broken_at: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          provider: ActivityProviderKey;
          provider_account_id: string;
          access_token: string;
          refresh_token: string;
          expires_at: string;
          scopes?: string[];
          status?: "active" | "broken";
          connected_at?: string;
          last_synced_at?: string | null;
          disconnected_at?: string | null;
          refreshing_at?: string | null;
          broken_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["activity_connections"]["Insert"]
        >;
        Relationships: [];
      };
      card_rarities: {
        Row: {
          slug: CardRarity;
          label: string;
          /** Relative, not a percentage. Tuned in SQL, never in code. */
          weight: number;
          rank: number;
          created_at: string;
        };
        Insert: {
          slug: CardRarity;
          label: string;
          weight: number;
          rank: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["card_rarities"]["Insert"]
        >;
        Relationships: [];
      };
      cards: {
        Row: {
          id: string;
          edition_id: string;
          title: string;
          description: string;
          rarity: CardRarity;
          /** Empty until the visual exists. The album draws a placeholder. */
          image_path: string;
          /** Nothing is drawn before this is set. */
          published_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          edition_id: string;
          title: string;
          description?: string;
          rarity: CardRarity;
          image_path?: string;
          published_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cards"]["Insert"]>;
        Relationships: [];
      };
      card_grants: {
        Row: {
          id: string;
          profile_id: string;
          edition_id: string;
          card_id: string;
          /** Carries the integrity of the collection ranking (D8). */
          source: CardGrantSource;
          assignment_id: string | null;
          granted_at: string;
          /** Null while the card is still waiting to be discovered. */
          revealed_at: string | null;
          /** Which purchase produced it. Null for everything earned. */
          pack_purchase_id: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          edition_id: string;
          card_id: string;
          source: CardGrantSource;
          assignment_id?: string | null;
          granted_at?: string;
          revealed_at?: string | null;
          pack_purchase_id?: string | null;
        };
        /* One column, and one only. A grant is a fact, never a correction —
           but "has been looked at" is a second fact about it, not a rewrite
           of the first. Narrowing the type here is what stops a stray
           `source` from ever being written by the reveal path. */
        Update: { revealed_at?: string | null };
        Relationships: [];
      };
      card_packs: {
        Row: {
          id: string;
          edition_id: string;
          slug: string;
          name: string;
          tagline: string;
          price_cents: number;
          /** Equal to the price by constraint: a pack has no counterpart. */
          donated_cents: number;
          card_count: number;
          /** A floor, not a ceiling. Null means no guarantee. */
          guaranteed_rarity: CardRarity | null;
          position: number;
          available: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          edition_id: string;
          slug: string;
          name: string;
          tagline?: string;
          price_cents: number;
          donated_cents: number;
          card_count?: number;
          guaranteed_rarity?: CardRarity | null;
          position?: number;
          available?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["card_packs"]["Insert"]>;
        Relationships: [];
      };
      pack_purchases: {
        Row: {
          id: string;
          profile_id: string;
          edition_id: string;
          pack_id: string;
          status: PackPurchaseStatus;
          /** The promise, frozen at the moment of sale. */
          price_cents: number;
          card_count: number;
          guaranteed_rarity: CardRarity | null;
          stripe_session_id: string | null;
          created_at: string;
          paid_at: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          edition_id: string;
          pack_id: string;
          status?: PackPurchaseStatus;
          price_cents: number;
          card_count: number;
          guaranteed_rarity?: CardRarity | null;
          stripe_session_id?: string | null;
          created_at?: string;
          paid_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["pack_purchases"]["Insert"]
        >;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          profile_id: string;
          /** The push service's address for one browser on one device. */
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
          last_success_at: string | null;
          /** Sender's bookkeeping — never written by a participant. */
          failure_count: number;
          disabled_at: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
          last_success_at?: string | null;
          failure_count?: number;
          disabled_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["push_subscriptions"]["Insert"]
        >;
        Relationships: [];
      };
      leaderboard_settings: {
        Row: {
          id: boolean;
          /** Team score = points / (members ^ exponent). Tuned in SQL. */
          team_exponent: number;
          team_min_members: number;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          team_exponent?: number;
          team_min_members?: number;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["leaderboard_settings"]["Insert"]
        >;
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          edition_id: string;
          name: string;
          slug: string;
          /** The secret. Never reaches a participant who is not the captain. */
          join_code: string;
          captain_id: string;
          kind: "libre" | "entreprise" | "association";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          edition_id: string;
          name: string;
          slug: string;
          join_code: string;
          captain_id: string;
          kind?: "libre" | "entreprise" | "association";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["teams"]["Insert"]>;
        Relationships: [];
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          profile_id: string;
          edition_id: string;
          role: "capitaine" | "membre";
          joined_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          profile_id: string;
          edition_id: string;
          role?: "capitaine" | "membre";
          joined_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_members"]["Insert"]>;
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          profile_id: string;
          channel_push: boolean;
          channel_email: boolean;
          cat_defi_du_jour: boolean;
          cat_resultat: boolean;
          cat_carte: boolean;
          cat_annonce: boolean;
          cat_relance: boolean;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          channel_push?: boolean;
          channel_email?: boolean;
          cat_defi_du_jour?: boolean;
          cat_resultat?: boolean;
          cat_carte?: boolean;
          cat_annonce?: boolean;
          cat_relance?: boolean;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["notification_preferences"]["Insert"]
        >;
        Relationships: [];
      };
      notification_deliveries: {
        Row: {
          id: string;
          profile_id: string;
          /** What makes a send unique. The guard against sending twice. */
          dedupe_key: string;
          category: string;
          channel: "push" | "email" | "none";
          sent_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          dedupe_key: string;
          category: string;
          channel: "push" | "email" | "none";
          sent_at?: string;
        };
        /* No Update type: a delivery is a fact, never a correction. */
        Update: never;
        Relationships: [];
      };
      news_posts: {
        Row: {
          id: string;
          edition_id: string;
          author_id: string | null;
          title: string;
          body: string;
          image_path: string;
          kind: "admin" | "auto";
          /** Null means a draft. Invisible to participants. */
          published_at: string | null;
          is_pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          edition_id: string;
          author_id?: string | null;
          title: string;
          body?: string;
          image_path?: string;
          kind?: "admin" | "auto";
          published_at?: string | null;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["news_posts"]["Insert"]>;
        Relationships: [];
      };
      integrity_settings: {
        Row: {
          id: boolean;
          max_run_speed_kmh: number;
          max_bike_speed_kmh: number;
          max_duration_hours: number;
          max_elevation_per_km: number;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          max_run_speed_kmh?: number;
          max_bike_speed_kmh?: number;
          max_duration_hours?: number;
          max_elevation_per_km?: number;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["integrity_settings"]["Insert"]
        >;
        Relationships: [];
      };
      activity_flags: {
        Row: {
          id: string;
          activity_id: string;
          profile_id: string;
          /** The rule that tripped, in French: it is read in the queue. */
          rule: string;
          observed: number;
          threshold: number;
          unit: string;
          status: "pending" | "accepted" | "dismissed";
          resolution_reason: string | null;
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          activity_id: string;
          profile_id: string;
          rule: string;
          observed: number;
          threshold: number;
          unit: string;
          status?: "pending" | "accepted" | "dismissed";
          resolution_reason?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["activity_flags"]["Insert"]
        >;
        Relationships: [];
      };
      admin_audit_log: {
        Row: {
          id: string;
          admin_id: string;
          action: string;
          target_table: string | null;
          target_id: string | null;
          payload: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id: string;
          action: string;
          target_table?: string | null;
          target_id?: string | null;
          payload?: Record<string, unknown>;
          created_at?: string;
        };
        /* No Update type on purpose: the table is append-only and carries no
           update or delete policy. Declaring one would suggest otherwise. */
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      /** Pseudonym and avatar only — see the migration for why. */
      public_profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
        };
        Relationships: [];
      };
      /**
       * All eight rankings, recomputed every fifteen minutes.
       *
       * A materialised view, so nothing computes a ranking on demand. The
       * general ranking never reads `card_grants`; the collection ranking
       * counts only what was earned by playing (architecture D8, D14).
       */
      leaderboard_snapshots: {
        Row: {
          edition_id: string;
          profile_id: string;
          /** Day of the photograph, in `YYYY-MM-DD`. */
          taken_on: string;
          rank_points: number;
          rank_challenges: number;
          rank_cards: number;
          rank_run: number;
          rank_bike: number;
          rank_activities: number;
          rank_duration: number;
          created_at: string;
        };
        /* No Insert or Update type on purpose: the table has no write policy
           for anybody, and the photograph is taken by a database function.
           Somebody able to write here could invent a flattering progression —
           the only figure of epic 13 that can be faked. */
        Relationships: [];
      };
      leaderboard_entries: {
        Row: {
          profile_id: string;
          edition_id: string;
          team_id: string | null;
          points: number;
          challenges_succeeded: number;
          /** Cards earned by playing. Never a bought pack. */
          cards_earned: number;
          run_distance_meters: number;
          bike_distance_meters: number;
          activity_count: number;
          total_duration_seconds: number;
          rank_points: number;
          rank_challenges: number;
          rank_cards: number;
          rank_run: number;
          rank_bike: number;
          rank_activities: number;
          rank_duration: number;
          computed_at: string;
        };
        Relationships: [];
      };
      /** Name, slug and kind. Never the join code — see the migration. */
      public_teams: {
        Row: {
          id: string;
          edition_id: string;
          name: string;
          slug: string;
          kind: "libre" | "entreprise" | "association";
          created_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      /** Recomputes the rankings. False when one is already running. */
      refresh_leaderboards: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      /** Copies today's ranks into the snapshot table (story 13.1). */
      snapshot_leaderboard_ranks: {
        Args: { p_day?: string } | Record<string, never>;
        /** Rows written. Zero means already taken today. */
        Returns: number;
      };
      /** Completes a challenge and grants its card in one transaction. */
      complete_challenge_with_card: {
        Args: {
          p_assignment_id: string;
          p_points: number;
          p_evidence: Record<string, unknown>;
          p_card_id: string | null;
        };
        Returns: Array<{ completed: boolean; card_id: string | null }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
