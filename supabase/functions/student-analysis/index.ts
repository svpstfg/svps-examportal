import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface QItem {
  index: number;
  question: string;
  correct: boolean;
  answered: boolean;
  timeSec: number;
}

interface Payload {
  studentName: string;
  testTitle: string;
  subject?: string;
  className?: string;
  scorePct: number;
  fullMarks: number;
  marksObtained: number;
  totalTimeSec: number;
  questions: QItem[];
  /** Used to cache the report so it is only generated once */
  testId?: string;
  studentId?: string;
  /** Set true to force a fresh report (overwrites the cached one) */
  force?: boolean;
}


function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const fmt = (s: number) => {
  if (!s || s < 0) return "0s";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m ? `${m}m ${sec}s` : `${sec}s`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const p = (await req.json()) as Payload;
    if (!p?.studentName || !Array.isArray(p.questions)) {
      return json({ error: "Invalid payload" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const canCache = !!(p.testId && p.studentId);

    if (canCache && !p.force) {
      const { data: cached } = await admin
        .from("student_analyses")
        .select("report")
        .eq("test_id", p.testId)
        .eq("student_id", p.studentId)
        .maybeSingle();
      if (cached?.report) {
        return json({ report: cached.report, cached: true });
      }
    }


    const lines = p.questions
      .map(
        (q) =>
          `Q${q.index + 1}: ${
            q.answered ? (q.correct ? "Correct" : "Wrong") : "Not answered"
          }, time ${fmt(q.timeSec)} — ${(q.question || "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 120)}`,
      )
      .join("\n");

    const avgTime = p.questions.length
      ? Math.round(
          p.questions.reduce((s, q) => s + (q.timeSec || 0), 0) /
            p.questions.length,
        )
      : 0;

    const prompt = `You are an experienced teacher's assistant analysing one student's test performance. Be concise, specific and constructive. Use the exact data provided; do not invent facts.

Student: ${p.studentName}
Test: ${p.testTitle}${p.subject ? ` | Subject: ${p.subject}` : ""}${p.className ? ` | Class: ${p.className}` : ""}
Score: ${p.scorePct}% (${p.marksObtained}/${p.fullMarks})
Total time: ${fmt(p.totalTimeSec)} | Average per question: ${fmt(avgTime)}

Per-question breakdown:
${lines}

Write a short report for the teacher with these sections using markdown headings:
## Summary
1-2 sentences on overall performance.
## Strengths
Bullet points on what the student did well (fast + correct, consistent, etc).
## Areas to Improve
Bullet points on weak spots. Call out questions that were wrong, and questions where the student spent unusually long (possible confusion) or answered very fast then got it wrong (possible guessing/carelessness).
## Recommended Actions
2-4 concrete, actionable next steps the teacher can take for this student.
Keep the whole report under 220 words.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (aiRes.status === 429) {
      return json({ error: "Rate limit reached. Please try again shortly." }, 429);
    }
    if (aiRes.status === 402) {
      return json(
        { error: "AI credits exhausted. Please add credits to continue." },
        402,
      );
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      return json({ error: "AI analysis failed" }, 500);
    }

    const data = await aiRes.json();
    const report = data?.choices?.[0]?.message?.content ?? "";

    if (canCache && report) {
      const { error: saveError } = await admin
        .from("student_analyses")
        .upsert(
          {
            test_id: p.testId,
            student_id: p.studentId,
            report,
            score: p.scorePct,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "test_id,student_id" },
        );
      if (saveError) console.error("Failed to cache report", saveError);
    }

    return json({ report, cached: false });

  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message || "Unexpected error" }, 500);
  }
});
