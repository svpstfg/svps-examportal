import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { logAiUsage } from '../_shared/ai-usage.ts';

interface ImagePayload {
  // data URL (data:image/png;base64,....) or raw https URL
  url: string;
}

const SYSTEM_PROMPT = `You are an expert exam question setter. You will be given one or more images that may contain:
- printed or handwritten multiple-choice questions
- passages, diagrams, tables, or study material

Your job: produce high-quality multiple-choice questions (MCQs) in STRICT JSON.

Rules:
1. If the image already contains MCQs, faithfully extract each question, all its options, and the correct answer. Preserve mathematical/scientific notation using unicode where reasonable.
2. If the image contains study material WITHOUT ready MCQs, CREATE the best possible exam-quality MCQs from that material.
3. Every question MUST have EXACTLY 4 options.
4. "correctAnswer" MUST be the 0-based index (0,1,2,3) of the correct option.
5. Always include a short "explanation" for why the answer is correct.
6. Do NOT invent facts that are not supported by the image content.
7. Return ONLY valid JSON, no markdown fences, no commentary.

Output shape:
{
  "questions": [
    {
      "question": "string",
      "options": ["opt1", "opt2", "opt3", "opt4"],
      "correctAnswer": 0,
      "explanation": "string"
    }
  ]
}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => null);
    const images: ImagePayload[] = Array.isArray(body?.images) ? body.images : [];
    const count: number = Number(body?.count) > 0 ? Math.min(Number(body.count), 30) : 0;
    const difficulty: string = typeof body?.difficulty === 'string' ? body.difficulty : 'medium';
    const extraInstructions: string = typeof body?.instructions === 'string' ? body.instructions.slice(0, 1000) : '';

    if (!images.length) {
      return new Response(JSON.stringify({ error: 'No images provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (images.length > 10) {
      return new Response(JSON.stringify({ error: 'Maximum 10 images per request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userText = [
      count
        ? `Generate exactly ${count} MCQ(s) from the following image(s).`
        : `Extract all MCQs from the following image(s). If none exist, create the best exam-quality MCQs from the material.`,
      `Target difficulty: ${difficulty}.`,
      extraInstructions ? `Additional instructions: ${extraInstructions}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const content: any[] = [{ type: 'text', text: userText }];
    for (const img of images) {
      if (img?.url && typeof img.url === 'string') {
        content.push({ type: 'image_url', image_url: { url: img.url } });
      }
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (aiResponse.status === 429) {
      return new Response(JSON.stringify({ error: 'Rate limit reached. Please try again shortly.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (aiResponse.status === 402) {
      return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errText);
      return new Response(JSON.stringify({ error: 'Failed to generate questions' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await aiResponse.json();
    const raw = data?.choices?.[0]?.message?.content ?? '';

    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Attempt to salvage JSON from any accidental fences/text
      const match = String(raw).match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = null;
        }
      }
    }

    const questions = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.questions)
      ? parsed.questions
      : [];

    if (!questions.length) {
      return new Response(
        JSON.stringify({ error: 'The AI could not find or create questions from these images.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ questions }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('questions-from-images error:', err);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
