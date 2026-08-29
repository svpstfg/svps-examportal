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

// Build a synthetic email from a mobile number so students can log in with it.
const DEFAULT_DOMAIN = "svps.com";
const sanitizeDomain = (d: unknown) => {
  const cleaned = String(d ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "");
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(cleaned) ? cleaned : DEFAULT_DOMAIN;
};
const mobileToEmail = (mobile: string, domain: string) =>
  `${String(mobile).replace(/\D/g, "")}@${domain}`;

// Accept common spreadsheet DOB formats and always create the same DDMMYYYY password.
// Day/month order is deliberate for Indian school records; ISO dates remain unambiguous.
const dobToPassword = (value: unknown): string | null => {
  const dob = String(value ?? "").trim();
  if (/^\d{8}$/.test(dob)) {
    const day = Number(dob.slice(0, 2));
    const month = Number(dob.slice(2, 4));
    const year = Number(dob.slice(4));
    return isValidDate(day, month, year) ? dob : null;
  }

  let match = dob.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (match) {
    const [, yearText, monthText, dayText] = match;
    const day = Number(dayText);
    const month = Number(monthText);
    const year = Number(yearText);
    return isValidDate(day, month, year) ? `${String(day).padStart(2, "0")}${String(month).padStart(2, "0")}${year}` : null;
  }

  match = dob.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (match) {
    const [, dayText, monthText, yearText] = match;
    const day = Number(dayText);
    const month = Number(monthText);
    const year = Number(yearText);
    return isValidDate(day, month, year) ? `${String(day).padStart(2, "0")}${String(month).padStart(2, "0")}${year}` : null;
  }
  return null;
};

const isValidDate = (day: number, month: number, year: number) => {
  if (year < 1900 || year > new Date().getFullYear() || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(year, month, 0).getDate();
};

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
      return json({ error: "Only teachers can bulk sign up students" }, 403);
    }

    const body = await req.json();
    const classId = body?.classId as string;
    const students = (body?.students ?? []) as Array<{
      name?: string;
      mobile?: string;
      dob?: string;
    }>;

    if (!classId) return json({ error: "classId is required" }, 400);
    if (!Array.isArray(students) || students.length === 0) {
      return json({ error: "No students provided" }, 400);
    }

    // Resolve the email domain: teacher's saved setting is authoritative,
    // falling back to any domain passed in the request, then the default.
    const { data: settingRow } = await admin
      .from("teacher_settings")
      .select("student_email_domain")
      .eq("teacher_id", user.id)
      .maybeSingle();
    const domain = sanitizeDomain(settingRow?.student_email_domain ?? body?.domain);

    const results: Array<{
      mobile: string;
      email: string;
      status: "created" | "skipped" | "failed";
      message?: string;
    }> = [];

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const s of students) {
      const mobile = String(s.mobile ?? "").replace(/\D/g, "");
      const name = String(s.name ?? "").trim();
      const password = dobToPassword(s.dob);
      const email = mobileToEmail(mobile, domain);

      if (!mobile || mobile.length < 6) {
        failed++;
        results.push({ mobile, email, status: "failed", message: "Invalid mobile number" });
        continue;
      }
      if (!password) {
        failed++;
        results.push({
          mobile,
          email,
          status: "failed",
          message: "Invalid DOB. Use DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, or DDMMYYYY",
        });
        continue;
      }

      try {
        const { data: createdUser, error: createErr } =
          await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              name: name || mobile,
              role: "student",
              class_id: classId,
              mobile,
            },
          });

        if (createErr) {
          const msg = String(createErr.message ?? createErr);
          if (/already been registered|already exists/i.test(msg)) {
            skipped++;
            results.push({ mobile, email, status: "skipped", message: "Already registered" });
          } else {
            failed++;
            results.push({ mobile, email, status: "failed", message: msg });
          }
          continue;
        }

        // Triggers on auth.users create profile, role, student & enrollment records.
        // Ensure enrollment exists as a safety net.
        if (createdUser?.user) {
          const { data: stu } = await admin
            .from("students")
            .select("id")
            .eq("email", email)
            .maybeSingle();
          if (stu) {
            const { data: existingEnroll } = await admin
              .from("student_enrollments")
              .select("id")
              .eq("student_id", stu.id)
              .eq("class_id", classId)
              .maybeSingle();
            if (!existingEnroll) {
              await admin
                .from("student_enrollments")
                .insert({ student_id: stu.id, class_id: classId });
            }
          }
        }

        created++;
        results.push({ mobile, email, status: "created" });
      } catch (err) {
        failed++;
        results.push({
          mobile,
          email,
          status: "failed",
          message: String((err as Error)?.message ?? err),
        });
      }
    }

    return json({ success: true, created, skipped, failed, domain, results });
  } catch (err) {
    console.error("bulk-signup-students error:", err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
