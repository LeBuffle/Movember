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
export type AssignmentSource = "draw" | "common" | "manual";
export type AssignmentStatus = "open" | "completed" | "missed";

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
        };
        Insert: {
          id: string;
          display_name: string;
          email?: string | null;
          avatar_url?: string | null;
          role?: ProfileRole;
          created_at?: string;
          deleted_at?: string | null;
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
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["challenge_assignments"]["Insert"]
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
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
