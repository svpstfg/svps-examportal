import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Crown, Medal, Download, FileText, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV } from "@/lib/csv";
import { jsPDF } from "jspdf";
import { Class } from "@/types";

interface TestRow {
  id: string;
  title: string;
  resultsPublished: boolean;
}

interface MarkRow {
  studentId: string;
  name: string;
  email: string;
  score: number;
  attempts: number;
}

interface Props {
  classes: Class[];
  mode: "teacher" | "student";
  currentStudentEmail?: string;
}

export const TestResults = ({ classes, mode, currentStudentEmail }: Props) => {
  const [classId, setClassId] = useState<string>(classes[0]?.id || "");
  const [tests, setTests] = useState<TestRow[]>([]);
  const [testId, setTestId] = useState<string>("");
  const [rows, setRows] = useState<MarkRow[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const className = classes.find((c) => c.id === classId)?.name || "Class";
  const selectedTest = tests.find((t) => t.id === testId);

  // Load tests for the selected class
  useEffect(() => {
    if (!classId) {
      setTests([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoadingTests(true);
      try {
        const { data: courses } = await supabase
          .from("courses")
          .select("id")
          .eq("class_id", classId);
        const courseIds = (courses || []).map((c) => c.id);
        if (!courseIds.length) {
          if (!cancelled) { setTests([]); setTestId(""); }
          return;
        }
        const { data: chapters } = await supabase
          .from("chapters")
          .select("id")
          .in("course_id", courseIds);
        const chapterIds = (chapters || []).map((c) => c.id);
        if (!chapterIds.length) {
          if (!cancelled) { setTests([]); setTestId(""); }
          return;
        }
        let query = supabase
          .from("tests")
          .select("id, title, results_published")
          .in("chapter_id", chapterIds)
          .order("created_at", { ascending: false });
        // Students only see published tests
        if (mode === "student") query = query.eq("results_published", true);

        const { data: testData } = await query;
        const mapped: TestRow[] = (testData || []).map((t: any) => ({
          id: t.id,
          title: t.title,
          resultsPublished: !!t.results_published,
        }));
        if (!cancelled) {
          setTests(mapped);
          setTestId((prev) => (mapped.some((t) => t.id === prev) ? prev : mapped[0]?.id || ""));
        }
      } finally {
        if (!cancelled) setLoadingTests(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [classId, mode]);

  // Load marks for the selected test
  useEffect(() => {
    if (!testId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoadingRows(true);
      try {
        const { data: attempts } = await supabase
          .from("test_attempts")
          .select("student_id, score")
          .eq("test_id", testId);

        const studentIds = [...new Set((attempts || []).map((a) => a.student_id))];
        if (!studentIds.length) {
          if (!cancelled) setRows([]);
          return;
        }
        const { data: students } = await supabase
          .from("students")
          .select("id, name, email")
          .in("id", studentIds);

        const byStudent = new Map<string, number[]>();
        (attempts || []).forEach((a) => {
          const list = byStudent.get(a.student_id) || [];
          list.push(a.score);
          byStudent.set(a.student_id, list);
        });

        const built: MarkRow[] = studentIds.map((id) => {
          const s = students?.find((x) => x.id === id);
          const scores = byStudent.get(id) || [];
          return {
            studentId: id,
            name: s?.name || "Unknown",
            email: s?.email || "",
            score: scores.length ? Math.max(...scores) : 0,
            attempts: scores.length,
          };
        });
        built.sort((a, b) => b.score - a.score);
        if (!cancelled) setRows(built);
      } finally {
        if (!cancelled) setLoadingRows(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [testId]);

  const myRank = useMemo(() => {
    if (!currentStudentEmail) return null;
    const idx = rows.findIndex((r) => r.email.toLowerCase() === currentStudentEmail.toLowerCase());
    return idx >= 0 ? idx + 1 : null;
  }, [rows, currentStudentEmail]);

  const handleTogglePublish = async (checked: boolean) => {
    if (!selectedTest) return;
    setPublishing(true);
    try {
      const { error } = await supabase
        .from("tests")
        .update({ results_published: checked } as any)
        .eq("id", selectedTest.id);
      if (error) throw error;
      setTests((prev) => prev.map((t) => (t.id === selectedTest.id ? { ...t, resultsPublished: checked } : t)));
      toast.success(checked ? "Results published to students portal" : "Results unpublished");
    } catch (error: any) {
      console.error("Error toggling publish:", error);
      toast.error(error.message || "Failed to update publish status");
    } finally {
      setPublishing(false);
    }
  };

  const handleExportCSV = () => {
    if (!rows.length) return;
    const exportRows = rows.map((r, i) => ({
      Rank: i + 1,
      Name: r.name,
      ...(mode === "student" ? {} : { Email: r.email }),
      "Score (%)": r.score,
      Attempts: r.attempts,
    }));
    downloadCSV(`results-${(selectedTest?.title || "test").replace(/\s+/g, "_")}.csv`, exportRows);
  };

  const handleExportPDF = () => {
    if (!rows.length || !selectedTest) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 18;

    doc.setFontSize(16);
    doc.text("Test Marks List", pageWidth / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(11);
    doc.setTextColor(90);
    doc.text(selectedTest.title, pageWidth / 2, y, { align: "center" });
    y += 6;
    doc.text(`Class: ${className}`, pageWidth / 2, y, { align: "center" });
    y += 10;
    doc.setTextColor(0);

    // Header row
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("Rank", 16, y);
    doc.text("Name", 34, y);
    doc.text("Score", 150, y);
    doc.text("Attempts", 172, y);
    doc.setFont(undefined, "normal");
    y += 3;
    doc.setDrawColor(200);
    doc.line(16, y, pageWidth - 16, y);
    y += 6;

    rows.forEach((r, i) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(String(i + 1), 16, y);
      doc.text(r.name.slice(0, 50), 34, y);
      doc.text(`${r.score}%`, 150, y);
      doc.text(String(r.attempts), 176, y);
      y += 7;
    });

    doc.save(`results-${selectedTest.title.replace(/\s+/g, "_")}.pdf`);
  };

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-4 w-4 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-4 w-4 text-zinc-400" />;
    if (rank === 3) return <Medal className="h-4 w-4 text-amber-700" />;
    return <span className="text-xs font-mono text-muted-foreground w-4 text-center">{rank}</span>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-5 w-5 text-primary" />
              Test Results {mode === "teacher" ? "(Publish & Download)" : "Marks List"}
            </CardTitle>
            <CardDescription>
              {mode === "teacher"
                ? "Select a test to view the marks list, download it, and publish to students."
                : currentStudentEmail && myRank
                ? `You are ranked #${myRank} of ${rows.length}`
                : "Marks lists published by your teacher"}
            </CardDescription>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          {classes.length > 1 && (
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={testId} onValueChange={setTestId} disabled={loadingTests || !tests.length}>
            <SelectTrigger className="h-8 w-[220px] text-xs">
              <SelectValue placeholder={loadingTests ? "Loading tests…" : tests.length ? "Select test" : "No tests"} />
            </SelectTrigger>
            <SelectContent>
              {tests.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {mode === "teacher" && selectedTest && (
            <>
              <Button variant="outline" size="sm" className="h-8" onClick={handleExportPDF} disabled={!rows.length}>
                <FileText className="h-3.5 w-3.5 mr-1" />
                PDF
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={handleExportCSV} disabled={!rows.length}>
                <Download className="h-3.5 w-3.5 mr-1" />
                CSV
              </Button>
            </>
          )}
          {mode === "student" && selectedTest && (
            <Button variant="outline" size="sm" className="h-8" onClick={handleExportPDF} disabled={!rows.length}>
              <FileText className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Download </span>PDF
            </Button>
          )}
        </div>

        {mode === "teacher" && selectedTest && (
          <div className="flex items-center gap-3 pt-2 rounded-md bg-muted/40 px-3 py-2">
            {selectedTest.resultsPublished ? (
              <Eye className="h-4 w-4 text-green-600" />
            ) : (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            )}
            <Label htmlFor="publish-switch" className="text-sm flex-1">
              Publish to students portal
              <span className="block text-xs text-muted-foreground font-normal">
                {selectedTest.resultsPublished
                  ? "Students can currently view this marks list"
                  : "Students cannot see this marks list yet"}
              </span>
            </Label>
            <Switch
              id="publish-switch"
              checked={selectedTest.resultsPublished}
              disabled={publishing}
              onCheckedChange={handleTogglePublish}
            />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loadingRows ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
        ) : !selectedTest ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {mode === "student" ? "No published results yet." : "Select a test to view its marks list."}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No attempts yet for this test.</p>
        ) : (
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {rows.map((r, i) => {
              const rank = i + 1;
              const isMe = currentStudentEmail && r.email.toLowerCase() === currentStudentEmail.toLowerCase();
              return (
                <div
                  key={r.studentId}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md border ${
                    isMe ? "bg-primary/10 border-primary/40" : "bg-card"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-6 flex justify-center">{rankIcon(rank)}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {r.name} {isMe && <span className="text-xs text-primary">(You)</span>}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {r.attempts} attempt{r.attempts === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={r.score >= 80 ? "default" : r.score >= 60 ? "secondary" : "outline"}
                    className="text-xs shrink-0"
                  >
                    {r.score}%
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
