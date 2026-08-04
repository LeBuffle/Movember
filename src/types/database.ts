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
