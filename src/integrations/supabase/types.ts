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
      access_requests: {
        Row: {
          created_at: string
          id: string
          request_message: string | null
          requested_tier: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_message?: string | null
          requested_tier: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          request_message?: string | null
          requested_tier?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          action_type: string | null
          agent_name: string | null
          client_id: string | null
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          related_entity_id: string | null
          related_entity_type: string | null
          user_id: string
        }
        Insert: {
          action_type?: string | null
          agent_name?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          user_id: string
        }
        Update: {
          action_type?: string | null
          agent_name?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage_log: {
        Row: {
          action_type: string | null
          agent_name: string | null
          cost_eur: number
          created_at: string
          external_service: string | null
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action_type?: string | null
          agent_name?: string | null
          cost_eur: number
          created_at?: string
          external_service?: string | null
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action_type?: string | null
          agent_name?: string | null
          cost_eur?: number
          created_at?: string
          external_service?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brief_change_log: {
        Row: {
          brief_id: string
          changed_at: string
          changed_by: string
          field_path: string
          id: string
          new_value: Json | null
          old_value: Json | null
          reason: string | null
        }
        Insert: {
          brief_id: string
          changed_at?: string
          changed_by: string
          field_path: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Update: {
          brief_id?: string
          changed_at?: string
          changed_by?: string
          field_path?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brief_change_log_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "client_briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      caption_styles: {
        Row: {
          client_id: string | null
          config: Json
          created_at: string
          id: string
          is_global: boolean
          name: string
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          config: Json
          created_at?: string
          id?: string
          is_global?: boolean
          name: string
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          config?: Json
          created_at?: string
          id?: string
          is_global?: boolean
          name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caption_styles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caption_styles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_briefs: {
        Row: {
          ads_strategy: Json | null
          analytics_preferences: Json | null
          audience: Json | null
          brand_voice: Json | null
          client_id: string
          completion_pct: number
          content_strategy: Json | null
          created_at: string
          editing_preferences: Json | null
          id: string
          operational: Json | null
          publishing_preferences: Json | null
          schema_version: number
          scripting_preferences: Json | null
          updated_at: string
        }
        Insert: {
          ads_strategy?: Json | null
          analytics_preferences?: Json | null
          audience?: Json | null
          brand_voice?: Json | null
          client_id: string
          completion_pct?: number
          content_strategy?: Json | null
          created_at?: string
          editing_preferences?: Json | null
          id?: string
          operational?: Json | null
          publishing_preferences?: Json | null
          schema_version?: number
          scripting_preferences?: Json | null
          updated_at?: string
        }
        Update: {
          ads_strategy?: Json | null
          analytics_preferences?: Json | null
          audience?: Json | null
          brand_voice?: Json | null
          client_id?: string
          completion_pct?: number
          content_strategy?: Json | null
          created_at?: string
          editing_preferences?: Json | null
          id?: string
          operational?: Json | null
          publishing_preferences?: Json | null
          schema_version?: number
          scripting_preferences?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_briefs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          custom_brand_color: string | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          primary_language: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_brand_color?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          primary_language?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_brand_color?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          primary_language?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_accounts: {
        Row: {
          account_avatar_url: string | null
          account_handle: string | null
          client_id: string
          connected_at: string
          id: string
          last_sync_at: string | null
          platform: string
          status: string
          zernio_profile_key: string | null
        }
        Insert: {
          account_avatar_url?: string | null
          account_handle?: string | null
          client_id: string
          connected_at?: string
          id?: string
          last_sync_at?: string | null
          platform: string
          status?: string
          zernio_profile_key?: string | null
        }
        Update: {
          account_avatar_url?: string | null
          account_handle?: string | null
          client_id?: string
          connected_at?: string
          id?: string
          last_sync_at?: string | null
          platform?: string
          status?: string
          zernio_profile_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connected_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_ad_accounts: {
        Row: {
          account_name: string | null
          client_id: string
          connected_at: string
          id: string
          platform: string
          status: string
          unified_to_connection_id: string | null
        }
        Insert: {
          account_name?: string | null
          client_id: string
          connected_at?: string
          id?: string
          platform: string
          status?: string
          unified_to_connection_id?: string | null
        }
        Update: {
          account_name?: string | null
          client_id?: string
          connected_at?: string
          id?: string
          platform?: string
          status?: string
          unified_to_connection_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connected_ad_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          client_id: string | null
          created_at: string
          description: string | null
          hashtags: string[] | null
          id: string
          platforms: string[] | null
          source_video_id: string | null
          status: string
          thumbnail_candidates: Json | null
          thumbnail_custom_uploaded: boolean
          thumbnail_selected_index: number | null
          thumbnail_source: string | null
          thumbnail_video_frame_timestamp_s: number | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          hashtags?: string[] | null
          id?: string
          platforms?: string[] | null
          source_video_id?: string | null
          status?: string
          thumbnail_candidates?: Json | null
          thumbnail_custom_uploaded?: boolean
          thumbnail_selected_index?: number | null
          thumbnail_source?: string | null
          thumbnail_video_frame_timestamp_s?: number | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          hashtags?: string[] | null
          id?: string
          platforms?: string[] | null
          source_video_id?: string | null
          status?: string
          thumbnail_candidates?: Json | null
          thumbnail_custom_uploaded?: boolean
          thumbnail_selected_index?: number | null
          thumbnail_source?: string | null
          thumbnail_video_frame_timestamp_s?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          actual_cost_eur: number | null
          agent_name: string
          client_id: string | null
          completed_at: string | null
          created_at: string
          estimated_cost_eur: number | null
          id: string
          job_type: string
          payload: Json | null
          progress_message: string | null
          progress_pct: number
          result: Json | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          actual_cost_eur?: number | null
          agent_name: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          estimated_cost_eur?: number | null
          id?: string
          job_type: string
          payload?: Json | null
          progress_message?: string | null
          progress_pct?: number
          result?: Json | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          actual_cost_eur?: number | null
          agent_name?: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          estimated_cost_eur?: number | null
          id?: string
          job_type?: string
          payload?: Json | null
          progress_message?: string | null
          progress_pct?: number
          result?: Json | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      music_library: {
        Row: {
          bpm: number | null
          created_at: string
          duration_s: number | null
          genre: string | null
          id: string
          license: string | null
          loopable: boolean
          mood: string[] | null
          name: string
          storage_key: string
          user_id: string
        }
        Insert: {
          bpm?: number | null
          created_at?: string
          duration_s?: number | null
          genre?: string | null
          id?: string
          license?: string | null
          loopable?: boolean
          mood?: string[] | null
          name: string
          storage_key: string
          user_id: string
        }
        Update: {
          bpm?: number | null
          created_at?: string
          duration_s?: number | null
          genre?: string | null
          id?: string
          license?: string | null
          loopable?: boolean
          mood?: string[] | null
          name?: string
          storage_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "music_library_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_status: string
          api_spend_this_cycle_eur: number
          avatar_url: string | null
          budget_cycle_start: string
          budget_override_reason: string | null
          budget_set_by: string | null
          created_at: string
          custom_accent_color: string | null
          display_name: string | null
          email: string | null
          id: string
          is_owner: boolean
          is_unlimited: boolean
          monthly_api_budget_eur: number
          plan_tier: string
          theme_preference: string | null
          timezone: string | null
          ui_language: string | null
          updated_at: string
        }
        Insert: {
          access_status?: string
          api_spend_this_cycle_eur?: number
          avatar_url?: string | null
          budget_cycle_start?: string
          budget_override_reason?: string | null
          budget_set_by?: string | null
          created_at?: string
          custom_accent_color?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          is_owner?: boolean
          is_unlimited?: boolean
          monthly_api_budget_eur?: number
          plan_tier?: string
          theme_preference?: string | null
          timezone?: string | null
          ui_language?: string | null
          updated_at?: string
        }
        Update: {
          access_status?: string
          api_spend_this_cycle_eur?: number
          avatar_url?: string | null
          budget_cycle_start?: string
          budget_override_reason?: string | null
          budget_set_by?: string | null
          created_at?: string
          custom_accent_color?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          is_owner?: boolean
          is_unlimited?: boolean
          monthly_api_budget_eur?: number
          plan_tier?: string
          theme_preference?: string | null
          timezone?: string | null
          ui_language?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reference_videos: {
        Row: {
          actual_engagement_rate: number | null
          actual_views: number | null
          actual_watch_through_pct: number | null
          audio_events: Json | null
          auto_promoted: boolean
          client_id: string | null
          content_category: string
          content_hash: string | null
          created_at: string
          curated_by_user: boolean
          dimension_scores: Json | null
          duration_s: number | null
          format: string | null
          goal: string
          id: string
          language: string
          neural_matrix_key: string | null
          performance_tier: string | null
          platform: string[] | null
          quality_verified: boolean
          reactions: string[]
          region_timelines: Json | null
          source_url: string | null
          storage_key: string | null
          subcategory: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          user_id: string | null
          visual_events: Json | null
        }
        Insert: {
          actual_engagement_rate?: number | null
          actual_views?: number | null
          actual_watch_through_pct?: number | null
          audio_events?: Json | null
          auto_promoted?: boolean
          client_id?: string | null
          content_category?: string
          content_hash?: string | null
          created_at?: string
          curated_by_user?: boolean
          dimension_scores?: Json | null
          duration_s?: number | null
          format?: string | null
          goal?: string
          id?: string
          language?: string
          neural_matrix_key?: string | null
          performance_tier?: string | null
          platform?: string[] | null
          quality_verified?: boolean
          reactions?: string[]
          region_timelines?: Json | null
          source_url?: string | null
          storage_key?: string | null
          subcategory?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          visual_events?: Json | null
        }
        Update: {
          actual_engagement_rate?: number | null
          actual_views?: number | null
          actual_watch_through_pct?: number | null
          audio_events?: Json | null
          auto_promoted?: boolean
          client_id?: string | null
          content_category?: string
          content_hash?: string | null
          created_at?: string
          curated_by_user?: boolean
          dimension_scores?: Json | null
          duration_s?: number | null
          format?: string | null
          goal?: string
          id?: string
          language?: string
          neural_matrix_key?: string | null
          performance_tier?: string | null
          platform?: string[] | null
          quality_verified?: boolean
          reactions?: string[]
          region_timelines?: Json | null
          source_url?: string | null
          storage_key?: string | null
          subcategory?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          visual_events?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "reference_videos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sfx_library: {
        Row: {
          category: string | null
          created_at: string
          duration_s: number | null
          emotional_tags: string[] | null
          id: string
          license: string | null
          name: string
          storage_key: string
          tags: string[] | null
          user_id: string
          volume_lufs: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          duration_s?: number | null
          emotional_tags?: string[] | null
          id?: string
          license?: string | null
          name: string
          storage_key: string
          tags?: string[] | null
          user_id: string
          volume_lufs?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          duration_s?: number | null
          emotional_tags?: string[] | null
          id?: string
          license?: string | null
          name?: string
          storage_key?: string
          tags?: string[] | null
          user_id?: string
          volume_lufs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sfx_library_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      thumbnail_generations: {
        Row: {
          candidates: Json | null
          completed_at: string | null
          created_at: string
          draft_id: string | null
          error_details: Json | null
          generated_image_keys: string[] | null
          id: string
          opus_prompts: Json | null
          parent_generation_id: string | null
          platform: string | null
          quality: string
          refinement_instruction: string | null
          status: string
          title: string | null
          total_cost_eur: number | null
          tribev2_concept: Json | null
          user_id: string
        }
        Insert: {
          candidates?: Json | null
          completed_at?: string | null
          created_at?: string
          draft_id?: string | null
          error_details?: Json | null
          generated_image_keys?: string[] | null
          id?: string
          opus_prompts?: Json | null
          parent_generation_id?: string | null
          platform?: string | null
          quality?: string
          refinement_instruction?: string | null
          status?: string
          title?: string | null
          total_cost_eur?: number | null
          tribev2_concept?: Json | null
          user_id: string
        }
        Update: {
          candidates?: Json | null
          completed_at?: string | null
          created_at?: string
          draft_id?: string | null
          error_details?: Json | null
          generated_image_keys?: string[] | null
          id?: string
          opus_prompts?: Json | null
          parent_generation_id?: string | null
          platform?: string | null
          quality?: string
          refinement_instruction?: string | null
          status?: string
          title?: string | null
          total_cost_eur?: number | null
          tribev2_concept?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thumbnail_generations_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thumbnail_generations_parent_generation_id_fkey"
            columns: ["parent_generation_id"]
            isOneToOne: false
            referencedRelation: "thumbnail_generations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_user_spend: {
        Args: { amount_eur: number; user_id: string }
        Returns: undefined
      }
      is_first_user: { Args: never; Returns: boolean }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      user_owns_client: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
