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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata: Json
          status: string
          target_label: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata?: Json
          status?: string
          target_label?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json
          status?: string
          target_label?: string | null
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          kind: string
          name: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          kind: string
          name: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      blocked_terms: {
        Row: {
          action: string
          allowlist: Json
          created_at: string
          created_by: string | null
          enabled: boolean
          false_positives: number
          hits: number
          id: string
          ignore_channels: Json
          match_mode: string
          min_confidence: number
          severity: string
          term: string
          updated_at: string
        }
        Insert: {
          action?: string
          allowlist?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          false_positives?: number
          hits?: number
          id?: string
          ignore_channels?: Json
          match_mode?: string
          min_confidence?: number
          severity?: string
          term: string
          updated_at?: string
        }
        Update: {
          action?: string
          allowlist?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          false_positives?: number
          hits?: number
          id?: string
          ignore_channels?: Json
          match_mode?: string
          min_confidence?: number
          severity?: string
          term?: string
          updated_at?: string
        }
        Relationships: []
      }
      bot_commands: {
        Row: {
          category: string
          created_at: string
          description: string
          discord_command_id: string | null
          enabled: boolean
          failures: number
          id: string
          last_used_at: string | null
          name: string
          options: Json
          registered: boolean
          required_role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string
          uses: number
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          discord_command_id?: string | null
          enabled?: boolean
          failures?: number
          id?: string
          last_used_at?: string | null
          name: string
          options?: Json
          registered?: boolean
          required_role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
          uses?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          discord_command_id?: string | null
          enabled?: boolean
          failures?: number
          id?: string
          last_used_at?: string | null
          name?: string
          options?: Json
          registered?: boolean
          required_role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
          uses?: number
        }
        Relationships: []
      }
      channel_settings: {
        Row: {
          channel_id: string | null
          channel_name: string | null
          channel_type: number | null
          created_at: string
          guild_id: string
          id: string
          purpose: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          channel_id?: string | null
          channel_name?: string | null
          channel_type?: number | null
          created_at?: string
          guild_id: string
          id?: string
          purpose: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          channel_id?: string | null
          channel_name?: string | null
          channel_type?: number | null
          created_at?: string
          guild_id?: string
          id?: string
          purpose?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      discord_channels: {
        Row: {
          channel_id: string
          created_at: string
          guild_id: string
          id: string
          name: string
          nsfw: boolean
          parent_id: string | null
          position: number
          synced_at: string
          type: number
        }
        Insert: {
          channel_id: string
          created_at?: string
          guild_id: string
          id?: string
          name: string
          nsfw?: boolean
          parent_id?: string | null
          position?: number
          synced_at?: string
          type?: number
        }
        Update: {
          channel_id?: string
          created_at?: string
          guild_id?: string
          id?: string
          name?: string
          nsfw?: boolean
          parent_id?: string | null
          position?: number
          synced_at?: string
          type?: number
        }
        Relationships: []
      }
      discord_members: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          guild_id: string
          id: string
          is_bot: boolean
          joined_at: string | null
          member_id: string
          roles: Json
          synced_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          guild_id: string
          id?: string
          is_bot?: boolean
          joined_at?: string | null
          member_id: string
          roles?: Json
          synced_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          guild_id?: string
          id?: string
          is_bot?: boolean
          joined_at?: string | null
          member_id?: string
          roles?: Json
          synced_at?: string
          username?: string
        }
        Relationships: []
      }
      discord_roles: {
        Row: {
          color: number
          created_at: string
          guild_id: string
          id: string
          managed: boolean
          member_count: number | null
          name: string
          permissions: string | null
          position: number
          role_id: string
          synced_at: string
        }
        Insert: {
          color?: number
          created_at?: string
          guild_id: string
          id?: string
          managed?: boolean
          member_count?: number | null
          name: string
          permissions?: string | null
          position?: number
          role_id: string
          synced_at?: string
        }
        Update: {
          color?: number
          created_at?: string
          guild_id?: string
          id?: string
          managed?: boolean
          member_count?: number | null
          name?: string
          permissions?: string | null
          position?: number
          role_id?: string
          synced_at?: string
        }
        Relationships: []
      }
      economy_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          member_discord_id: string | null
          member_label: string
          notes: string | null
          reference: string
          risk: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          member_discord_id?: string | null
          member_label: string
          notes?: string | null
          reference?: string
          risk?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          member_discord_id?: string | null
          member_label?: string
          notes?: string | null
          reference?: string
          risk?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      embeds: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          fields: Json
          footer: string | null
          id: string
          image_url: string | null
          key: string
          last_published_at: string | null
          name: string
          target_channel_id: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          footer?: string | null
          id?: string
          image_url?: string | null
          key: string
          last_published_at?: string | null
          name: string
          target_channel_id?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          footer?: string | null
          id?: string
          image_url?: string | null
          key?: string
          last_published_at?: string | null
          name?: string
          target_channel_id?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      guild_config: {
        Row: {
          application_id: string | null
          bot_avatar: string | null
          bot_username: string | null
          connection_status: string
          created_at: string
          guild_icon: string | null
          guild_id: string | null
          guild_name: string | null
          id: string
          is_active: boolean
          last_error: string | null
          last_sync_at: string | null
          member_count: number | null
          token_configured: boolean
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          bot_avatar?: string | null
          bot_username?: string | null
          connection_status?: string
          created_at?: string
          guild_icon?: string | null
          guild_id?: string | null
          guild_name?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          member_count?: number | null
          token_configured?: boolean
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          bot_avatar?: string | null
          bot_username?: string | null
          connection_status?: string
          created_at?: string
          guild_icon?: string | null
          guild_id?: string | null
          guild_name?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          member_count?: number | null
          token_configured?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      moderation_cases: {
        Row: {
          created_at: string
          evidence: Json
          id: string
          moderator_id: string | null
          reason: string
          reference: string
          resolved_at: string | null
          severity: string
          source: string
          status: string
          target_discord_id: string | null
          target_label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evidence?: Json
          id?: string
          moderator_id?: string | null
          reason: string
          reference?: string
          resolved_at?: string | null
          severity?: string
          source?: string
          status?: string
          target_discord_id?: string | null
          target_label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evidence?: Json
          id?: string
          moderator_id?: string | null
          reason?: string
          reference?: string
          resolved_at?: string | null
          severity?: string
          source?: string
          status?: string
          target_discord_id?: string | null
          target_label?: string
          updated_at?: string
        }
        Relationships: []
      }
      nsfw_reviews: {
        Row: {
          author_discord_id: string | null
          author_label: string | null
          channel_id: string | null
          channel_name: string | null
          confidence: number
          content_type: string
          created_at: string
          detector: string
          id: string
          message_id: string | null
          message_link: string | null
          metadata: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          author_discord_id?: string | null
          author_label?: string | null
          channel_id?: string | null
          channel_name?: string | null
          confidence?: number
          content_type?: string
          created_at?: string
          detector?: string
          id?: string
          message_id?: string | null
          message_link?: string | null
          metadata?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          author_discord_id?: string | null
          author_label?: string | null
          channel_id?: string | null
          channel_name?: string | null
          confidence?: number
          content_type?: string
          created_at?: string
          detector?: string
          id?: string
          message_id?: string | null
          message_link?: string | null
          metadata?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      punishments: {
        Row: {
          active: boolean
          applied_by: string | null
          case_id: string | null
          created_at: string
          dispatch_status: string
          duration_minutes: number | null
          expires_at: string | null
          id: string
          kind: string
          reason: string
          revoked_at: string | null
          target_discord_id: string | null
          target_label: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          applied_by?: string | null
          case_id?: string | null
          created_at?: string
          dispatch_status?: string
          duration_minutes?: number | null
          expires_at?: string | null
          id?: string
          kind?: string
          reason: string
          revoked_at?: string | null
          target_discord_id?: string | null
          target_label: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          applied_by?: string | null
          case_id?: string | null
          created_at?: string
          dispatch_status?: string
          duration_minutes?: number | null
          expires_at?: string | null
          id?: string
          kind?: string
          reason?: string
          revoked_at?: string | null
          target_discord_id?: string | null
          target_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "punishments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "moderation_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      raid_events: {
        Row: {
          action_taken: string | null
          created_at: string
          details: Json
          id: string
          joins_detected: number | null
          severity: string
          status: string
          trigger: string
          window_seconds: number | null
        }
        Insert: {
          action_taken?: string | null
          created_at?: string
          details?: Json
          id?: string
          joins_detected?: number | null
          severity?: string
          status?: string
          trigger: string
          window_seconds?: number | null
        }
        Update: {
          action_taken?: string | null
          created_at?: string
          details?: Json
          id?: string
          joins_detected?: number | null
          severity?: string
          status?: string
          trigger?: string
          window_seconds?: number | null
        }
        Relationships: []
      }
      server_templates: {
        Row: {
          channel_id: string | null
          color: string
          created_at: string
          description: string
          enabled: boolean
          fields: Json
          footer: string | null
          id: string
          image_url: string | null
          key: string
          last_error: string | null
          message_id: string | null
          name: string
          pin_message: boolean
          pinned: boolean
          published_at: string | null
          purpose: string
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          color?: string
          created_at?: string
          description?: string
          enabled?: boolean
          fields?: Json
          footer?: string | null
          id?: string
          image_url?: string | null
          key: string
          last_error?: string | null
          message_id?: string | null
          name: string
          pin_message?: boolean
          pinned?: boolean
          published_at?: string | null
          purpose: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          color?: string
          created_at?: string
          description?: string
          enabled?: boolean
          fields?: Json
          footer?: string | null
          id?: string
          image_url?: string | null
          key?: string
          last_error?: string | null
          message_id?: string | null
          name?: string
          pin_message?: boolean
          pinned?: boolean
          published_at?: string | null
          purpose?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      suggestion_votes: {
        Row: {
          created_at: string
          id: string
          suggestion_id: string
          value: number
          voter_discord_id: string | null
          voter_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          suggestion_id: string
          value?: number
          voter_discord_id?: string | null
          voter_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          suggestion_id?: string
          value?: number
          voter_discord_id?: string | null
          voter_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_votes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          author_discord_id: string | null
          author_label: string
          body: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          downvotes: number
          forum_thread_id: string | null
          id: string
          status: string
          tags: Json
          title: string
          updated_at: string
          upvotes: number
        }
        Insert: {
          author_discord_id?: string | null
          author_label?: string
          body?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          downvotes?: number
          forum_thread_id?: string | null
          id?: string
          status?: string
          tags?: Json
          title: string
          updated_at?: string
          upvotes?: number
        }
        Update: {
          author_discord_id?: string | null
          author_label?: string
          body?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          downvotes?: number
          forum_thread_id?: string | null
          id?: string
          status?: string
          tags?: Json
          title?: string
          updated_at?: string
          upvotes?: number
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          author_id: string | null
          author_label: string
          body: string
          created_at: string
          id: string
          internal: boolean
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          author_label?: string
          body: string
          created_at?: string
          id?: string
          internal?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          author_label?: string
          body?: string
          created_at?: string
          id?: string
          internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assignee_id: string | null
          category: string
          channel_id: string | null
          closed_at: string | null
          created_at: string
          description: string | null
          id: string
          priority: string
          reference: string
          requester: string
          requester_discord_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          category?: string
          channel_id?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          reference?: string
          requester: string
          requester_discord_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          category?: string
          channel_id?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          reference?: string
          requester?: string
          requester_discord_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      welcome_banners: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          last_used_at: string | null
          path: string
          sort_order: number
          used_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          last_used_at?: string | null
          path: string
          sort_order?: number
          used_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          last_used_at?: string | null
          path?: string
          sort_order?: number
          used_count?: number
        }
        Relationships: []
      }
      welcome_config: {
        Row: {
          accent_color: string
          auto_role_id: string | null
          banner_path: string | null
          banner_subtitle: string
          banner_title: string
          banner_url: string | null
          channel_id: string | null
          created_at: string
          dm_message: string | null
          enabled: boolean
          id: string
          mention_user: boolean
          message: string
          show_avatar: boolean
          show_member_number: boolean
          updated_at: string
        }
        Insert: {
          accent_color?: string
          auto_role_id?: string | null
          banner_path?: string | null
          banner_subtitle?: string
          banner_title?: string
          banner_url?: string | null
          channel_id?: string | null
          created_at?: string
          dm_message?: string | null
          enabled?: boolean
          id?: string
          mention_user?: boolean
          message?: string
          show_avatar?: boolean
          show_member_number?: boolean
          updated_at?: string
        }
        Update: {
          accent_color?: string
          auto_role_id?: string | null
          banner_path?: string | null
          banner_subtitle?: string
          banner_title?: string
          banner_url?: string | null
          channel_id?: string | null
          created_at?: string
          dm_message?: string | null
          enabled?: boolean
          id?: string
          mention_user?: boolean
          message?: string
          show_avatar?: boolean
          show_member_number?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      welcome_events: {
        Row: {
          channel_id: string | null
          created_at: string
          error: string | null
          guild_id: string | null
          id: string
          member_id: string
          message_id: string | null
          status: string
          username: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          error?: string | null
          guild_id?: string | null
          id?: string
          member_id: string
          message_id?: string | null
          status?: string
          username: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          error?: string | null
          guild_id?: string | null
          id?: string
          member_id?: string
          message_id?: string | null
          status?: string
          username?: string
        }
        Relationships: []
      }
      worker_actions: {
        Row: {
          action_type: string
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_type: string
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      worker_heartbeats: {
        Row: {
          details: Json
          gateway_latency_ms: number | null
          id: string
          received_at: string
          shard_count: number | null
          status: string
          version: string | null
          worker_id: string
        }
        Insert: {
          details?: Json
          gateway_latency_ms?: number | null
          id?: string
          received_at?: string
          shard_count?: number | null
          status?: string
          version?: string | null
          worker_id: string
        }
        Update: {
          details?: Json
          gateway_latency_ms?: number | null
          id?: string
          received_at?: string
          shard_count?: number | null
          status?: string
          version?: string | null
          worker_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_moderator: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "admin" | "moderator" | "support" | "viewer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["owner", "admin", "moderator", "support", "viewer"],
    },
  },
} as const
