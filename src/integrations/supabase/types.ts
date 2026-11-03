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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      attendance_records: {
        Row: {
          attendance_date: string
          created_at: string
          id: string
          marked_at: string
          member_id: string | null
          member_name: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attendance_date?: string
          created_at?: string
          id?: string
          marked_at?: string
          member_id?: string | null
          member_name: string
          phone?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          created_at?: string
          id?: string
          marked_at?: string
          member_id?: string | null
          member_name?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      check_in_logs: {
        Row: {
          action_type: string
          child_id: string
          created_at: string
          id: string
        }
        Insert: {
          action_type: string
          child_id: string
          created_at?: string
          id?: string
        }
        Update: {
          action_type?: string
          child_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_in_logs_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          child_name: string
          created_at: string
          id: string
          last_action_at: string | null
          parent_name: string
          parent_phone: string
          status: string
        }
        Insert: {
          child_name: string
          created_at?: string
          id?: string
          last_action_at?: string | null
          parent_name: string
          parent_phone: string
          status?: string
        }
        Update: {
          child_name?: string
          created_at?: string
          id?: string
          last_action_at?: string | null
          parent_name?: string
          parent_phone?: string
          status?: string
        }
        Relationships: []
      }
      family_relationships: {
        Row: {
          created_at: string
          id: string
          member_a: string
          member_b: string
          role_a: string
          role_b: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          member_a: string
          member_b: string
          role_a: string
          role_b: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          member_a?: string
          member_b?: string
          role_a?: string
          role_b?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "family_relationships_member_a_fkey"
            columns: ["member_a"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_relationships_member_b_fkey"
            columns: ["member_b"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      gifts: {
        Row: {
          amount_cents: number
          confirmed_via: string | null
          created_at: string
          currency: string
          device_token: string | null
          donor_email: string
          donor_name: string | null
          gift_type: string
          id: string
          paid_at: string | null
          prayer_request: string | null
          reference: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          confirmed_via?: string | null
          created_at?: string
          currency?: string
          device_token?: string | null
          donor_email: string
          donor_name?: string | null
          gift_type: string
          id?: string
          paid_at?: string | null
          prayer_request?: string | null
          reference: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          confirmed_via?: string | null
          created_at?: string
          currency?: string
          device_token?: string | null
          donor_email?: string
          donor_name?: string | null
          gift_type?: string
          id?: string
          paid_at?: string | null
          prayer_request?: string | null
          reference?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          created_at: string
          id: string
          last_marked_at: string | null
          member_name: string
          phone: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_marked_at?: string | null
          member_name: string
          phone?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_marked_at?: string | null
          member_name?: string
          phone?: string | null
          status?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirm_gift: {
        Args: {
          p_amount_cents: number
          p_currency: string
          p_reference: string
          p_via: string
        }
        Returns: string
      }
      fail_gift: {
        Args: { p_reference: string; p_via: string }
        Returns: string
      }
      has_family_access: { Args: never; Returns: boolean }
      has_giving_access: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "staff"
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
      app_role: ["owner", "staff"],
    },
  },
} as const
