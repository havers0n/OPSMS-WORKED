export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      cells: {
        Row: {
          address: string
          address_sort_key: string
          cell_code: string
          created_at: string
          id: string
          layout_version_id: string
          rack_face_id: string
          rack_id: string
          rack_level_id: string
          rack_section_id: string
          slot_no: number
          status: string
          updated_at: string
          x: number | null
          y: number | null
        }
        Insert: {
          address: string
          address_sort_key: string
          cell_code: string
          created_at?: string
          id?: string
          layout_version_id: string
          rack_face_id: string
          rack_id: string
          rack_level_id: string
          rack_section_id: string
          slot_no: number
          status?: string
          updated_at?: string
          x?: number | null
          y?: number | null
        }
        Update: {
          address?: string
          address_sort_key?: string
          cell_code?: string
          created_at?: string
          id?: string
          layout_version_id?: string
          rack_face_id?: string
          rack_id?: string
          rack_level_id?: string
          rack_section_id?: string
          slot_no?: number
          status?: string
          updated_at?: string
          x?: number | null
          y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cells_layout_version_id_fkey"
            columns: ["layout_version_id"]
            isOneToOne: false
            referencedRelation: "layout_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cells_rack_face_id_fkey"
            columns: ["rack_face_id"]
            isOneToOne: false
            referencedRelation: "rack_faces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cells_rack_id_fkey"
            columns: ["rack_id"]
            isOneToOne: false
            referencedRelation: "racks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cells_rack_level_id_fkey"
            columns: ["rack_level_id"]
            isOneToOne: false
            referencedRelation: "rack_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cells_rack_section_id_fkey"
            columns: ["rack_section_id"]
            isOneToOne: false
            referencedRelation: "rack_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      floors: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          site_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          site_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          site_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "floors_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      layout_versions: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          floor_id: string
          id: string
          parent_published_version_id: string | null
          published_at: string | null
          published_by: string | null
          state: string
          updated_at: string
          version_no: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          floor_id: string
          id?: string
          parent_published_version_id?: string | null
          published_at?: string | null
          published_by?: string | null
          state: string
          updated_at?: string
          version_no: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          floor_id?: string
          id?: string
          parent_published_version_id?: string | null
          published_at?: string | null
          published_by?: string | null
          state?: string
          updated_at?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "layout_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layout_versions_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layout_versions_parent_published_version_id_fkey"
            columns: ["parent_published_version_id"]
            isOneToOne: false
            referencedRelation: "layout_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layout_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_events: {
        Row: {
          actor_profile_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          floor_id: string | null
          id: string
          layout_version_id: string | null
          metadata: Json
          site_id: string | null
          status: string
        }
        Insert: {
          actor_profile_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          event_type: string
          floor_id?: string | null
          id?: string
          layout_version_id?: string | null
          metadata?: Json
          site_id?: string | null
          status: string
        }
        Update: {
          actor_profile_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          floor_id?: string | null
          id?: string
          layout_version_id?: string | null
          metadata?: Json
          site_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_events_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_events_layout_version_id_fkey"
            columns: ["layout_version_id"]
            isOneToOne: false
            referencedRelation: "layout_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_events_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      rack_faces: {
        Row: {
          anchor: string
          created_at: string
          enabled: boolean
          id: string
          is_mirrored: boolean
          mirror_source_face_id: string | null
          rack_id: string
          side: string
          slot_numbering_direction: string
          updated_at: string
        }
        Insert: {
          anchor: string
          created_at?: string
          enabled?: boolean
          id?: string
          is_mirrored?: boolean
          mirror_source_face_id?: string | null
          rack_id: string
          side: string
          slot_numbering_direction: string
          updated_at?: string
        }
        Update: {
          anchor?: string
          created_at?: string
          enabled?: boolean
          id?: string
          is_mirrored?: boolean
          mirror_source_face_id?: string | null
          rack_id?: string
          side?: string
          slot_numbering_direction?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rack_faces_mirror_source_face_id_fkey"
            columns: ["mirror_source_face_id"]
            isOneToOne: false
            referencedRelation: "rack_faces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rack_faces_rack_id_fkey"
            columns: ["rack_id"]
            isOneToOne: false
            referencedRelation: "racks"
            referencedColumns: ["id"]
          },
        ]
      }
      rack_levels: {
        Row: {
          created_at: string
          id: string
          ordinal: number
          rack_section_id: string
          slot_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ordinal: number
          rack_section_id: string
          slot_count: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ordinal?: number
          rack_section_id?: string
          slot_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rack_levels_rack_section_id_fkey"
            columns: ["rack_section_id"]
            isOneToOne: false
            referencedRelation: "rack_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      rack_sections: {
        Row: {
          created_at: string
          id: string
          length: number
          ordinal: number
          rack_face_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          length: number
          ordinal: number
          rack_face_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          length?: number
          ordinal?: number
          rack_face_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rack_sections_rack_face_id_fkey"
            columns: ["rack_face_id"]
            isOneToOne: false
            referencedRelation: "rack_faces"
            referencedColumns: ["id"]
          },
        ]
      }
      racks: {
        Row: {
          axis: string
          created_at: string
          depth: number
          display_code: string
          id: string
          kind: string
          layout_version_id: string
          rotation_deg: number
          state: string
          total_length: number
          updated_at: string
          x: number
          y: number
        }
        Insert: {
          axis: string
          created_at?: string
          depth: number
          display_code: string
          id?: string
          kind: string
          layout_version_id: string
          rotation_deg: number
          state?: string
          total_length: number
          updated_at?: string
          x: number
          y: number
        }
        Update: {
          axis?: string
          created_at?: string
          depth?: number
          display_code?: string
          id?: string
          kind?: string
          layout_version_id?: string
          rotation_deg?: number
          state?: string
          total_length?: number
          updated_at?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "racks_layout_version_id_fkey"
            columns: ["layout_version_id"]
            isOneToOne: false
            referencedRelation: "layout_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      build_cell_address: {
        Args: {
          face_side: string
          level_ordinal: number
          rack_display_code: string
          section_ordinal: number
          slot_no: number
        }
        Returns: string
      }
      build_cell_code: {
        Args: {
          face_side: string
          level_ordinal: number
          rack_uuid: string
          section_ordinal: number
          slot_no: number
        }
        Returns: string
      }
      create_layout_draft: {
        Args: { actor_uuid?: string; floor_uuid: string }
        Returns: string
      }
      layout_version_cell_counts: {
        Args: { layout_version_uuid: string }
        Returns: {
          cell_count: number
          rack_count: number
        }[]
      }
      pad_2: { Args: { input_value: string }; Returns: string }
      pad_4: { Args: { input_value: string }; Returns: string }
      publish_layout_version: {
        Args: { actor_uuid?: string; layout_version_uuid: string }
        Returns: Json
      }
      regenerate_layout_cells: {
        Args: { layout_version_uuid: string }
        Returns: number
      }
      save_layout_draft: {
        Args: { actor_uuid?: string; layout_payload: Json }
        Returns: string
      }
      validate_layout_payload: {
        Args: { layout_payload: Json }
        Returns: undefined
      }
      validate_layout_version: {
        Args: { layout_version_uuid: string }
        Returns: Json
      }
      write_layout_event: {
        Args: {
          p_actor_profile_id?: string
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_layout_version_id: string
          p_metadata?: Json
          p_status: string
        }
        Returns: undefined
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

