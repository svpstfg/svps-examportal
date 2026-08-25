import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Download, Loader2, Search } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV } from "@/lib/csv";
import { Class } from "@/types";

interface Props {
  classes: Class[];
}

interface Row {
  id: string;
  studentName: string;
  studentEmail: string;
  className: string;
  classId: string;
  testTitle: string;
  scorePercent: number;
  marks: number;
  total: number;
  timeSpent: number;
  completedAt: Date;
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
  const [classFilter, setClassFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const classIds = classes.map((c) => c.id);
        if (classIds.length === 0) {
          if (!cancelled) { setRows([]); setLoading(false); }
          return;
        }

        const { data: students } = await supabase
          .from("students")
          .select("id, name, email, class_id")
          .in("class_id", classIds);

        const studentMap = new Map((students || []).map((s) => [s.id, s]));
        const studentIds = Array.from(studentMap.keys());
        if (studentIds.length === 0) {
          if (!cancelled) { setRows([]); setLoading(false); }
          return;
        }

        const { data: attempts } = await supabase
          .from("test_attempts")
          .select("id, test_id, student_id, score, time_spent, completed_at, status")
          .in("student_id", studentIds)
          .order("completed_at", { ascending: false });

        const successful = (attempts || []).filter((a) => (a.status || "completed") === "completed");
        const testIds = Array.from(new Set(successful.map((a) => a.test_id)));

        const testMap = new Map<string, { title: string; total: number }>();
        if (testIds.length) {
          const { data: tests } = await supabase.from("tests").select("id, title, questions").in("id", testIds);
          (tests || []).forEach((t: any) => {
            testMap.set(t.id, {
              title: t.title,
              total: Array.isArray(t.questions) ? t.questions.length : 0,
            });
          });
        }

        const classMap = new Map(classes.map((c) => [c.id, c.name]));

        const built: Row[] = successful.map((a) => {
          const s = studentMap.get(a.student_id);
          const t = testMap.get(a.test_id);
          const total = t?.total ?? 0;
          return {
            id: a.id,
            studentName: s?.name || "Unknown student",
            studentEmail: s?.email || "—",
            classId: s?.class_id || "",
            className: classMap.get(s?.class_id || "") || "—",
            testTitle: t?.title || "(deleted test)",
            scorePercent: a.score ?? 0,
            marks: total > 0 ? Math.round(((a.score ?? 0) / 100) * total) : 0,
            total,
            timeSpent: a.time_spent ?? 0,
            completedAt: new Date(a.completed_at),
          };
        });

        built.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
        if (!cancelled) setRows(built);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [classes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (classFilter !== "all" && r.classId !== classFilter) return false;
      if (!q) return true;
      return (
        r.studentName.toLowerCase().includes(q) ||
        r.studentEmail.toLowerCase().includes(q) ||
        r.testTitle.toLowerCase().includes(q)
      );
    });
  }, [rows, classFilter, search]);

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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-primary" /> Successful Attempts
        </h2>
        <p className="text-sm text-muted-foreground">
          Every student who completed a test, most recent first.
        </p>
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">{filtered.length} completed attempts</CardTitle>
            <CardDescription>Scores shown as marks obtained out of total questions.</CardDescription>
          </div>
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
            <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </div>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
