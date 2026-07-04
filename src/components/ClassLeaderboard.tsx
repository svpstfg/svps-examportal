import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Medal, Crown, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV } from "@/lib/csv";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Class } from "@/types";

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
          .select("student_id, score")
          .in("student_id", studentIds);

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

  const handleExport = () => {
    const exportRows = rows.map((r, i) => ({
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
                ? `You are ranked #${myRank} of ${rows.length}`
                : "Top performers by average score"}
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
            <Button variant="outline" size="sm" className="h-8" onClick={handleExport} disabled={!rows.length}>
              <Download className="h-3.5 w-3.5 mr-1" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No attempts yet in this class.</p>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {rows.slice(0, 50).map((r, i) => {
              const rank = i + 1;
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
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {r.name} {isMe && <span className="text-xs text-primary">(You)</span>}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{r.attempts} attempt{r.attempts === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[11px]">Best {r.bestScore}%</Badge>
                    <Badge
                      variant={r.avgScore >= 80 ? "default" : r.avgScore >= 60 ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      Avg {r.avgScore}%
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const sid = r.studentId;
                        setDownloadingStudent(sid);
                        try {
                          // load latest attempt for student
                          const { data: attempts } = await supabase
                            .from("test_attempts")
                            .select("*")
                            .eq("student_id", sid)
                            .order("completed_at", { ascending: false })
                            .limit(1);
                          const attempt = (attempts || [])[0];
                          if (!attempt) {
                            alert("No attempts found for this student.");
                            return;
                          }

                          const { data: testRows } = await supabase
                            .from("tests")
                            .select("*")
                            .eq("id", attempt.test_id)
                            .limit(1);
                          const test = (testRows || [])[0];
                          if (!test) {
                            alert("Test information not found.");
                            return;
                          }

                          const payloadQuestions = (test.questions || []).map((q: any, i: number) => {
                            const ans = (attempt.answers || [])[i];
                            const answered = ans !== undefined && ans !== null && ans >= 0;
                            return {
                              index: i,
                              question: q.question || "",
                              correct: answered && ans === q.correctAnswer,
                              answered,
                              timeSec: (attempt.question_times || [])[i] || 0,
                            };
                          });

                          const { data, error } = await supabase.functions.invoke("student-analysis", {
                            body: {
                              studentName: r.name,
                              testTitle: test.title,
                              subject: undefined,
                              className: className,
                              scorePct: attempt.score,
                              fullMarks: (test.questions || []).length,
                              marksObtained: Math.round(((test.questions || []).length * attempt.score) / 100),
                              totalTimeSec: attempt.time_spent || 0,
                              questions: payloadQuestions,
                            },
                          });

                          if (error) {
                            const msg = (await error.context?.json?.())?.error;
                            throw new Error(msg || error.message);
                          }
                          if (data?.error) throw new Error(data.error);

                          const report = data?.report || "No report generated.";

                          // render simple printable report and generate PDF
                          const container = document.createElement("div");
                          container.style.position = "fixed";
                          container.style.left = "-9999px";
                          container.style.width = "800px";
                          container.style.background = "white";
                          container.style.color = "black";
                          container.style.padding = "24px";
                          container.innerHTML = `
                            <div style="font-family:Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#111">
                              <h1 style="font-size:20px;margin-bottom:8px;">Analysis Report — ${r.name}</h1>
                              <p style="margin:0 0 12px 0; color:#555">Test: ${test.title} • Class: ${className}</p>
                              <pre style="white-space:pre-wrap;font-size:12px;line-height:1.4">${report}</pre>
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
                          pdf.save(`${r.name.replace(/\s+/g, "_")}_analysis.pdf`);
                          document.body.removeChild(container);
                        } catch (err: any) {
                          alert(err?.message || "Failed to generate report");
                        } finally {
                          setDownloadingStudent(null);
                        }
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
