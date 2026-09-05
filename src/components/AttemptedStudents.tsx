import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CheckCircle2, Download, Loader2, Search, FileText, PauseCircle } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV } from "@/lib/csv";
import { Class, Test, TestAttempt, Question } from "@/types";
import { AnswerSheetView } from "./AnswerSheetView";
import { parseDateOnly } from "@/lib/scheduledDate";

interface Props {
  classes: Class[];
}

interface Row {
  id: string;
  studentName: string;
  studentEmail: string;
  className: string;
  classId: string;
  testId: string;
  testTitle: string;
  scorePercent: number;
  marks: number;
  total: number;
  answeredCount: number;
  timeSpent: number;
  completedAt: Date;
  attempt: TestAttempt;
}

const formatDuration = (seconds: number) => {
  if (!seconds || seconds < 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m === 0 ? `${s}s` : `${m}m ${s}s`;
};

export const AttemptedStudents = ({ classes }: Props) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [incomplete, setIncomplete] = useState<Row[]>([]);
  const [tests, setTests] = useState<Record<string, Test>>({});
  const [classFilter, setClassFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ attempt: TestAttempt; test: Test; studentName: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const classIds = classes.map((c) => c.id);
        if (classIds.length === 0) {
          if (!cancelled) { setRows([]); setIncomplete([]); setLoading(false); }
          return;
        }

        const { data: students } = await supabase
          .from("students")
          .select("id, name, email, class_id")
          .in("class_id", classIds);

        const studentMap = new Map((students || []).map((s) => [s.id, s]));
        const studentIds = Array.from(studentMap.keys());
        if (studentIds.length === 0) {
          if (!cancelled) { setRows([]); setIncomplete([]); setLoading(false); }
          return;
        }

        const { data: attempts } = await supabase
          .from("test_attempts")
          .select("*")
          .in("student_id", studentIds)
          .order("completed_at", { ascending: false });

        const all = attempts || [];
        const testIds = Array.from(new Set(all.map((a: any) => a.test_id)));

        const testMap: Record<string, Test> = {};
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
              scheduledDate: parseDateOnly(t.scheduled_date),
              scheduledTime: t.scheduled_time || undefined,
              isScheduled: t.is_scheduled || false,
              isPro: t.is_pro || false,
            };
          });
        }

        const classMap = new Map(classes.map((c) => [c.id, c.name]));

        const build = (a: any): Row => {
          const s = studentMap.get(a.student_id);
          const t = testMap[a.test_id];
          const total = t?.questions?.length ?? 0;
          const answers: number[] = (a.answers as any) || [];
          const attempt: TestAttempt = {
            id: a.id,
            testId: a.test_id,
            studentId: a.student_id,
            answers,
            score: a.score ?? 0,
            completedAt: new Date(a.completed_at),
            timeSpent: a.time_spent ?? 0,
            questionTimes: (a.question_times as any) || [],
            status: (a.status as 'completed' | 'unfinished') || 'completed',
          };
          return {
            id: a.id,
            studentName: s?.name || "Unknown student",
            studentEmail: s?.email || "—",
            classId: s?.class_id || "",
            className: classMap.get(s?.class_id || "") || "—",
            testId: a.test_id,
            testTitle: t?.title || "(deleted test)",
            scorePercent: a.score ?? 0,
            marks: total > 0 ? Math.round(((a.score ?? 0) / 100) * total) : 0,
            total,
            answeredCount: answers.filter((x) => x !== undefined && x !== null && x >= 0).length,
            timeSpent: a.time_spent ?? 0,
            completedAt: new Date(a.completed_at),
            attempt,
          };
        };

        const done: Row[] = [];
        const undone: Row[] = [];
        all.forEach((a: any) => {
          const row = build(a);
          if ((a.status || "completed") === "completed") done.push(row);
          else undone.push(row);
        });

        const sorter = (a: Row, b: Row) => b.completedAt.getTime() - a.completedAt.getTime();
        done.sort(sorter);
        undone.sort(sorter);

        if (!cancelled) {
          setRows(done);
          setIncomplete(undone);
          setTests(testMap);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [classes]);

  const applyFilters = (list: Row[]) => {
    const q = search.trim().toLowerCase();
    return list.filter((r) => {
      if (classFilter !== "all" && r.classId !== classFilter) return false;
      if (!q) return true;
      return (
        r.studentName.toLowerCase().includes(q) ||
        r.studentEmail.toLowerCase().includes(q) ||
        r.testTitle.toLowerCase().includes(q)
      );
    });
  };

  const filtered = useMemo(() => applyFilters(rows), [rows, classFilter, search]);
  const filteredIncomplete = useMemo(() => applyFilters(incomplete), [incomplete, classFilter, search]);

  const openSheet = (r: Row) => {
    const test = tests[r.testId];
    if (!test) return;
    setSelected({ attempt: r.attempt, test, studentName: r.studentName });
  };

  const handleExport = () => {
    downloadCSV(
      "successful-attempts.csv",
      filtered.map((r) => ({
        Student: r.studentName,
        Email: r.studentEmail,
        Class: r.className,
        Test: r.testTitle,
        "Marks obtained": r.marks,
        "Out of": r.total,
        Percentage: `${r.scorePercent}%`,
        "Time spent": formatDuration(r.timeSpent),
        "Completed at": format(r.completedAt, "dd MMM yyyy, hh:mm a"),
      }))
    );
  };

  const handleExportIncomplete = () => {
    downloadCSV(
      "incomplete-attempts.csv",
      filteredIncomplete.map((r) => ({
        Student: r.studentName,
        Email: r.studentEmail,
        Class: r.className,
        Test: r.testTitle,
        "Questions answered": `${r.answeredCount}/${r.total}`,
        "Time spent": formatDuration(r.timeSpent),
        "Last activity": format(r.completedAt, "dd MMM yyyy, hh:mm a"),
      }))
    );
  };

  const Toolbar = ({ onExport, disabled }: { onExport: () => void; disabled: boolean }) => (
    <div className="flex flex-wrap gap-2">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search student or test"
          className="pl-8 w-56"
        />
      </div>
      <Select value={classFilter} onValueChange={setClassFilter}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="All classes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All classes</SelectItem>
          {classes.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" onClick={onExport} disabled={disabled}>
        <Download className="h-4 w-4 mr-1" /> Export CSV
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-primary" /> Test Attempts
        </h2>
        <p className="text-sm text-muted-foreground">
          Completed attempts and students who left a test unfinished, most recent first.
        </p>
      </div>

      <Tabs defaultValue="completed">
        <TabsList>
          <TabsTrigger value="completed" className="gap-1">
            <CheckCircle2 className="h-4 w-4" /> Completed ({filtered.length})
          </TabsTrigger>
          <TabsTrigger value="incomplete" className="gap-1">
            <PauseCircle className="h-4 w-4" /> Not completed ({filteredIncomplete.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="completed">
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">{filtered.length} completed attempts</CardTitle>
                <CardDescription>Scores shown as marks obtained out of total questions.</CardDescription>
              </div>
              <Toolbar onExport={handleExport} disabled={filtered.length === 0} />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  No successful test attempts yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Test</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Completed</TableHead>
                        <TableHead>Answer sheet</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r, i) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell>
                            <div className="font-medium">{r.studentName}</div>
                            <div className="text-xs text-muted-foreground">{r.studentEmail}</div>
                          </TableCell>
                          <TableCell className="text-sm">{r.className}</TableCell>
                          <TableCell className="text-sm font-medium">{r.testTitle}</TableCell>
                          <TableCell>
                            <Badge variant={r.scorePercent >= 80 ? "default" : r.scorePercent >= 50 ? "secondary" : "outline"}>
                              {r.marks}/{r.total}
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-1">{r.scorePercent}%</div>
                          </TableCell>
                          <TableCell className="text-sm">{formatDuration(r.timeSpent)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(r.completedAt, "dd MMM yyyy, hh:mm a")}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" onClick={() => openSheet(r)} disabled={!tests[r.testId]}>
                              <FileText className="h-4 w-4 mr-1" /> View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incomplete">
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">{filteredIncomplete.length} unfinished attempts</CardTitle>
                <CardDescription>Students who started a test but left before submitting.</CardDescription>
              </div>
              <Toolbar onExport={handleExportIncomplete} disabled={filteredIncomplete.length === 0} />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
                </div>
              ) : filteredIncomplete.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  Everyone who started a test finished it. 🎉
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Test</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Last activity</TableHead>
                        <TableHead>Answer sheet</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredIncomplete.map((r, i) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell>
                            <div className="font-medium">{r.studentName}</div>
                            <div className="text-xs text-muted-foreground">{r.studentEmail}</div>
                          </TableCell>
                          <TableCell className="text-sm">{r.className}</TableCell>
                          <TableCell className="text-sm font-medium">{r.testTitle}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{r.answeredCount}/{r.total} answered</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{formatDuration(r.timeSpent)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(r.completedAt, "dd MMM yyyy, hh:mm a")}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" onClick={() => openSheet(r)} disabled={!tests[r.testId]}>
                              <FileText className="h-4 w-4 mr-1" /> View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <AnswerSheetView
              attempt={selected.attempt}
              test={selected.test}
              studentName={selected.studentName}
              onBack={() => setSelected(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
