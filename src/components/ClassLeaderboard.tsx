import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Medal, Crown, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV } from "@/lib/csv";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Class } from "@/types";
import { getQuestionRemark, isAnswered, isAnswerCorrect, normalizeQuestionTime } from "@/lib/answers";

interface LeaderboardRow {
  studentId: string;
  name: string;
  email: string;
  attempts: number;
  avgScore: number;
  bestScore: number;
}

interface Props {
  classes: Class[];
  /** When set, viewer is a student — highlights their row and hides email column. */
  currentStudentEmail?: string;
  defaultClassId?: string;
  /** When provided, rows become clickable (teacher view) to open student history. */
  onSelectStudent?: (studentId: string, studentName: string) => void;
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("") || "?";

export const ClassLeaderboard = ({ classes, currentStudentEmail, defaultClassId, onSelectStudent }: Props) => {
  const [classId, setClassId] = useState<string>(defaultClassId || classes[0]?.id || "");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingStudent, setDownloadingStudent] = useState<string | null>(null);

  useEffect(() => {
    if (defaultClassId && defaultClassId !== "all") setClassId(defaultClassId);
  }, [defaultClassId]);

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        // Get all students in this class
        const { data: students } = await supabase
          .from("students")
          .select("id, name, email")
          .eq("class_id", classId);

        const studentIds = (students || []).map((s) => s.id);
        if (!studentIds.length) {
          if (!cancelled) setRows([]);
          return;
        }

        const { data: attempts } = await supabase
          .from("test_attempts")
          .select("student_id, score, status")
          .in("student_id", studentIds)
          .eq("status", "completed");

        const byStudent = new Map<string, number[]>();
        (attempts || []).forEach((a) => {
          const list = byStudent.get(a.student_id) || [];
          list.push(a.score);
          byStudent.set(a.student_id, list);
        });

        const built: LeaderboardRow[] = (students || []).map((s) => {
          const scores = byStudent.get(s.id) || [];
          const avg = scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : 0;
          const best = scores.length ? Math.max(...scores) : 0;
          return {
            studentId: s.id,
            name: s.name,
            email: s.email,
            attempts: scores.length,
            avgScore: Math.round(avg * 10) / 10,
            bestScore: best,
          };
        });

        built.sort((a, b) => {
          if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
          if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
          return b.attempts - a.attempts;
        });

        if (!cancelled) setRows(built);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [classId]);

  const className = classes.find((c) => c.id === classId)?.name || "Class";
  const myRank = useMemo(() => {
    if (!currentStudentEmail) return null;
    const idx = rows.findIndex((r) => r.email.toLowerCase() === currentStudentEmail.toLowerCase());
    return idx >= 0 ? idx + 1 : null;
  }, [rows, currentStudentEmail]);

  // Only rank students who have at least one attempt
  const ranked = useMemo(() => rows.filter((r) => r.attempts > 0), [rows]);
  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  const handleExport = () => {
    const exportRows = ranked.map((r, i) => ({
      Rank: i + 1,
      Name: r.name,
      ...(currentStudentEmail ? {} : { Email: r.email }),
      Attempts: r.attempts,
      "Average Score (%)": r.avgScore,
      "Best Score (%)": r.bestScore,
    }));
    downloadCSV(`leaderboard-${className.replace(/\s+/g, "_")}.csv`, exportRows);
  };

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-4 w-4 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-4 w-4 text-zinc-400" />;
    if (rank === 3) return <Medal className="h-4 w-4 text-amber-700" />;
    return <span className="text-xs font-mono text-muted-foreground w-4 text-center">{rank}</span>;
  };

  // Podium visual config for top 3 (order: 2nd, 1st, 3rd)
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean) as LeaderboardRow[];
  const podiumMeta = (r: LeaderboardRow) => {
    const rank = ranked.indexOf(r) + 1;
    if (rank === 1)
      return {
        rank,
        ring: "ring-yellow-400",
        bg: "bg-gradient-to-b from-yellow-400/20 to-transparent",
        badge: "bg-yellow-400 text-yellow-950",
        size: "h-16 w-16 text-lg",
        icon: <Crown className="h-5 w-5 text-yellow-500" />,
        pad: "pt-0",
      };
    if (rank === 2)
      return {
        rank,
        ring: "ring-zinc-300",
        bg: "bg-gradient-to-b from-zinc-300/20 to-transparent",
        badge: "bg-zinc-300 text-zinc-900",
        size: "h-14 w-14 text-base",
        icon: <Medal className="h-4 w-4 text-zinc-400" />,
        pad: "pt-4",
      };
    return {
      rank,
      ring: "ring-amber-600",
      bg: "bg-gradient-to-b from-amber-600/20 to-transparent",
      badge: "bg-amber-600 text-amber-50",
      size: "h-14 w-14 text-base",
      icon: <Medal className="h-4 w-4 text-amber-700" />,
      pad: "pt-6",
    };
  };

  const downloadStudentReport = async (r: LeaderboardRow) => {
    setDownloadingStudent(r.studentId);
    try {
      const { data: attempts } = await supabase
        .from("test_attempts")
        .select("*")
        .eq("student_id", r.studentId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1);
      const attempt = (attempts || [])[0];
      if (!attempt) {
        alert("No attempts found for this student.");
        return;
      }

      const { data: testRows } = await supabase.from("tests").select("*").eq("id", attempt.test_id).limit(1);
      const test = (testRows || [])[0];
      if (!test) {
        alert("Test information not found.");
        return;
      }

      const testQuestions = (test.questions as any[]) || [];
      const questionsHtml = testQuestions
        .map((q: any, i: number) => {
          const ans = (attempt.answers || [])[i];
          const answered = isAnswered(ans);
          const correct = isAnswerCorrect(ans, q.correctAnswer);
          const t = normalizeQuestionTime((attempt.question_times || [])[i] ?? 0);
          const statusIcon = correct ? "✓" : !answered ? "⚠" : "✗";
          const statusColor = correct ? "color:#047857" : !answered ? "color:#92400e" : "color:#b91c1c";
          const remark = getQuestionRemark(correct, t, answered);

          const optionsHtml = (q.options || [])
            .map((opt: string, oi: number) => {
              const isUser = Number(ans) === oi;
              const isCorrect = Number(q.correctAnswer) === oi;
              let optClass = "color:#111827";
              if (isCorrect) optClass = "font-weight:700;color:#047857";
              else if (isUser && !isCorrect) optClass = "text-decoration:line-through;color:#991b1b";
              return `<div style="margin-bottom:3px;padding:2px 4px;border:1px solid #d1d5db;${optClass};font-size:12px">(${String.fromCharCode(65 + oi)}) ${opt}${isCorrect ? ' <span style="color:#047857">✓</span>' : isUser && !isCorrect ? ' <span style="color:#dc2626">✗</span>' : ""}</div>`;
            })
            .join("");

          return `
            <div style="padding:8px;border:1px solid #d1d5db;margin-bottom:0;font-size:11px;color:#111827;">
              <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:4px">
                <div style="width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;background-color:#111827;color:white;font-weight:bold;font-size:10px;flex-shrink:0">${i + 1}</div>
                <div style="flex:1"><div style="font-weight:700;margin-bottom:2px;line-height:1.25;color:#111827">${q.question || ""}</div></div>
                <span style="font-weight:bold;padding:2px 4px;border-radius:3px;${statusColor};font-size:10px">${statusIcon}</span>
              </div>
              <div style="margin-left:26px">${optionsHtml}</div>
              <div style="margin-left:26px;margin-top:3px;font-size:10px;color:#374151;font-weight:600">
                <span style="margin-right:8px">Time: ${Math.floor(t / 60)}m ${t % 60}s</span>
                <span>Remark: <span style="color:#047857;font-weight:700">${remark}</span></span>
              </div>
            </div>`;
        })
        .join("");

      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.width = "900px";
      container.style.background = "white";
      container.style.color = "#111827";
      container.style.padding = "24px";

      const fullMarks = testQuestions.length;
      const marksObtained = Math.round((fullMarks * attempt.score) / 100);

      container.innerHTML = `
        <div style="font-family:Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#111827">
          <h1 style="font-size:22px;margin-bottom:8px;font-weight:800;color:#0f172a">Analysis Report — ${r.name}</h1>
          <p style="margin:0 0 6px 0; color:#1f2937;font-weight:600">Test: ${test.title} • Class: ${className}</p>
          <p style="margin:0 0 12px 0; color:#1f2937;font-weight:600">Marks: ${marksObtained} / ${fullMarks} • Score: ${attempt.score}% • Total time: ${Math.floor(attempt.time_spent / 60)}m ${attempt.time_spent % 60}s</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border:2px solid #000;border-collapse:collapse">
            ${questionsHtml}
          </div>
          <p style="font-size:11px;color:#4b5563;margin-top:12px;font-weight:600">Generated on ${new Date().toLocaleString()}</p>
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
      pdf.save(`${r.name.replace(/\s+/g, "_")}_analysis.pdf`);
      document.body.removeChild(container);
    } catch (err: any) {
      alert(err?.message || "Failed to generate report");
    } finally {
      setDownloadingStudent(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-5 w-5 text-primary" />
              Leaderboard
            </CardTitle>
            <CardDescription>
              {currentStudentEmail && myRank
                ? `You are ranked #${myRank} of ${ranked.length}`
                : `Top performers in ${className}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {classes.length > 1 && (
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" className="h-8" onClick={handleExport} disabled={!ranked.length}>
              <Download className="h-3.5 w-3.5 mr-1" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
        ) : ranked.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No attempts yet in this class.</p>
        ) : (
          <div className="space-y-4">
            {/* Podium — top 3 */}
            {podium.length > 0 && (
              <div className="grid grid-cols-3 gap-2 items-end rounded-xl border bg-muted/30 p-3">
                {podiumOrder.map((r) => {
                  const meta = podiumMeta(r);
                  const isMe =
                    currentStudentEmail && r.email.toLowerCase() === currentStudentEmail.toLowerCase();
                  return (
                    <button
                      key={r.studentId}
                      onClick={onSelectStudent ? () => onSelectStudent(r.studentId, r.name) : undefined}
                      className={`flex flex-col items-center text-center rounded-lg p-2 ${meta.pad} ${meta.bg} ${
                        onSelectStudent ? "cursor-pointer hover:bg-muted/60" : ""
                      } ${isMe ? "ring-2 ring-primary" : ""}`}
                    >
                      <div className="mb-1">{meta.icon}</div>
                      <div
                        className={`relative rounded-full grid place-items-center font-bold text-primary-foreground bg-primary ring-2 ${meta.ring} ${meta.size}`}
                      >
                        {initials(r.name)}
                        <span
                          className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full grid place-items-center text-[10px] font-bold ${meta.badge}`}
                        >
                          {meta.rank}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold leading-tight truncate max-w-full">
                        {r.name}
                        {isMe && <span className="text-primary"> (You)</span>}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Avg {r.avgScore}%</p>
                      <p className="text-[10px] text-muted-foreground">Best {r.bestScore}%</p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Remaining ranks */}
            {rest.length > 0 && (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {rest.map((r) => {
                  const rank = ranked.indexOf(r) + 1;
                  const isMe =
                    currentStudentEmail && r.email.toLowerCase() === currentStudentEmail.toLowerCase();
                  return (
                    <div
                      key={r.studentId}
                      onClick={onSelectStudent ? () => onSelectStudent(r.studentId, r.name) : undefined}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md border ${
                        isMe ? "bg-primary/10 border-primary/40" : "bg-card hover:bg-muted/40"
                      } ${onSelectStudent ? "cursor-pointer" : ""}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-6 flex justify-center">{rankIcon(rank)}</div>
                        <div className="h-8 w-8 shrink-0 rounded-full grid place-items-center bg-muted text-xs font-semibold">
                          {initials(r.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {r.name} {isMe && <span className="text-xs text-primary">(You)</span>}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {r.attempts} attempt{r.attempts === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[11px]">
                          Best {r.bestScore}%
                        </Badge>
                        <Badge
                          variant={r.avgScore >= 80 ? "default" : r.avgScore >= 60 ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          Avg {r.avgScore}%
                        </Badge>
                        {onSelectStudent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={downloadingStudent === r.studentId}
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadStudentReport(r);
                            }}
                          >
                            {downloadingStudent === r.studentId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
