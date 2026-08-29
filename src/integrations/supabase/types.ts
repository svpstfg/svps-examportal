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
      ai_usage_logs: {
        Row: {
          class_id: string | null
          completion_tokens: number
          created_at: string
          error_message: string | null
          feature: string
          id: string
          metadata: Json
          model: string | null
          prompt_tokens: number
          status: string
          student_id: string | null
          teacher_id: string | null
          total_tokens: number
          user_id: string | null
          user_role: string
        }
        Insert: {
          class_id?: string | null
          completion_tokens?: number
          created_at?: string
          error_message?: string | null
          feature: string
          id?: string
          metadata?: Json
          model?: string | null
          prompt_tokens?: number
          status?: string
          student_id?: string | null
          teacher_id?: string | null
          total_tokens?: number
          user_id?: string | null
          user_role?: string
        }
        Update: {
          class_id?: string | null
          completion_tokens?: number
          created_at?: string
          error_message?: string | null
          feature?: string
          id?: string
          metadata?: Json
          model?: string | null
          prompt_tokens?: number
          status?: string
          student_id?: string | null
          teacher_id?: string | null
          total_tokens?: number
          user_id?: string | null
          user_role?: string
        }
        Relationships: []
      }
      chapters: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          is_pro: boolean
          name: string
          test_count: number | null
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_pro?: boolean
          name: string
          test_count?: number | null
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_pro?: boolean
          name?: string
          test_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          invite_code: string
          name: string
          student_count: number | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          name: string
          student_count?: number | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          name?: string
          student_count?: number | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          chapter_count: number | null
          class_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          chapter_count?: number | null
          class_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          chapter_count?: number | null
          class_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      doubt_messages: {
        Row: {
          created_at: string
          doubt_id: string
          id: string
          image_url: string | null
          message: string | null
          sender_id: string
          sender_role: string
        }
        Insert: {
          created_at?: string
          doubt_id: string
          id?: string
          image_url?: string | null
          message?: string | null
          sender_id: string
          sender_role: string
        }
        Update: {
          created_at?: string
          doubt_id?: string
          id?: string
          image_url?: string | null
          message?: string | null
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "doubt_messages_doubt_id_fkey"
            columns: ["doubt_id"]
            isOneToOne: false
            referencedRelation: "doubts"
            referencedColumns: ["id"]
          },
        ]
      }
      doubts: {
        Row: {
          class_id: string
          created_at: string
          id: string
          status: string
          student_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          status?: string
          student_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          status?: string
          student_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doubts_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doubts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_type: string | null
          class_id: string
          content: string | null
          created_at: string
          id: string
          link: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          class_id: string
          content?: string | null
          created_at?: string
          id?: string
          link?: string | null
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          class_id?: string
          content?: string | null
          created_at?: string
          id?: string
          link?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      question_bank: {
        Row: {
          chapter_id: string | null
          class_id: string | null
          course_id: string | null
          created_at: string
          id: string
          question: Json
          tags: string[]
          teacher_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          chapter_id?: string | null
          class_id?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          question: Json
          tags?: string[]
          teacher_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          chapter_id?: string | null
          class_id?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          question?: Json
          tags?: string[]
          teacher_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      question_papers: {
        Row: {
          class_id: string
          created_at: string
          file_name: string
          file_path: string
          id: string
          title: string
          uploaded_by: string
        }
        Insert: {
          class_id: string
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          title: string
          uploaded_by: string
        }
        Update: {
          class_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          title?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_papers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      reexam_requests: {
        Row: {
          class_id: string
          created_at: string
          id: string
          message: string | null
          responded_at: string | null
          status: string
          student_id: string
          teacher_id: string
          test_id: string
          updated_at: string
          used_at: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          student_id: string
          teacher_id: string
          test_id: string
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          student_id?: string
          teacher_id?: string
          test_id?: string
          updated_at?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reexam_requests_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reexam_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reexam_requests_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      slides: {
        Row: {
          chapter_id: string | null
          content: string
          created_at: string
          id: string
          serial_number: number
          title: string | null
          updated_at: string
        }
        Insert: {
          chapter_id?: string | null
          content: string
          created_at?: string
          id?: string
          serial_number?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          chapter_id?: string | null
          content?: string
          created_at?: string
          id?: string
          serial_number?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slides_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      student_analyses: {
        Row: {
          created_at: string
          id: string
          report: string
          score: number | null
          student_id: string
          test_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          report: string
          score?: number | null
          student_id: string
          test_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          report?: string
          score?: number | null
          student_id?: string
          test_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_analyses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_analyses_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      student_enrollments: {
        Row: {
          class_id: string
          created_at: string
          enrolled_at: string
          id: string
          student_id: string
          subscription_expires_at: string | null
          tier: string
        }
        Insert: {
          class_id: string
          created_at?: string
          enrolled_at?: string
          id?: string
          student_id: string
          subscription_expires_at?: string | null
          tier?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          enrolled_at?: string
          id?: string
          student_id?: string
          subscription_expires_at?: string | null
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          class_id: string
          created_at: string
          email: string
          enrolled_at: string
          id: string
          is_locked: boolean
          name: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          email: string
          enrolled_at?: string
          id?: string
          is_locked?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          email?: string
          enrolled_at?: string
          id?: string
          is_locked?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_settings: {
        Row: {
          created_at: string
          id: string
          student_ai_reports_enabled: boolean
          student_completed_tests_enabled: boolean
          student_email_domain: string
          student_new_tests_enabled: boolean
          student_pro_tests_enabled: boolean
          student_scheduled_tests_enabled: boolean
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          student_ai_reports_enabled?: boolean
          student_completed_tests_enabled?: boolean
          student_email_domain?: string
          student_new_tests_enabled?: boolean
          student_pro_tests_enabled?: boolean
          student_scheduled_tests_enabled?: boolean
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          student_ai_reports_enabled?: boolean
          student_completed_tests_enabled?: boolean
          student_email_domain?: string
          student_new_tests_enabled?: boolean
          student_pro_tests_enabled?: boolean
          student_scheduled_tests_enabled?: boolean
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      test_attempts: {
        Row: {
          answers: number[]
          completed_at: string
          created_at: string
          id: string
          question_times: number[]
          score: number
          status: string
          student_id: string
          test_id: string
          time_spent: number
        }
        Insert: {
          answers: number[]
          completed_at?: string
          created_at?: string
          id?: string
          question_times?: number[]
          score: number
          status?: string
          student_id: string
          test_id: string
          time_spent: number
        }
        Update: {
          answers?: number[]
          completed_at?: string
          created_at?: string
          id?: string
          question_times?: number[]
          score?: number
          status?: string
          student_id?: string
          test_id?: string
          time_spent?: number
        }
        Relationships: [
          {
            foreignKeyName: "test_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          chapter_id: string
          close_after_schedule: boolean
          created_at: string
          duration: number
          id: string
          is_locked: boolean
          is_pro: boolean
          is_scheduled: boolean | null
          negative_marking: number
          questions: Json
          results_published: boolean
          scheduled_date: string | null
          scheduled_time: string | null
          single_attempt: boolean
          title: string
          updated_at: string
        }
        Insert: {
          chapter_id: string
          close_after_schedule?: boolean
          created_at?: string
          duration: number
          id?: string
          is_locked?: boolean
          is_pro?: boolean
          is_scheduled?: boolean | null
          negative_marking?: number
          questions?: Json
          results_published?: boolean
          scheduled_date?: string | null
          scheduled_time?: string | null
          single_attempt?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          chapter_id?: string
          close_after_schedule?: boolean
          created_at?: string
          duration?: number
          id?: string
          is_locked?: boolean
          is_pro?: boolean
          is_scheduled?: boolean | null
          negative_marking?: number
          questions?: Json
          results_published?: boolean
          scheduled_date?: string | null
          scheduled_time?: string | null
          single_attempt?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tests_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      upgrade_requests: {
        Row: {
          approved_duration_days: number | null
          class_id: string
          created_at: string
          id: string
          message: string | null
          responded_at: string | null
          status: string
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          approved_duration_days?: number | null
          class_id: string
          created_at?: string
          id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          approved_duration_days?: number | null
          class_id?: string
          created_at?: string
          id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          student_id?: string
          teacher_id?: string
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
      visitor_counts: {
        Row: {
          count: number
          id: string
          page: string
          updated_at: string
        }
        Insert: {
          count?: number
          id?: string
          page: string
          updated_at?: string
        }
        Update: {
          count?: number
          id?: string
          page?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_upgrade_request: {
        Args: { _duration_days?: number; _request_id: string }
        Returns: undefined
      }
      consume_reexam_grant: {
        Args: { _student_id: string; _test_id: string }
        Returns: boolean
      }
      find_class_by_invite_code: {
        Args: { _invite_code: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_visitor_count: { Args: { _page: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_visitor_count: { Args: { _page: string }; Returns: number }
      is_student_in_class: {
        Args: { _class_id: string; _email: string }
        Returns: boolean
      }
      list_public_classes: {
        Args: never
        Returns: {
          description: string
          id: string
          name: string
        }[]
      }
      reject_upgrade_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "teacher" | "student"
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
      app_role: ["teacher", "student"],
    },
  },
} as const
