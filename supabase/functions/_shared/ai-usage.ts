// Shared helper: record every Lovable AI Gateway call into public.ai_usage_logs
// so teachers can see per-teacher / per-student AI usage.

// deno-lint-ignore no-explicit-any
type Admin = any;

export interface AiUsageEntry {
  userId?: string | null;
  userRole?: string;
  teacherId?: string | null;
  studentId?: string | null;
  classId?: string | null;
  feature: string;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  status?: "success" | "error";
  errorMessage?: string | null;
  // deno-lint-ignore no-explicit-any
  metadata?: Record<string, any>;
}

export async function logAiUsage(admin: Admin, entry: AiUsageEntry) {
  try {
    const u = entry.usage ?? {};
    const prompt = Number(u.prompt_tokens ?? 0) || 0;
    const completion = Number(u.completion_tokens ?? 0) || 0;
    const total = Number(u.total_tokens ?? 0) || prompt + completion;

    await admin.from("ai_usage_logs").insert({
      user_id: entry.userId ?? null,
      user_role: entry.userRole ?? "teacher",
      teacher_id: entry.teacherId ?? null,
      student_id: entry.studentId ?? null,
      class_id: entry.classId ?? null,
      feature: entry.feature,
      model: entry.model ?? null,
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: total,
      status: entry.status ?? "success",
      error_message: entry.errorMessage ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch (e) {
    console.error("logAiUsage failed", e);
  }
}

/** Resolve the owning teacher (and class) for a student row. */
export async function resolveTeacherForStudent(admin: Admin, studentId?: string | null) {
  if (!studentId) return { teacherId: null, classId: null };
  try {
    const { data } = await admin
      .from("students")
      .select("class_id, classes:class_id (teacher_id)")
      .eq("id", studentId)
      .maybeSingle();
    return {
      teacherId: data?.classes?.teacher_id ?? null,
      classId: data?.class_id ?? null,
    };
  } catch {
    return { teacherId: null, classId: null };
  }
}
