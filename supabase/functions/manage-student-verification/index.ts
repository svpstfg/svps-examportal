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

    // Verify caller identity using their JWT
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
      return json({ error: "Only teachers can manage verification" }, 403);
    }

    const body = await req.json();
    const action = body?.action as string;

    // Helper: list every auth user (paginated) and build email -> {id, confirmed}
    const buildAuthMap = async () => {
      const map = new Map<string, { id: string; confirmed: boolean }>();
      let page = 1;
      // deno-lint-ignore no-constant-condition
      while (true) {
        const { data, error } = await admin.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        if (error) throw error;
        for (const u of data.users) {
          if (u.email) {
            map.set(u.email.toLowerCase(), {
              id: u.id,
              confirmed: !!u.email_confirmed_at,
            });
          }
        }
        if (data.users.length < 1000) break;
        page += 1;
      }
      return map;
    };

    if (action === "list-pending") {
      const classIds: string[] = body?.classIds ?? [];
      if (!Array.isArray(classIds) || classIds.length === 0) {
        return json({ pending: [] });
      }

      // Get enrollments for these classes
      const { data: enrollments, error: enrollErr } = await admin
        .from("student_enrollments")
        .select("id, student_id, class_id, enrolled_at")
        .in("class_id", classIds);
      if (enrollErr) throw enrollErr;

      const studentIds = [
        ...new Set((enrollments ?? []).map((e) => e.student_id)),
      ];
      if (studentIds.length === 0) return json({ pending: [] });

      const { data: studentsData, error: studErr } = await admin
        .from("students")
        .select("id, name, email")
        .in("id", studentIds);
      if (studErr) throw studErr;

      const authMap = await buildAuthMap();

      const pending = (enrollments ?? [])
        .map((e) => {
          const stu = studentsData?.find((s) => s.id === e.student_id);
          if (!stu?.email) return null;
          const authInfo = authMap.get(stu.email.toLowerCase());
          // Pending = has an account but email not confirmed
          if (authInfo && !authInfo.confirmed) {
            return {
              enrollmentId: e.id,
              studentId: stu.id,
              name: stu.name,
              email: stu.email,
              classId: e.class_id,
              enrolledAt: e.enrolled_at,
              status: "unconfirmed",
            };
          }
          // No account yet (manually added, never signed up)
          if (!authInfo) {
            return {
              enrollmentId: e.id,
              studentId: stu.id,
              name: stu.name,
              email: stu.email,
              classId: e.class_id,
              enrolledAt: e.enrolled_at,
              status: "no-account",
            };
          }
          return null;
        })
        .filter(Boolean);

      return json({ pending });
    }

    if (action === "verify") {
      const email = (body?.email as string)?.toLowerCase();
      if (!email) return json({ error: "Email is required" }, 400);

      const authMap = await buildAuthMap();
      const authInfo = authMap.get(email);
      if (!authInfo) {
        return json(
          {
            error:
              "This student hasn't created an account yet. They must sign up first.",
          },
          400,
        );
      }

      const { error: updateErr } = await admin.auth.admin.updateUserById(
        authInfo.id,
        { email_confirm: true },
      );
      if (updateErr) throw updateErr;

      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("manage-student-verification error:", err);
    return json({ error: String(err?.message ?? err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
