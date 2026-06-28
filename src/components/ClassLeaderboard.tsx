import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Medal, Crown, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV } from "@/lib/csv";
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
