import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Ensure caller is a teacher
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "teacher")
      .maybeSingle();

    if (!roleRow) {
      return json({ error: "Only teachers can manage users" }, 403);
    }

    const body = await req.json();
    const action = body?.action as string;
    const email = (body?.email as string)?.toLowerCase()?.trim();

    if (!action) return json({ error: "action is required" }, 400);

    // Build a full auth map (paginated): email -> { id, confirmed, banned }
    const buildAuthMap = async () => {
      const map = new Map<
        string,
        { id: string; confirmed: boolean; banned: boolean }
      >();
      let page = 1;
      // deno-lint-ignore no-constant-condition
      while (true) {
        const { data, error } = await admin.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        if (error) throw error;
        for (const u of data.users) {
          if (!u.email) continue;
          const bannedUntil = (u as { banned_until?: string }).banned_until;
          const banned = !!bannedUntil && new Date(bannedUntil) > new Date();
          map.set(u.email.toLowerCase(), {
            id: u.id,
            confirmed: !!u.email_confirmed_at,
            banned,
          });
        }
        if (data.users.length < 1000) break;
        page += 1;
      }
      return map;
    };

    // List all students in the teacher's classes with account state
    if (action === "list") {
      const classIds: string[] = body?.classIds ?? [];
      if (!Array.isArray(classIds) || classIds.length === 0) {
        return json({ users: [] });
      }
      const { data: enrollments } = await admin
        .from("student_enrollments")
        .select("student_id, class_id")
        .in("class_id", classIds);
      const studentIds = [
        ...new Set((enrollments ?? []).map((e) => e.student_id)),
      ];
      if (studentIds.length === 0) return json({ users: [] });

      const { data: studentsData } = await admin
        .from("students")
        .select("id, name, email")
        .in("id", studentIds);

      const authMap = await buildAuthMap();
      const users = (studentsData ?? []).map((s) => {
        const info = s.email ? authMap.get(s.email.toLowerCase()) : undefined;
        const classIdsForStudent = (enrollments ?? [])
          .filter((e) => e.student_id === s.id)
          .map((e) => e.class_id);
        return {
          id: s.id,
          name: s.name,
          email: s.email,
          classIds: classIdsForStudent,
          hasAccount: !!info,
          confirmed: info?.confirmed ?? false,
          blocked: info?.banned ?? false,
        };
      });
      return json({ users });
    }

    if (!email) return json({ error: "email is required" }, 400);


    // Look up the auth user id for the given email (paginated)
    const findUserByEmail = async (target: string) => {
      let page = 1;
      // deno-lint-ignore no-constant-condition
      while (true) {
        const { data, error } = await admin.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        if (error) throw error;
        const match = data.users.find(
          (u) => u.email?.toLowerCase() === target,
        );
        if (match) return match;
        if (data.users.length < 1000) break;
        page += 1;
      }
      return null;
    };

    const authUser = await findUserByEmail(email);

    // Safety: never let a teacher act on another teacher / their own account
    if (authUser) {
      const { data: targetRole } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", authUser.id)
        .eq("role", "teacher")
        .maybeSingle();
      if (targetRole) {
        return json({ error: "Cannot manage a teacher account" }, 403);
      }
    }

    if (action === "delete") {
      // A single login can have multiple student rows (one per original class).
      // Delete all of them, rather than maybeSingle() which silently returns no
      // row once the student has more than one class assignment.
      const { data: studentRows, error: studentsError } = await admin
        .from("students")
        .select("id")
        .eq("email", email)
        .throwOnError();
      if (studentsError) throw studentsError;
      const studentIds = (studentRows ?? []).map((student) => student.id);

      if (!studentIds.length) {
        return json({ error: "Student record was not found." }, 404);
      }

      // The caller may only delete a student who belongs to one of their classes.
      const { data: managedEnrollment, error: enrollmentCheckError } = await admin
        .from("student_enrollments")
        .select("id, classes!inner(teacher_id)")
        .in("student_id", studentIds)
        .eq("classes.teacher_id", user.id)
        .limit(1);
      if (enrollmentCheckError) throw enrollmentCheckError;
      if (!managedEnrollment?.length) {
        return json({ error: "You can only delete students assigned to your classes." }, 403);
      }

      // upgrade_requests has no foreign key to students in older databases.
      const { error: upgradeError } = await admin
        .from("upgrade_requests")
        .delete()
        .in("student_id", studentIds);
      if (upgradeError) throw upgradeError;

      const { error: enrollmentsError } = await admin
        .from("student_enrollments")
        .delete()
        .in("student_id", studentIds);
      if (enrollmentsError) throw enrollmentsError;

      const { error: deleteStudentsError } = await admin
        .from("students")
        .delete()
        .in("id", studentIds);
      if (deleteStudentsError) throw deleteStudentsError;

      // Remove the login last. This prevents a partially deleted account if a
      // database constraint fails during student cleanup.
      if (authUser) {
        const { error: deleteAuthError } = await admin.auth.admin.deleteUser(authUser.id);
        if (deleteAuthError) throw deleteAuthError;
      }
      return json({ success: true });
    }

    if (action === "block") {
      if (!authUser) {
        return json(
          { error: "This student has no account yet, nothing to block." },
          400,
        );
      }
      const { error: banErr } = await admin.auth.admin.updateUserById(
        authUser.id,
        { ban_duration: "876000h" }, // ~100 years
      );
      if (banErr) throw banErr;
      return json({ success: true });
    }

    if (action === "unblock") {
      if (!authUser) {
        return json(
          { error: "This student has no account yet, nothing to unblock." },
          400,
        );
      }
      const { error: unbanErr } = await admin.auth.admin.updateUserById(
        authUser.id,
        { ban_duration: "none" },
      );
      if (unbanErr) throw unbanErr;
      return json({ success: true });
    }

    if (action === "change-password") {
      const password = String(body?.password ?? "");
      if (password.length < 6) {
        return json(
          { error: "Password must be at least 6 characters" },
          400,
        );
      }
      if (!authUser) {
        return json(
          { error: "This student has no account yet." },
          400,
        );
      }
      const { error: pwErr } = await admin.auth.admin.updateUserById(
        authUser.id,
        { password },
      );
      if (pwErr) throw pwErr;
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("manage-users error:", err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
