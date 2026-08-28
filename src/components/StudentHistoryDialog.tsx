import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Test, TestAttempt, Question } from "@/types";
import { AnswerSheetView } from "./AnswerSheetView";

interface Props {
  studentId: string;
  studentName: string;
  open: boolean;
  onClose: () => void;
}

export const StudentHistoryDialog = ({ studentId, studentName, open, onClose }: Props) => {
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [tests, setTests] = useState<Record<string, Test>>({});
  const [selected, setSelected] = useState<{ attempt: TestAttempt; test: Test } | null>(null);

  useEffect(() => {
    if (!open || !studentId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data: rawAttempts } = await supabase
          .from("test_attempts")
          .select("*")
          .eq("student_id", studentId)
          .order("completed_at", { ascending: false });

        const transformed: TestAttempt[] = (rawAttempts || []).map((a) => ({
          id: a.id,
          testId: a.test_id,
          studentId: a.student_id,
          answers: (a.answers as any) || [],
          score: a.score,
          completedAt: new Date(a.completed_at),
          timeSpent: a.time_spent,
          questionTimes: (a.question_times as any) || [],
          status: ((a as any).status as 'completed' | 'unfinished') || 'completed',
        }));

        const testIds = Array.from(new Set(transformed.map((a) => a.testId)));
        let testMap: Record<string, Test> = {};
        if (testIds.length) {
          const { data: testRows } = await supabase.from("tests").select("*").in("id", testIds);
          (testRows || []).forEach((t: any) => {
            testMap[t.id] = {
              id: t.id,
              title: t.title,
              duration: t.duration,
              chapterId: t.chapter_id,
              questions: (t.questions as any as Question[]) || [],
              createdAt: new Date(t.created_at),
              scheduledDate: t.scheduled_date ? new Date(t.scheduled_date) : undefined,
              scheduledTime: t.scheduled_time || undefined,
              isScheduled: t.is_scheduled || false,
              isPro: t.is_pro || false,
            };
          });
        }

        if (!cancelled) {
          setAttempts(transformed);
          setTests(testMap);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, studentId]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setSelected(null); onClose(); } }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        {selected ? (
          <div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to history
            </Button>
            <AnswerSheetView
              attempt={selected.attempt}
              test={selected.test}
              studentName={studentName}
              onBack={() => setSelected(null)}
            />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{studentName}'s Test History</DialogTitle>
              <DialogDescription>
                Click any row to view the full answer sheet with questions and correct answers.
              </DialogDescription>
            </DialogHeader>

            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
              </div>
            ) : attempts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                No test attempts yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map((a) => {
                    const test = tests[a.testId];
                    return (
                      <TableRow
                        key={a.id}
                        className="cursor-pointer"
                        onClick={() => test && setSelected({ attempt: a, test })}
                      >
                        <TableCell className="font-medium">
                          {test?.title || "(deleted test)"}
                          {a.status === "unfinished" && (
                            <Badge variant="destructive" className="ml-2 text-[10px]">Unfinished</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={a.score >= 80 ? "default" : a.score >= 50 ? "secondary" : "outline"}>
                            {a.score}%
                          </Badge>
                        </TableCell>
                        <TableCell>{formatTime(a.timeSpent)}</TableCell>
                        <TableCell>{format(a.completedAt, "dd MMM yyyy, hh:mm a")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
