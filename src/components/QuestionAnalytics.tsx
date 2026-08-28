import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, BarChart3, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV } from "@/lib/csv";
import { RichTextDisplay } from "./RichTextDisplay";
import { Test } from "@/types";

interface Props {
  test: Test | null;
  onClose: () => void;
}

interface QuestionStat {
  index: number;
  question: string;
  correctAnswer: number;
  totalAnswered: number;
  correctCount: number;
  correctPct: number;
  optionCounts: number[];
}

export const QuestionAnalytics = ({ test, onClose }: Props) => {
  const [attempts, setAttempts] = useState<{ score: number; answers: number[] }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!test) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("test_attempts")
      .select("score, answers")
      .eq("test_id", test.id)
      .then(({ data }) => {
        if (cancelled) return;
        setAttempts((data || []).map((a) => ({ score: a.score, answers: a.answers || [] })));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [test]);

  const stats = useMemo<QuestionStat[]>(() => {
    if (!test) return [];
    return test.questions.map((q, qi) => {
      const optionCounts = new Array(q.options.length).fill(0);
      let total = 0;
      let correct = 0;
      for (const a of attempts) {
        const ans = a.answers[qi];
        const n = Number(ans);
        if (ans === undefined || ans === null || Number.isNaN(n) || n < 0) continue;
        total++;
        if (n >= 0 && n < optionCounts.length) optionCounts[n]++;
        if (n === Number(q.correctAnswer)) correct++;
      }
      return {
        index: qi,
        question: q.question,
        correctAnswer: q.correctAnswer,
        totalAnswered: total,
        correctCount: correct,
        correctPct: total ? Math.round((correct / total) * 100) : 0,
        optionCounts,
      };
    });
  }, [test, attempts]);

  const overallAvg = useMemo(() => {
    if (!attempts.length) return 0;
    return Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length);
  }, [attempts]);

  const hardestFirst = useMemo(
    () => [...stats].filter((s) => s.totalAnswered > 0).sort((a, b) => a.correctPct - b.correctPct),
    [stats]
  );

  const handleExport = () => {
    if (!test) return;
    const rows = stats.map((s) => ({
      Question: s.index + 1,
      "Correct Answer": String.fromCharCode(65 + s.correctAnswer),
      Attempts: s.totalAnswered,
      "Correct (%)": s.correctPct,
      ...Object.fromEntries(s.optionCounts.map((c, i) => [`Picked ${String.fromCharCode(65 + i)}`, c])),
    }));
    downloadCSV(`analytics-${test.title.replace(/\s+/g, "_")}.csv`, rows);
  };

  return (
    <Dialog open={!!test} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Question Analytics — {test?.title}
          </DialogTitle>
          <DialogDescription>
            {loading
              ? "Loading attempts…"
              : `${attempts.length} attempt${attempts.length === 1 ? "" : "s"} • Class average ${overallAvg}%`}
          </DialogDescription>
        </DialogHeader>

        {!loading && attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No students have attempted this test yet.
          </p>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <div>
                {hardestFirst.length > 0 && hardestFirst[0].correctPct < 50 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Q{hardestFirst[0].index + 1} most missed ({hardestFirst[0].correctPct}%)
                  </Badge>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
            </div>

            <div className="space-y-4 mt-2">
              {stats.map((s) => {
                const tone =
                  s.correctPct >= 75 ? "default" : s.correctPct >= 50 ? "secondary" : "destructive";
                return (
                  <div key={s.index} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium flex-1">
                        <span className="text-muted-foreground mr-2">Q{s.index + 1}.</span>
                        <RichTextDisplay content={s.question} as="span" />
                      </div>
                      <Badge variant={tone}>{s.correctPct}% correct</Badge>
                    </div>
                    <Progress value={s.correctPct} className="h-1.5" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      {s.optionCounts.map((count, i) => {
                        const pct = s.totalAnswered ? Math.round((count / s.totalAnswered) * 100) : 0;
                        const isCorrect = i === s.correctAnswer;
                        return (
                          <div
                            key={i}
                            className={`text-xs px-2 py-1.5 rounded border ${
                              isCorrect
                                ? "border-success/50 bg-success/10 text-success-foreground"
                                : "border-border bg-muted/30"
                            }`}
                          >
                            <span className="font-semibold">{String.fromCharCode(65 + i)}</span>{" "}
                            <span className="text-muted-foreground">— {count} ({pct}%)</span>
                            {isCorrect && <span className="ml-1 text-success">✓</span>}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{s.totalAnswered} answered</p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
