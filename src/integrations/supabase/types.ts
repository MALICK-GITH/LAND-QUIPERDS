export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          metadata: Json
          note: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          metadata?: Json
          note?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          metadata?: Json
          note?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      challenges: {
        Row: {
          accepted_amount: number | null
          amount: number
          challenged_id: string
          challenger_id: string
          created_at: string
          duel_id: string | null
          expires_at: string
          id: string
          status: Database["public"]["Enums"]["challenge_status"]
        }
        Insert: {
          accepted_amount?: number | null
          amount: number
          challenged_id: string
          challenger_id: string
          created_at?: string
          duel_id?: string | null
          expires_at?: string
          id?: string
          status?: Database["public"]["Enums"]["challenge_status"]
        }
        Update: {
          accepted_amount?: number | null
          amount?: number
          challenged_id?: string
          challenger_id?: string
          created_at?: string
          duel_id?: string | null
          expires_at?: string
          id?: string
          status?: Database["public"]["Enums"]["challenge_status"]
        }
        Relationships: [
          {
            foreignKeyName: "challenges_duel_fk"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "duels"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_settings: {
        Row: {
          active: boolean
          created_at: string
          id: string
          max_amount: number | null
          min_amount: number
          name: string
          rate: number
          type: Database["public"]["Enums"]["commission_type"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          max_amount?: number | null
          min_amount?: number
          name: string
          rate: number
          type: Database["public"]["Enums"]["commission_type"]
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          max_amount?: number | null
          min_amount?: number
          name?: string
          rate?: number
          type?: Database["public"]["Enums"]["commission_type"]
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          last_message_preview: string | null
          updated_at: string
          user_high: string
          user_low: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          updated_at?: string
          user_high: string
          user_low: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          updated_at?: string
          user_high?: string
          user_low?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          fraud_flags: string[]
          fraud_score: number
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          reference: string
          reviewed_at: string | null
          reviewed_by: string | null
          screenshot: string | null
          sender_name: string
          sender_phone: string
          status: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          fraud_flags?: string[]
          fraud_score?: number
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          reference: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot?: string | null
          sender_name: string
          sender_phone: string
          status?: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          fraud_flags?: string[]
          fraud_score?: number
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          reference?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot?: string | null
          sender_name?: string
          sender_phone?: string
          status?: Database["public"]["Enums"]["request_status"]
          user_id?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      duel_messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          body: string
          created_at: string
          duel_id: string
          id: string
          is_dispute_evidence: boolean
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          body: string
          created_at?: string
          duel_id: string
          id?: string
          is_dispute_evidence?: boolean
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          body?: string
          created_at?: string
          duel_id?: string
          id?: string
          is_dispute_evidence?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duel_messages_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "duels"
            referencedColumns: ["id"]
          },
        ]
      }
      duels: {
        Row: {
          admin_note: string | null
          amount: number
          challenge_id: string | null
          commission_amount: number
          commission_rate: number
          created_at: string
          dispute_reason: string | null
          finished_at: string | null
          id: string
          is_draw: boolean
          loser_id: string | null
          manual_review_due_at: string | null
          manual_review_requested_at: string | null
          player1_id: string
          player1_vote: Database["public"]["Enums"]["duel_vote"] | null
          player1_voted_at: string | null
          player2_id: string
          player2_vote: Database["public"]["Enums"]["duel_vote"] | null
          player2_voted_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["duel_status"]
          winner_id: string | null
        }
        Insert: {
          admin_note?: string | null
          amount: number
          challenge_id?: string | null
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          dispute_reason?: string | null
          finished_at?: string | null
          id?: string
          is_draw?: boolean
          loser_id?: string | null
          manual_review_due_at?: string | null
          manual_review_requested_at?: string | null
          player1_id: string
          player1_vote?: Database["public"]["Enums"]["duel_vote"] | null
          player1_voted_at?: string | null
          player2_id: string
          player2_vote?: Database["public"]["Enums"]["duel_vote"] | null
          player2_voted_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["duel_status"]
          winner_id?: string | null
        }
        Update: {
          admin_note?: string | null
          amount?: number
          challenge_id?: string | null
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          dispute_reason?: string | null
          finished_at?: string | null
          id?: string
          is_draw?: boolean
          loser_id?: string | null
          manual_review_due_at?: string | null
          manual_review_requested_at?: string | null
          player1_id?: string
          player1_vote?: Database["public"]["Enums"]["duel_vote"] | null
          player1_voted_at?: string | null
          player2_id?: string
          player2_vote?: Database["public"]["Enums"]["duel_vote"] | null
          player2_voted_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["duel_status"]
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "duels_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_admin_notice: boolean
          is_read: boolean
          link: string | null
          metadata: Json
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_admin_notice?: boolean
          is_read?: boolean
          link?: string | null
          metadata?: Json
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_admin_notice?: boolean
          is_read?: boolean
          link?: string | null
          metadata?: Json
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          badge: string | null
          country: string
          created_at: string
          current_streak: number
          deleted_at: string | null
          draws: number
          efootball_username: string
          first_name: string | null
          id: string
          is_banned: boolean
          last_name: string | null
          level: Database["public"]["Enums"]["user_level"]
          losses: number
          rank: number | null
          reports_count: number
          reputation: number
          status: Database["public"]["Enums"]["user_status"]
          telegram_chat_id: number | null
          telegram_linked_at: string | null
          telegram_username: string | null
          total_earnings: number
          updated_at: string
          username: string
          wins: number
        }
        Insert: {
          badge?: string | null
          country?: string
          created_at?: string
          current_streak?: number
          deleted_at?: string | null
          draws?: number
          efootball_username: string
          first_name?: string | null
          id: string
          is_banned?: boolean
          last_name?: string | null
          level?: Database["public"]["Enums"]["user_level"]
          losses?: number
          rank?: number | null
          reports_count?: number
          reputation?: number
          status?: Database["public"]["Enums"]["user_status"]
          telegram_chat_id?: number | null
          telegram_linked_at?: string | null
          telegram_username?: string | null
          total_earnings?: number
          updated_at?: string
          username: string
          wins?: number
        }
        Update: {
          badge?: string | null
          country?: string
          created_at?: string
          current_streak?: number
          deleted_at?: string | null
          draws?: number
          efootball_username?: string
          first_name?: string | null
          id?: string
          is_banned?: boolean
          last_name?: string | null
          level?: Database["public"]["Enums"]["user_level"]
          losses?: number
          rank?: number | null
          reports_count?: number
          reputation?: number
          status?: Database["public"]["Enums"]["user_status"]
          telegram_chat_id?: number | null
          telegram_linked_at?: string | null
          telegram_username?: string | null
          total_earnings?: number
          updated_at?: string
          username?: string
          wins?: number
        }
        Relationships: []
      }
      telegram_link_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          balance_after: number | null
          balance_before: number | null
          created_at: string
          description: string | null
          id: string
          related_deposit: string | null
          related_duel: string | null
          related_withdrawal: string | null
          status: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          description?: string | null
          id?: string
          related_deposit?: string | null
          related_duel?: string | null
          related_withdrawal?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          description?: string | null
          id?: string
          related_deposit?: string | null
          related_duel?: string | null
          related_withdrawal?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          type?: Database["public"]["Enums"]["tx_type"]
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      username_change_requests: {
        Row: {
          created_at: string
          id: string
          new_username: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_username: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          new_username?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance_available: number
          balance_locked: number
          created_at: string
          deleted_at: string | null
          id: string
          total_deposited: number
          total_lost: number
          total_withdrawn: number
          total_won: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_available?: number
          balance_locked?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          total_deposited?: number
          total_lost?: number
          total_withdrawn?: number
          total_won?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_available?: number
          balance_locked?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          total_deposited?: number
          total_lost?: number
          total_withdrawn?: number
          total_won?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          fraud_flags: string[]
          fraud_score: number
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          net_amount: number
          phone_number: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          fraud_flags?: string[]
          fraud_score?: number
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          net_amount?: number
          phone_number: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          fraud_flags?: string[]
          fraud_score?: number
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          net_amount?: number
          phone_number?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _admin_log: {
        Args: {
          p_action: string
          p_meta?: Json
          p_note: string
          p_target: string
          p_target_type: string
        }
        Returns: undefined
      }
      _notify: {
        Args: {
          p_body: string
          p_link?: string
          p_title: string
          p_type: string
          p_user: string
        }
        Returns: undefined
      }
      _notify_admins: {
        Args: {
          p_body: string
          p_link?: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      _record_tx: {
        Args: {
          p_after: number
          p_amount: number
          p_before: number
          p_deposit?: string
          p_desc: string
          p_duel?: string
          p_type: Database["public"]["Enums"]["tx_type"]
          p_user: string
          p_withdrawal?: string
        }
        Returns: undefined
      }
      _require_admin: { Args: never; Returns: undefined }
      _settle_duel: {
        Args: {
          p_duel: string
          p_note?: string
          p_outcome: string
          p_winner?: string
        }
        Returns: undefined
      }
      admin_adjust_balance: {
        Args: { p_amount: number; p_note: string; p_user: string }
        Returns: undefined
      }
      admin_ban_user: {
        Args: { p_banned: boolean; p_note?: string; p_user: string }
        Returns: undefined
      }
      admin_resolve_dispute: {
        Args: {
          p_duel: string
          p_note?: string
          p_resolution: string
          p_winner?: string
        }
        Returns: undefined
      }
      admin_review_deposit: {
        Args: { p_approve: boolean; p_deposit: string; p_note?: string }
        Returns: undefined
      }
      admin_review_username_change: {
        Args: { p_approve: boolean; p_note?: string; p_request: string }
        Returns: undefined
      }
      admin_review_withdrawal: {
        Args: { p_approve: boolean; p_note?: string; p_withdrawal: string }
        Returns: undefined
      }
      create_challenge: {
        Args: { p_amount: number; p_challenged: string; p_minutes?: number }
        Returns: string
      }
      create_deposit: {
        Args: {
          p_amount: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_reference: string
          p_screenshot?: string
          p_sender_name: string
          p_sender_phone: string
        }
        Returns: string
      }
      create_telegram_link_code: { Args: never; Returns: string }
      create_withdrawal: {
        Args: {
          p_amount: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_phone: string
        }
        Returns: string
      }
      expire_stale_challenges: { Args: never; Returns: undefined }
      get_commission_rate: { Args: { p_amount: number }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      list_admins: {
        Args: never
        Returns: {
          badge: string
          country: string
          created_at: string
          id: string
          level: Database["public"]["Enums"]["user_level"]
          username: string
        }[]
      }
      mark_conversation_read: {
        Args: { p_conversation: string }
        Returns: undefined
      }
      open_duel_dispute: {
        Args: { p_duel: string; p_reason: string }
        Returns: undefined
      }
      process_settlement_queue: { Args: never; Returns: undefined }
      request_username_change: {
        Args: { p_new_username: string; p_reason: string }
        Returns: string
      }
      respond_challenge: {
        Args: {
          p_action: string
          p_challenge: string
          p_counter_amount?: number
        }
        Returns: string
      }
      send_direct_message: {
        Args: {
          p_attachment_name?: string
          p_attachment_path?: string
          p_attachment_size?: number
          p_attachment_type?: string
          p_body: string
          p_conversation: string
        }
        Returns: string
      }
      start_conversation: { Args: { p_other: string }; Returns: string }
      submit_duel_vote: {
        Args: {
          p_duel: string
          p_vote: Database["public"]["Enums"]["duel_vote"]
        }
        Returns: string
      }
      unlink_telegram: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "player" | "admin"
      challenge_status:
        | "pending"
        | "counter_offer"
        | "accepted"
        | "declined"
        | "cancelled"
        | "expired"
      commission_type: "small" | "medium" | "high" | "tournament"
      duel_status:
        | "active"
        | "waiting_votes"
        | "finished"
        | "dispute"
        | "cancelled"
      duel_vote: "win" | "draw" | "lose"
      payment_method: "Wave" | "MTN"
      request_status: "pending" | "approved" | "rejected"
      tx_status: "pending" | "completed" | "failed"
      tx_type:
        | "deposit"
        | "withdrawal"
        | "stake_locked"
        | "stake_refunded"
        | "win"
        | "loss"
        | "commission"
        | "adjustment"
      user_level: "Amateur" | "Pro" | "Elite"
      user_status: "active" | "suspended" | "banned"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["player", "admin"],
      challenge_status: [
        "pending",
        "counter_offer",
        "accepted",
        "declined",
        "cancelled",
        "expired",
      ],
      commission_type: ["small", "medium", "high", "tournament"],
      duel_status: [
        "active",
        "waiting_votes",
        "finished",
        "dispute",
        "cancelled",
      ],
      duel_vote: ["win", "draw", "lose"],
      payment_method: ["Wave", "MTN"],
      request_status: ["pending", "approved", "rejected"],
      tx_status: ["pending", "completed", "failed"],
      tx_type: [
        "deposit",
        "withdrawal",
        "stake_locked",
        "stake_refunded",
        "win",
        "loss",
        "commission",
        "adjustment",
      ],
      user_level: ["Amateur", "Pro", "Elite"],
      user_status: ["active", "suspended", "banned"],
    },
  },
} as const
