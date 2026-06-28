import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserCheck, UserX, Download, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV } from "@/lib/csv";
import { Test } from "@/types";

interface Props {
  test: Test | null;
  onClose: () => void;
}

interface AttemptRow {
  studentId: string;
  name: string;
  email: string;
  score: number;
  timeSpent: number; // seconds
  completedAt: string;
}

interface PendingRow {
  studentId: string;
  name: string;
  email: string;
}

const formatDuration = (seconds: number) => {
  if (!seconds || seconds < 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
};

export const TestParticipation = ({ test, onClose }: Props) => {
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);

  useEffect(() => {
    if (!test) return;
    let cancelled = false;

    const load = async () => {
      // Resolve test -> chapter -> course -> class
      const { data: chapter } = await supabase
        .from("chapters")
        .select("course_id")
        .eq("id", test.chapterId)
        .maybeSingle();
      if (!chapter) {
        if (!cancelled) { setAttempts([]); setPending([]); setLoading(false); }
        return;
      }
      const { data: course } = await supabase
        .from("courses")
        .select("class_id")
        .eq("id", chapter.course_id)
        .maybeSingle();
      if (!course) {
        if (!cancelled) { setAttempts([]); setPending([]); setLoading(false); }
        return;
      }
      const classId = course.class_id;

      const [studentsRes, attemptsRes] = await Promise.all([
        supabase.from("students").select("id, name, email").eq("class_id", classId),
        supabase
          .from("test_attempts")
          .select("student_id, score, time_spent, completed_at")
          .eq("test_id", test.id),
      ]);

      const students = studentsRes.data || [];
      const rawAttempts = attemptsRes.data || [];

      const bestByStudent = new Map<string, typeof rawAttempts[number]>();
      for (const a of rawAttempts) {
        const cur = bestByStudent.get(a.student_id);
        if (!cur || new Date(a.completed_at) > new Date(cur.completed_at)) {
          bestByStudent.set(a.student_id, a);
        }
      }

      const studentMap = new Map(students.map((s) => [s.id, s]));
      const attemptRows: AttemptRow[] = [];
      bestByStudent.forEach((a, sid) => {
        const s = studentMap.get(sid);
        attemptRows.push({
          studentId: sid,
          name: s?.name || "Unknown student",
          email: s?.email || "—",
          score: a.score ?? 0,
          timeSpent: a.time_spent ?? 0,
          completedAt: a.completed_at,
        });
      });
      attemptRows.sort((a, b) => b.score - a.score);

      const attemptedIds = new Set(bestByStudent.keys());
      const pendingRows: PendingRow[] = students
        .filter((s) => !attemptedIds.has(s.id))
        .map((s) => ({ studentId: s.id, name: s.name, email: s.email }))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (!cancelled) {
        setAttempts(attemptRows);
        setPending(pendingRows);
        setLoading(false);
      }
    };

    setLoading(true);
    load();

    // Realtime: refresh when attempts for this test change
    const channel = supabase
      .channel(`test-participation-${test.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'test_attempts', filter: `test_id=eq.${test.id}` },
        () => { load(); }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [test]);

  const avgTime = useMemo(() => {
    if (!attempts.length) return 0;
    return Math.round(attempts.reduce((s, a) => s + (a.timeSpent || 0), 0) / attempts.length);
  }, [attempts]);

  const handleExport = () => {
    if (!test) return;
    const rows = [
      ...attempts.map((a) => ({
        Status: "Completed",
        Name: a.name,
        Email: a.email,
        Score: `${a.score}%`,
        "Time spent": formatDuration(a.timeSpent),
        "Completed at": new Date(a.completedAt).toLocaleString(),
      })),
      ...pending.map((p) => ({
        Status: "Not attempted",
        Name: p.name,
        Email: p.email,
        Score: "",
        "Time spent": "",
        "Completed at": "",
      })),
    ];
    downloadCSV(`participation-${test.title.replace(/\s+/g, "_")}.csv`, rows);
  };

  return (
    <Dialog open={!!test} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Test Participation — {test?.title}
            <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> LIVE
            </span>
          </DialogTitle>
          <DialogDescription>
            {loading
              ? "Loading…"
              : `${attempts.length} attempted • ${pending.length} pending • Avg time ${formatDuration(avgTime)}`}
          </DialogDescription>
        </DialogHeader>

        {!loading && (
          <>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
            </div>

            <Tabs defaultValue="attempted" className="mt-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="attempted" className="gap-1">
                  <UserCheck className="h-4 w-4" />
                  Attempted ({attempts.length})
                </TabsTrigger>
                <TabsTrigger value="pending" className="gap-1">
                  <UserX className="h-4 w-4" />
                  Pending ({pending.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="attempted">
                {attempts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No students have attempted this test yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead><Clock className="h-3.5 w-3.5 inline mr-1" />Time</TableHead>
                        <TableHead>Completed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attempts.map((a) => (
                        <TableRow key={a.studentId}>
                          <TableCell>
                            <div className="font-medium">{a.name}</div>
                            <div className="text-xs text-muted-foreground">{a.email}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={a.score >= 75 ? "default" : a.score >= 50 ? "secondary" : "destructive"}>
                              {a.score}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{formatDuration(a.timeSpent)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(a.completedAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="pending">
                {pending.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Every enrolled student has attempted this test. 🎉
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pending.map((p) => (
                        <TableRow key={p.studentId}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{p.email}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
