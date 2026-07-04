import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, Crown, Medal, Download, FileText, Eye, EyeOff, BarChart3, Clock, Sparkles, Loader2, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV } from "@/lib/csv";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { RichTextDisplay } from "./RichTextDisplay";
import { getQuestionRemark, isAnswered, isAnswerCorrect, normalizeQuestionTime } from "@/lib/answers";
import { Class, Question } from "@/types";

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
  answers: number[];
  questionTimes: number[];
  timeSpent: number;
}

interface Props {
  classes: Class[];
  mode: "teacher" | "student";
  currentStudentEmail?: string;
}

const formatDuration = (seconds: number) => {
  if (!seconds || seconds < 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
};

export const TestResults = ({ classes, mode, currentStudentEmail }: Props) => {
  const [classId, setClassId] = useState<string>(classes[0]?.id || "");
  const [tests, setTests] = useState<TestRow[]>([]);
  const [testId, setTestId] = useState<string>("");
  const [rows, setRows] = useState<MarkRow[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subject, setSubject] = useState<string>("");
  const [loadingTests, setLoadingTests] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [analysisRow, setAnalysisRow] = useState<MarkRow | null>(null);
  const [aiReport, setAiReport] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);

  const className = classes.find((c) => c.id === classId)?.name || "Class";
  const selectedTest = tests.find((t) => t.id === testId);
  const fullMarks = questions.length;
  const marksOf = (scorePct: number) => (fullMarks > 0 ? Math.round((scorePct / 100) * fullMarks) : 0);

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

  // Load marks + questions for the selected test
  useEffect(() => {
    if (!testId) {
      setRows([]);
      setQuestions([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoadingRows(true);
      try {
        // Test questions + subject (for full marks + analysis)
        const { data: testRec } = await supabase
          .from("tests")
          .select("questions, chapter_id")
          .eq("id", testId)
          .maybeSingle();
        const qs = ((testRec?.questions as any) as Question[]) || [];
        if (!cancelled) setQuestions(qs);

        if (testRec?.chapter_id) {
          const { data: ch } = await supabase
            .from("chapters")
            .select("course_id")
            .eq("id", testRec.chapter_id)
            .maybeSingle();
          if (ch?.course_id) {
            const { data: co } = await supabase
              .from("courses")
              .select("name")
              .eq("id", ch.course_id)
              .maybeSingle();
            if (!cancelled) setSubject(co?.name || "");
          }
        }

        const { data: attempts } = await supabase
          .from("test_attempts")
          .select("student_id, score, answers, question_times, time_spent, completed_at")
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

        // Pick the best attempt per student (highest score, latest as tie-break)
        const bestByStudent = new Map<string, any>();
        const countByStudent = new Map<string, number>();
        (attempts || []).forEach((a) => {
          countByStudent.set(a.student_id, (countByStudent.get(a.student_id) || 0) + 1);
          const cur = bestByStudent.get(a.student_id);
          if (
            !cur ||
            a.score > cur.score ||
            (a.score === cur.score && new Date(a.completed_at) > new Date(cur.completed_at))
          ) {
            bestByStudent.set(a.student_id, a);
          }
        });

        const built: MarkRow[] = studentIds.map((id) => {
          const s = students?.find((x) => x.id === id);
          const best = bestByStudent.get(id);
          return {
            studentId: id,
            name: s?.name || "Unknown",
            email: s?.email || "",
            score: best?.score ?? 0,
            attempts: countByStudent.get(id) || 0,
            answers: best?.answers || [],
            questionTimes: best?.question_times || [],
            timeSpent: best?.time_spent ?? 0,
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
      "Marks Obtained": marksOf(r.score),
      "Full Marks": fullMarks,
      "Score (%)": r.score,
      "Time Spent": formatDuration(r.timeSpent),
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
    if (subject) { doc.text(`Subject: ${subject}`, pageWidth / 2, y, { align: "center" }); y += 6; }
    doc.text(selectedTest.title, pageWidth / 2, y, { align: "center" });
    y += 6;
    doc.text(`Class: ${className}  •  Full Marks: ${fullMarks}`, pageWidth / 2, y, { align: "center" });
    y += 10;
    doc.setTextColor(0);

    // Header row
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("Rank", 16, y);
    doc.text("Name", 34, y);
    doc.text("Marks", 130, y);
    doc.text("Score", 158, y);
    doc.text("Time", 180, y);
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
      doc.text(r.name.slice(0, 46), 34, y);
      doc.text(`${marksOf(r.score)}/${fullMarks}`, 130, y);
      doc.text(`${r.score}%`, 158, y);
      doc.text(formatDuration(r.timeSpent), 180, y);
      y += 7;
    });

    doc.save(`results-${selectedTest.title.replace(/\s+/g, "_")}.pdf`);
  };

  const openAnalysis = (r: MarkRow) => {
    setAnalysisRow(r);
    setAiReport("");
  };

  const runAiAnalysis = async () => {
    if (!analysisRow || !selectedTest) return;
    setAiLoading(true);
    setAiReport("");
    try {
      const payloadQuestions = questions.map((q, i) => {
        const ans = analysisRow.answers[i];
        const answered = isAnswered(ans);
        return {
          index: i,
          question: q.question || "",
          correct: isAnswerCorrect(ans, q.correctAnswer),
          answered,
          timeSec: normalizeQuestionTime(analysisRow.questionTimes[i] ?? 0),
        };
      });
      const { data, error } = await supabase.functions.invoke("student-analysis", {
        body: {
          studentName: analysisRow.name,
          testTitle: selectedTest.title,
          subject,
          className,
          scorePct: analysisRow.score,
          fullMarks,
          marksObtained: marksOf(analysisRow.score),
          totalTimeSec: analysisRow.timeSpent,
          questions: payloadQuestions,
        },
      });
      if (error) {
        const msg = (await error.context?.json?.())?.error;
        throw new Error(msg || error.message);
      }
      if (data?.error) throw new Error(data.error);
      setAiReport(data?.report || "No report generated.");
    } catch (err: any) {
      toast.error(err.message || "AI analysis failed");
    } finally {
      setAiLoading(false);
    }
  };

  const downloadAnalysisPDF = async () => {
    if (!analysisRow || !selectedTest) return;
    try {
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.width = "900px";
      container.style.background = "white";
      container.style.color = "black";
      container.style.padding = "24px";

      const questionsHtml = questions
        .map((q, i) => {
          const ans = analysisRow.answers[i];
          const answered = isAnswered(ans);
          const correct = isAnswerCorrect(ans, q.correctAnswer);
          const t = normalizeQuestionTime(analysisRow.questionTimes[i] ?? 0);
          const statusIcon = correct ? '✓' : !answered ? '⚠' : '✗';
          const statusColor = correct ? 'color:#059669' : !answered ? 'color:#7c2d12' : 'color:#dc2626';
          const remark = getQuestionRemark(correct, t, answered);
          
          const optionsHtml = (q.options || [])
            .map((opt, oi) => {
              const isUser = Number(ans) === oi;
              const isCorrect = Number(q.correctAnswer) === oi;
              let optClass = '';
              if (isCorrect) {
                optClass = 'font-weight:600;color:#15803d';
              } else if (isUser && !isCorrect) {
                optClass = 'text-decoration:line-through;color:#991b1b';
              }
              return `<div style="margin-bottom:3px;padding:2px 4px;border:1px solid #e5e7eb;${optClass};font-size:11px">(${String.fromCharCode(65 + oi)}) ${opt}${isCorrect ? ' <span style="color:#059669">✓</span>' : isUser && !isCorrect ? ' <span style="color:#dc2626">✗</span>' : ''}</div>`;
            })
            .join("");

          return `
            <div style="padding:8px;border:1px solid #e5e7eb;margin-bottom:0;font-size:10px;">
              <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:4px">
                <div style="width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;background-color:#333;color:white;font-weight:bold;font-size:9px;flex-shrink:0">${i + 1}</div>
                <div style="flex:1">
                  <div style="font-weight:600;margin-bottom:2px;line-height:1.2">${q.question}</div>
                </div>
                <span style="font-weight:bold;padding:2px 4px;border-radius:3px;${statusColor};font-size:8px">${statusIcon}</span>
              </div>
              <div style="margin-left:26px">${optionsHtml}</div>
              <div style="margin-left:26px;margin-top:3px;font-size:9px;color:#4b5563">
                <span style="margin-right:8px">Time: ${formatDuration(t)}</span>
                <span>Remark: <span style="color:#059669;font-weight:600">${remark}</span></span>
              </div>
            </div>`;
        })
        .join("");

      const overallMarks = marksOf(analysisRow.score);
      container.innerHTML = `
        <div style="font-family:Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#111">
          <h1 style="font-size:20px;margin-bottom:8px;">${analysisRow.name} — Answer Sheet & Analysis</h1>
          <p style="margin:0 0 6px 0; color:#555">Test: ${selectedTest.title} • Class: ${className}</p>
          <p style="margin:0 0 12px 0; color:#555">Marks: ${overallMarks} / ${fullMarks} • Score: ${analysisRow.score}% • Total time: ${formatDuration(analysisRow.timeSpent)}</p>
          <div style="margin:8px 0;padding:12px;border:1px solid #eee;background:#fafafa">${aiReport ? `<h3 style=\"margin:0 0 8px 0\">AI Analysis</h3><pre style=\"white-space:pre-wrap; font-size:12px;\">${aiReport}</pre>` : ''}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border:2px solid #000;border-collapse:collapse">
            ${questionsHtml}
          </div>
          <p style="font-size:10px;color:#888;margin-top:12px">Generated on ${new Date().toLocaleString()}</p>
        </div>
      `;

      document.body.appendChild(container);
      await document.fonts.ready;
      const canvas = await html2canvas(container, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const ratio = pdfWidth / canvas.width;
      const totalPdfHeight = canvas.height * ratio;
      let position = 0;
      let remaining = totalPdfHeight;
      while (remaining > 0) {
        if (position > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, -position, pdfWidth, totalPdfHeight);
        position += pdfHeight;
        remaining -= pdfHeight;
      }
      pdf.save(`${analysisRow.name.replace(/\s+/g, "_")}_analysis.pdf`);
      document.body.removeChild(container);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to generate PDF");
    }
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
                ? "Select a test to view marks, per-student analysis, download it, and publish to students."
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
                      <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <span>{r.attempts} attempt{r.attempts === 1 ? "" : "s"}</span>
                        <span className="inline-flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />{formatDuration(r.timeSpent)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-semibold">{marksOf(r.score)}<span className="text-muted-foreground font-normal">/{fullMarks}</span></div>
                      <Badge
                        variant={r.score >= 80 ? "default" : r.score >= 60 ? "secondary" : "outline"}
                        className="text-[10px] h-4 px-1"
                      >
                        {r.score}%
                      </Badge>
                    </div>
                    {mode === "teacher" && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Individual analysis" onClick={() => openAnalysis(r)}>
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Individual student analysis */}
      <Dialog open={!!analysisRow} onOpenChange={(o) => { if (!o) { setAnalysisRow(null); setAiReport(""); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {analysisRow?.name} — Individual Analysis
            </DialogTitle>
            <DialogDescription>
              {selectedTest?.title} • {marksOf(analysisRow?.score ?? 0)}/{fullMarks} ({analysisRow?.score ?? 0}%) • Total time {formatDuration(analysisRow?.timeSpent ?? 0)}
            </DialogDescription>
          </DialogHeader>

          {analysisRow && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={runAiAnalysis} disabled={aiLoading} className="gap-1">
                    {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {aiLoading ? "Analysing…" : "AI Analysis Report"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={downloadAnalysisPDF} disabled={!analysisRow} className="gap-1">
                    <Download className="h-4 w-4" />
                    PDF
                  </Button>
                </div>
              </div>

              {aiReport && (
                <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-1">
                  {aiReport.split("\n").map((line, idx) => {
                    const t = line.trim();
                    if (!t) return <div key={idx} className="h-1" />;
                    if (t.startsWith("## ")) return <h4 key={idx} className="font-semibold text-sm mt-2">{t.replace(/^##\s*/, "")}</h4>;
                    if (t.startsWith("# ")) return <h3 key={idx} className="font-bold text-base mt-2">{t.replace(/^#\s*/, "")}</h3>;
                    if (t.startsWith("- ") || t.startsWith("* ")) return <li key={idx} className="ml-4 list-disc">{t.replace(/^[-*]\s*/, "")}</li>;
                    return <p key={idx}>{t}</p>;
                  })}
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-1">
                  <Clock className="h-4 w-4" /> Per-question timing
                </h4>
                <div className="space-y-1.5">
                  {questions.map((q, i) => {
                    const ans = analysisRow.answers[i];
                    const answered = isAnswered(ans);
                    const correct = isAnswerCorrect(ans, q.correctAnswer);
                    const t = normalizeQuestionTime(analysisRow.questionTimes[i] ?? 0);
                    return (
                      <div key={i} className="flex items-start gap-2 rounded-md border px-3 py-2">
                        <div className="shrink-0 pt-0.5">
                          {!answered ? (
                            <MinusCircle className="h-4 w-4 text-muted-foreground" />
                          ) : correct ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-muted-foreground">Q{i + 1}</div>
                          <div className="text-sm line-clamp-2">
                            <RichTextDisplay content={q.question} as="span" />
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0 gap-1 text-[11px]">
                          <Clock className="h-3 w-3" />{formatDuration(t)}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
