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
          {
            foreignKeyName: "attempt_incorrect_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_play"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_incorrect_answers_dictation: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          incorrect_word: string
          user_answer: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          incorrect_word: string
          user_answer: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          incorrect_word?: string
          user_answer?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_incorrect_answers_dictation_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "game_attempts"
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
          passage_id: string | null
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
          passage_id?: string | null
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
          passage_id?: string | null
          score?: number
          time_spent_seconds?: number
          total_questions?: number
          unit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_attempts_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "reading_passages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_attempts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard: {
        Row: {
          created_at: string
          last_study_date: string | null
          level: number
          study_streak: number
          test_type_id: string
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_study_date?: string | null
          level?: number
          study_streak?: number
          test_type_id: string
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_study_date?: string | null
          level?: number
          study_streak?: number
          test_type_id?: string
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_test_type_id_fkey"
            columns: ["test_type_id"]
            isOneToOne: false
            referencedRelation: "test_types"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_test_type_id: string | null
          id: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_test_type_id?: string | null
          id?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_test_type_id?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_test_type_id_fkey"
            columns: ["default_test_type_id"]
            isOneToOne: false
            referencedRelation: "test_types"
            referencedColumns: ["id"]
          },
        ]
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
          generated_by: string | null
          highlighted_words: string[] | null
          id: string
          is_generated: boolean
          title: string
          unit_id: string
        }
        Insert: {
          content: string
          created_at?: string
          generated_by?: string | null
          highlighted_words?: string[] | null
          id?: string
          is_generated?: boolean
          title: string
          unit_id: string
        }
        Update: {
          content?: string
          created_at?: string
          generated_by?: string | null
          highlighted_words?: string[] | null
          id?: string
          is_generated?: boolean
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
      test_types: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          created_at: string
          description: string | null
          id: string
          test_type_id: string | null
          title: string
          unit_number: number
          words: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          test_type_id?: string | null
          title: string
          unit_number: number
          words?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          test_type_id?: string | null
          title?: string
          unit_number?: number
          words?: Json
        }
        Relationships: [
          {
            foreignKeyName: "units_test_type_id_fkey"
            columns: ["test_type_id"]
            isOneToOne: false
            referencedRelation: "test_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          attempts: number
          best_score: number
          completed: boolean
          created_at: string
          game_type: string
          id: string
          total_time_seconds: number
          total_xp: number
          unit_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          best_score?: number
          completed?: boolean
          created_at?: string
          game_type: string
          id?: string
          total_time_seconds?: number
          total_xp?: number
          unit_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          best_score?: number
          completed?: boolean
          created_at?: string
          game_type?: string
          id?: string
          total_time_seconds?: number
          total_xp?: number
          unit_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vocabulary: {
        Row: {
          antonyms: string[] | null
          created_at: string
          definition: string
          examples: string[] | null
          id: string
          synonyms: string[] | null
          unit_id: string
          word: string
        }
        Insert: {
          antonyms?: string[] | null
          created_at?: string
          definition: string
          examples?: string[] | null
          id?: string
          synonyms?: string[] | null
          unit_id: string
          word: string
        }
        Update: {
          antonyms?: string[] | null
          created_at?: string
          definition?: string
          examples?: string[] | null
          id?: string
          synonyms?: string[] | null
          unit_id?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      questions_for_play: {
        Row: {
          created_at: string | null
          game_type: string | null
          id: string | null
          options: Json | null
          passage_id: string | null
          question_text: string | null
          unit_id: string | null
        }
        Insert: {
          created_at?: string | null
          game_type?: string | null
          id?: string | null
          options?: Json | null
          passage_id?: string | null
          question_text?: string | null
          unit_id?: string | null
        }
        Update: {
          created_at?: string | null
          game_type?: string | null
          id?: string | null
          options?: Json | null
          passage_id?: string | null
          question_text?: string | null
          unit_id?: string | null
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
    }
    Functions: {
      get_leaderboard: {
        Args: { limit_count?: number; p_test_type_id?: string }
        Returns: {
          id: string
          level: number
          study_streak: number
          total_xp: number
          username: string
        }[]
      }
      validate_dictation_game_submission: {
        Args: {
          p_answers: Json
          p_game_type: string
          p_time_spent_seconds: number
          p_unit_id: string
          p_user_id: string
        }
        Returns: Json
      }
      validate_game_submission: {
        Args: {
          p_answers: Json
          p_passage_id: string
          p_time_spent_seconds: number
          p_unit_id: string
          p_user_id: string
        }
        Returns: Json
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
