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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attempt_incorrect_answers: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          question_id: string
          user_answer: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          question_id: string
          user_answer: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          question_id?: string
          user_answer?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_incorrect_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "game_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_incorrect_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question_bank"
            referencedColumns: ["id"]
          },
        ]
      }
      game_attempts: {
        Row: {
          completed: boolean
          correct_answers: number
          created_at: string
          game_type: string
          id: string
          score: number
          time_spent_seconds: number
          total_questions: number
          unit_id: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          correct_answers?: number
          created_at?: string
          game_type: string
          id?: string
          score?: number
          time_spent_seconds?: number
          total_questions?: number
          unit_id: string
          user_id: string
        }
        Update: {
          completed?: boolean
          correct_answers?: number
          created_at?: string
          game_type?: string
          id?: string
          score?: number
          time_spent_seconds?: number
          total_questions?: number
          unit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_attempts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          last_study_date: string | null
          level: number
          study_streak: number
          total_xp: number
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          last_study_date?: string | null
          level?: number
          study_streak?: number
          total_xp?: number
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          last_study_date?: string | null
          level?: number
          study_streak?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      question_bank: {
        Row: {
          correct_answer: string
          created_at: string
          game_type: string
          id: string
          options: Json | null
          passage_id: string | null
          question_text: string
          unit_id: string
        }
        Insert: {
          correct_answer: string
          created_at?: string
          game_type: string
          id?: string
          options?: Json | null
          passage_id?: string | null
          question_text: string
          unit_id: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          game_type?: string
          id?: string
          options?: Json | null
          passage_id?: string | null
          question_text?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "reading_passages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_passages: {
        Row: {
          content: string
          created_at: string
          highlighted_words: string[] | null
          id: string
          title: string
          unit_id: string
        }
        Insert: {
          content: string
          created_at?: string
          highlighted_words?: string[] | null
          id?: string
          title: string
          unit_id: string
        }
        Update: {
          content?: string
          created_at?: string
          highlighted_words?: string[] | null
          id?: string
          title?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_passages_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          created_at: string
          description: string | null
          id: string
          title: string
          unit_number: number
          words: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          title: string
          unit_number: number
          words?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          unit_number?: number
          words?: Json
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          attempts: number
          created_at: string
          id: string
          listening_completed: boolean
          listening_score: number | null
          reading_completed: boolean
          reading_score: number | null
          speaking_completed: boolean
          speaking_score: number | null
          time_spent_minutes: number
          unit_id: string
          updated_at: string
          user_id: string
          writing_completed: boolean
          writing_score: number | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          listening_completed?: boolean
          listening_score?: number | null
          reading_completed?: boolean
          reading_score?: number | null
          speaking_completed?: boolean
          speaking_score?: number | null
          time_spent_minutes?: number
          unit_id: string
          updated_at?: string
          user_id: string
          writing_completed?: boolean
          writing_score?: number | null
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          listening_completed?: boolean
          listening_score?: number | null
          reading_completed?: boolean
          reading_score?: number | null
          speaking_completed?: boolean
          speaking_score?: number | null
          time_spent_minutes?: number
          unit_id?: string
          updated_at?: string
          user_id?: string
          writing_completed?: boolean
          writing_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
