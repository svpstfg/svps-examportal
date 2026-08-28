import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Download, Loader2, Search, Trophy, Timer, Target, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV } from "@/lib/csv";
import { isAnswered, isAnswerCorrect } from "@/lib/answers";
import { Class, Question } from "@/types";

interface Props {
  classes: Class[];
}

interface TestMeta {
  id: string;
  title: string;
  questions: Question[];
  chapterId: string;
  chapterName: string;
  courseName: string;
  classId: string;
  className: string;
  negativeMarking: number;
}

interface StudentRow {
  studentId: string;
  name: string;
  email: string;
  className: string;
  testsTaken: number;
  totalQuestions: number;
  attempted: number;
  skipped: number;
  correct: number;
  wrong: number;
  totalTime: number;
  avgTimePerAttempt: number;
  fastCorrect: number;
  accuracy: number;
  attemptRate: number;
  speedScore: number;
  consistency: number;
  improvement: number;
  confidence: "Low" | "Medium" | "High";
  talentScore: number;
  topics: Record<string, { correct: number; total: number }>;
}

const fmtTime = (s: number) => {
  if (!s || s < 0) return "—";
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m ? `${m}m ${r}s` : `${r}s`;
};

const band = (score: number) =>
  score >= 80 ? "Top talent" : score >= 65 ? "High potential" : score >= 50 ? "Steady" : score >= 35 ? "Developing" : "Needs remedial";

export const TalentSearch = ({ classes }: Props) => {
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<TestMeta[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [students, setStudents] = useState<Map<string, any>>(new Map());
  const [classFilter, setClassFilter] = useState("all");
  const [singleTest, setSingleTest] = useState<string>("");
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const classIds = classes.map((c) => c.id);
        if (!classIds.length) {
          if (!cancelled) { setTests([]); setAttempts([]); setLoading(false); }
          return;
        }
        const classMap = new Map(classes.map((c) => [c.id, c.name]));

        const { data: courses } = await supabase.from("courses").select("id, name, class_id").in("class_id", classIds);
        const courseIds = (courses || []).map((c) => c.id);
        const { data: chapters } = courseIds.length
          ? await supabase.from("chapters").select("id, name, course_id").in("course_id", courseIds)
          : { data: [] as any[] };
        const chapterIds = (chapters || []).map((c) => c.id);
        const { data: testRows } = chapterIds.length
          ? await supabase.from("tests").select("*").in("chapter_id", chapterIds)
          : { data: [] as any[] };

        const courseMap = new Map((courses || []).map((c) => [c.id, c]));
        const chapterMap = new Map((chapters || []).map((c) => [c.id, c]));

        const testMetas: TestMeta[] = (testRows || []).map((t: any) => {
          const ch: any = chapterMap.get(t.chapter_id);
          const co: any = ch ? courseMap.get(ch.course_id) : null;
          return {
            id: t.id,
            title: t.title,
            questions: (t.questions as any as Question[]) || [],
            chapterId: t.chapter_id,
            chapterName: ch?.name || "Unknown chapter",
            courseName: co?.name || "Unknown subject",
            classId: co?.class_id || "",
            className: classMap.get(co?.class_id || "") || "—",
            negativeMarking: Number(t.negative_marking) || 0,
          };
        });

        const { data: studentRows } = await supabase
          .from("students").select("id, name, email, class_id").in("class_id", classIds);
        const sMap = new Map((studentRows || []).map((s: any) => [s.id, { ...s, className: classMap.get(s.class_id) || "—" }]));

        const testIds = testMetas.map((t) => t.id);
        const { data: attemptRows } = testIds.length
          ? await supabase.from("test_attempts").select("*").in("test_id", testIds)
          : { data: [] as any[] };

        if (!cancelled) {
          setTests(testMetas);
          setStudents(sMap);
          setAttempts(attemptRows || []);
          setSingleTest((prev) => prev || testMetas[0]?.id || "");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [classes]);

  const visibleTests = useMemo(
    () => tests.filter((t) => classFilter === "all" || t.classId === classFilter),
    [tests, classFilter]
  );

  useEffect(() => {
    setSingleTest((current) =>
      visibleTests.some((test) => test.id === current) ? current : visibleTests[0]?.id || ""
    );
  }, [visibleTests]);

  const buildRows = (testIds: string[]): StudentRow[] => {
    const testById = new Map(tests.map((t) => [t.id, t]));
    const acc = new Map<string, StudentRow>();
    const perStudentScores = new Map<string, { score: number; completedAt: string }[]>();

    attempts
      .filter((a) => testIds.includes(a.test_id))
      .forEach((a) => {
        const t = testById.get(a.test_id);
        const s = students.get(a.student_id);
        if (!t || !s) return;
        const qs = t.questions || [];
        const answers: any[] = (a.answers as any) || [];
        const times: any[] = (a.question_times as any) || [];

        let row = acc.get(a.student_id);
        if (!row) {
          row = {
            studentId: a.student_id, name: s.name, email: s.email, className: s.className,
            testsTaken: 0, totalQuestions: 0, attempted: 0, skipped: 0, correct: 0, wrong: 0,
            totalTime: 0, avgTimePerAttempt: 0, fastCorrect: 0, accuracy: 0, attemptRate: 0,
            speedScore: 0, consistency: 0, improvement: 0, confidence: "Low", talentScore: 0, topics: {},
          };
          acc.set(a.student_id, row);
        }

        row.testsTaken += 1;
        row.totalQuestions += qs.length;
        row.totalTime += Number(a.time_spent) || 0;

        const topicKey = `${t.courseName} › ${t.chapterName}`;
        const topic = row.topics[topicKey] || { correct: 0, total: 0 };

        qs.forEach((q, i) => {
          const ans = answers[i];
          topic.total += 1;
          if (!isAnswered(ans)) { row!.skipped += 1; return; }
          row!.attempted += 1;
          if (isAnswerCorrect(ans, q.correctAnswer)) {
            row!.correct += 1;
            topic.correct += 1;
            const tt = Number(times[i]) || 0;
            if (tt > 0 && tt <= 45) row!.fastCorrect += 1;
          } else {
            row!.wrong += 1;
          }
        });
        row.topics[topicKey] = topic;

        const pct = qs.length ? Math.round((qs.reduce((n, q, i) => n + (isAnswerCorrect(answers[i], q.correctAnswer) ? 1 : 0), 0) / qs.length) * 100) : 0;
        perStudentScores.set(a.student_id, [...(perStudentScores.get(a.student_id) || []), { score: pct, completedAt: a.completed_at || "" }]);
      });

    const rows = Array.from(acc.values()).map((r) => {
      r.accuracy = r.attempted ? Math.round((r.correct / r.attempted) * 100) : 0;
      r.attemptRate = r.totalQuestions ? Math.round((r.attempted / r.totalQuestions) * 100) : 0;
      r.avgTimePerAttempt = r.attempted ? Math.round(r.totalTime / r.attempted) : 0;
      // speed: full marks at <=30s/question, zero at >=150s
      r.speedScore = r.avgTimePerAttempt
        ? Math.max(0, Math.min(100, Math.round(((150 - r.avgTimePerAttempt) / 120) * 100)))
        : 0;
      const scores = (perStudentScores.get(r.studentId) || []).sort(
        (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
      );
      if (scores.length > 1) {
        const mean = scores.reduce((sum, item) => sum + item.score, 0) / scores.length;
        const sd = Math.sqrt(scores.reduce((sum, item) => sum + (item.score - mean) ** 2, 0) / scores.length);
        r.consistency = Math.max(0, Math.round(100 - sd * 2));
        r.improvement = Math.max(-100, Math.min(100, scores[scores.length - 1].score - scores[0].score));
      } else {
        r.consistency = 70;
      }
      r.confidence = r.testsTaken >= 3 && r.totalQuestions >= 30 ? "High" : r.testsTaken >= 2 && r.totalQuestions >= 15 ? "Medium" : "Low";
      const fastBonus = r.correct ? (r.fastCorrect / r.correct) * 100 : 0;
      r.talentScore = Math.round(
        r.accuracy * 0.35 + r.attemptRate * 0.15 + r.speedScore * 0.15 + r.consistency * 0.15 + Math.max(0, r.improvement) * 0.1 + fastBonus * 0.1
      );
      return r;
    });

    return rows.sort((a, b) => b.talentScore - a.talentScore || b.accuracy - a.accuracy);
  };

  const filterRows = (rows: StudentRow[]) => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  };

  const singleRows = useMemo(
    () => (singleTest ? filterRows(buildRows([singleTest])) : []),
    [singleTest, tests, attempts, students, search]
  );
  const multiRows = useMemo(
    () => (selectedTests.length ? filterRows(buildRows(selectedTests)) : []),
    [selectedTests, tests, attempts, students, search]
  );

  const exportRows = (rows: StudentRow[], file: string) =>
    downloadCSV(
      file,
      rows.map((r, i) => ({
        Rank: i + 1,
        Student: r.name,
        Email: r.email,
        Class: r.className,
        Exams: r.testsTaken,
        Questions: r.totalQuestions,
        Attempted: r.attempted,
        Skipped: r.skipped,
        Correct: r.correct,
        Wrong: r.wrong,
        "Accuracy %": r.accuracy,
        "Attempt rate %": r.attemptRate,
        "Avg time / question": fmtTime(r.avgTimePerAttempt),
        "Consistency": r.consistency,
        "Improvement (points)": r.improvement,
        Confidence: r.confidence,
        "Talent score": r.talentScore,
        Band: r.confidence === "Low" ? "Provisional" : band(r.talentScore),
        "Weak topics": weakTopics(r).map((w) => `${w.topic} (${w.pct}%)`).join("; ") || "None",
      }))
    );

  const weakTopics = (r: StudentRow) =>
    Object.entries(r.topics)
      .map(([topic, v]) => ({ topic, pct: v.total ? Math.round((v.correct / v.total) * 100) : 0 }))
      .filter((t) => t.pct < 60)
      .sort((a, b) => a.pct - b.pct);

  const strongTopics = (r: StudentRow) =>
    Object.entries(r.topics)
      .map(([topic, v]) => ({ topic, pct: v.total ? Math.round((v.correct / v.total) * 100) : 0 }))
      .filter((t) => t.pct >= 75)
      .sort((a, b) => b.pct - a.pct);

  const RankTable = ({ rows }: { rows: StudentRow[] }) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Talent score</TableHead>
            <TableHead>Attempted</TableHead>
            <TableHead>Skipped</TableHead>
            <TableHead>Accuracy</TableHead>
            <TableHead>Avg time / Q</TableHead>
            <TableHead>Consistency</TableHead>
            <TableHead>Trend</TableHead>
            <TableHead>Evidence</TableHead>
            <TableHead>Band</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.studentId}>
              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
              <TableCell>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.className}</div>
              </TableCell>
              <TableCell className="w-40">
                <div className="flex items-center gap-2">
                  <Progress value={r.talentScore} className="h-2 w-20" />
                  <span className="text-sm font-semibold">{r.talentScore}</span>
                </div>
              </TableCell>
              <TableCell className="text-sm">{r.attempted}/{r.totalQuestions}</TableCell>
              <TableCell className="text-sm">{r.skipped}</TableCell>
              <TableCell className="text-sm">{r.accuracy}%</TableCell>
              <TableCell className="text-sm">{fmtTime(r.avgTimePerAttempt)}</TableCell>
              <TableCell className="text-sm">{r.consistency}</TableCell>
              <TableCell className={`text-sm font-medium ${r.improvement > 0 ? "text-emerald-600" : r.improvement < 0 ? "text-destructive" : ""}`}>
                {r.improvement > 0 ? `+${r.improvement}` : r.improvement}
              </TableCell>
              <TableCell><Badge variant={r.confidence === "High" ? "default" : "outline"}>{r.confidence}</Badge></TableCell>
              <TableCell>
                <Badge variant={r.talentScore >= 65 ? "default" : r.talentScore >= 50 ? "secondary" : "outline"}>
                  {r.confidence === "Low" ? "Provisional" : band(r.talentScore)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading talent data…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> Talent Search
        </h2>
        <p className="text-sm text-muted-foreground">
          Uses repeated exam evidence—not IQ—to identify academic potential: accuracy (35%), attempt rate (15%),
          solving speed (15%), consistency (15%), improvement trend (10%) and quick-correct answers (10%).
          Scores based on fewer than two exams are marked provisional.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student" className="pl-8 w-56" />
        </div>
        <Select value={classFilter} onValueChange={(v) => { setClassFilter(v); setSelectedTests([]); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="single">
        <TabsList>
          <TabsTrigger value="single" className="gap-1"><Trophy className="h-4 w-4" /> Per exam</TabsTrigger>
          <TabsTrigger value="custom" className="gap-1"><Target className="h-4 w-4" /> Custom list</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Talent list for one exam</CardTitle>
                <CardDescription>Pick an exam to rank every student who attempted it.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={singleTest} onValueChange={setSingleTest}>
                  <SelectTrigger className="w-64"><SelectValue placeholder="Select exam" /></SelectTrigger>
                  <SelectContent>
                    {visibleTests.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.title} — {t.courseName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" disabled={!singleRows.length} onClick={() => exportRows(singleRows, "talent-list.csv")}>
                  <Download className="h-4 w-4 mr-1" /> Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {singleRows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No attempts for this exam yet.</p>
              ) : (
                <RankTable rows={singleRows} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-6">
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Select exams ({selectedTests.length} chosen)</CardTitle>
                <CardDescription>Combine comparable exams into one list. For fair rankings, select one class and related subjects.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedTests(visibleTests.map((t) => t.id))}>Select all</Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedTests([])}>Clear</Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-56 pr-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {visibleTests.map((t) => (
                    <label key={t.id} className="flex items-start gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={selectedTests.includes(t.id)}
                        onCheckedChange={(c) =>
                          setSelectedTests((prev) => (c ? [...prev, t.id] : prev.filter((x) => x !== t.id)))
                        }
                      />
                      <span className="text-sm">
                        <span className="font-medium">{t.title}</span>
                        <span className="block text-xs text-muted-foreground">{t.courseName} › {t.chapterName} · {t.className}</span>
                      </span>
                    </label>
                  ))}
                  {visibleTests.length === 0 && <p className="text-sm text-muted-foreground">No exams found.</p>}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Combined talent list</CardTitle>
                <CardDescription>{multiRows.length} students across {selectedTests.length} exams.</CardDescription>
              </div>
              <Button variant="outline" disabled={!multiRows.length} onClick={() => exportRows(multiRows, "custom-talent-list.csv")}>
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {multiRows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">Select at least one exam with attempts.</p>
              ) : (
                <RankTable rows={multiRows} />
              )}
            </CardContent>
          </Card>

          {selectedTests.length > 1 && multiRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" /> Student summary reports
                </CardTitle>
                <CardDescription>Weak topics, strengths and remedial recommendation per student.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {multiRows.map((r) => {
                  const weak = weakTopics(r);
                  const strong = strongTopics(r);
                  const needsRemedial = r.talentScore < 50 || weak.length >= 2;
                  return (
                    <div key={r.studentId} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">{r.className} · {r.testsTaken} exams</div>
                        </div>
                        <Badge variant={needsRemedial ? "destructive" : "default"}>
                          {needsRemedial ? "Remedial class" : band(r.talentScore)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Target className="h-3 w-3" /> {r.accuracy}% accuracy</span>
                        <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> {fmtTime(r.avgTimePerAttempt)} / question</span>
                        <span>{r.skipped} skipped</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Weak topics: </span>
                        {weak.length ? weak.map((w) => `${w.topic} (${w.pct}%)`).join(", ") : "None — solid across topics."}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Strengths: </span>
                        {strong.length ? strong.map((w) => `${w.topic} (${w.pct}%)`).join(", ") : "Still building strengths."}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {needsRemedial
                          ? `Recommend remedial sessions on ${weak.slice(0, 2).map((w) => w.topic).join(" and ") || "core concepts"}, plus timed practice.`
                          : r.attemptRate < 80
                          ? "Strong accuracy but leaves questions unattempted — coach on attempting more within time."
                          : r.avgTimePerAttempt > 90
                          ? "Accurate but slow — assign speed drills and shortcut techniques."
                          : "Performing well — consider advanced or olympiad-level practice."}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
