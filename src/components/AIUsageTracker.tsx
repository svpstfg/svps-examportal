import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Download, RefreshCw, Sparkles, User, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { downloadCSV } from "@/lib/csv";
import { format } from "date-fns";
import { toast } from "sonner";

interface UsageLog {
  id: string;
  user_id: string | null;
  user_role: string;
  student_id: string | null;
  class_id: string | null;
  feature: string;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

const FEATURE_LABELS: Record<string, string> = {
  student_analysis: "Student AI Analysis",
  questions_from_images: "Questions from Images",
};

const RANGES = [
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "all", label: "All time" },
];

export const AIUsageTracker = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [classNames, setClassNames] = useState<Record<string, string>>({});
  const [range, setRange] = useState("30");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from("ai_usage_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (range !== "all") {
        const since = new Date();
        since.setDate(since.getDate() - Number(range));
        query = query.gte("created_at", since.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data || []) as unknown as UsageLog[];
      setLogs(rows);

      const studentIds = Array.from(new Set(rows.map((r) => r.student_id).filter(Boolean))) as string[];
      const classIds = Array.from(new Set(rows.map((r) => r.class_id).filter(Boolean))) as string[];

      if (studentIds.length) {
        const { data: st } = await supabase.from("students").select("id, name, email").in("id", studentIds);
        setStudentNames(Object.fromEntries((st || []).map((s) => [s.id, s.name || s.email])));
      }
      if (classIds.length) {
        const { data: cl } = await supabase.from("classes").select("id, name").in("id", classIds);
        setClassNames(Object.fromEntries((cl || []).map((c) => [c.id, c.name])));
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load AI usage");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, range]);

  const totals = useMemo(() => {
    const totalCalls = logs.length;
    const failed = logs.filter((l) => l.status !== "success").length;
    const tokens = logs.reduce((s, l) => s + (l.total_tokens || 0), 0);
    const byStudent = logs.filter((l) => l.student_id).length;
    return { totalCalls, failed, tokens, byStudent };
  }, [logs]);

  const byFeature = useMemo(() => {
    const map = new Map<string, { calls: number; tokens: number }>();
    for (const l of logs) {
      const k = l.feature;
      const cur = map.get(k) || { calls: 0, tokens: 0 };
      cur.calls += 1;
      cur.tokens += l.total_tokens || 0;
      map.set(k, cur);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].calls - a[1].calls);
  }, [logs]);

  const byStudent = useMemo(() => {
    const map = new Map<string, { calls: number; tokens: number; classId: string | null; last: string }>();
    for (const l of logs) {
      if (!l.student_id) continue;
      const cur = map.get(l.student_id) || { calls: 0, tokens: 0, classId: l.class_id, last: l.created_at };
      cur.calls += 1;
      cur.tokens += l.total_tokens || 0;
      if (l.created_at > cur.last) cur.last = l.created_at;
      map.set(l.student_id, cur);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].tokens - a[1].tokens);
  }, [logs]);

  const byActor = useMemo(() => {
    const map = new Map<string, { calls: number; tokens: number }>();
    for (const l of logs) {
      const k = l.user_role === "student" ? "Students" : "Teacher (you)";
      const cur = map.get(k) || { calls: 0, tokens: 0 };
      cur.calls += 1;
      cur.tokens += l.total_tokens || 0;
      map.set(k, cur);
    }
    return Array.from(map.entries());
  }, [logs]);

  const exportCsv = () => {
    downloadCSV(
      `ai-usage-${format(new Date(), "yyyy-MM-dd")}`,
      logs.map((l) => ({
        Date: format(new Date(l.created_at), "yyyy-MM-dd HH:mm"),
        Feature: FEATURE_LABELS[l.feature] || l.feature,
        "Triggered by": l.user_role,
        Student: l.student_id ? studentNames[l.student_id] || l.student_id : "",
        Class: l.class_id ? classNames[l.class_id] || "" : "",
        Model: l.model || "",
        "Prompt tokens": l.prompt_tokens,
        "Completion tokens": l.completion_tokens,
        "Total tokens": l.total_tokens,
        Status: l.status,
        Error: l.error_message || "",
      })),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" /> AI Usage Tracker
          </h2>
          <p className="text-sm text-muted-foreground">
            Every AI request made by you and your students, with token usage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={!logs.length}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "AI requests", value: totals.totalCalls, icon: Sparkles },
          { label: "Total tokens", value: totals.tokens.toLocaleString(), icon: Activity },
          { label: "Student-related", value: totals.byStudent, icon: Users },
          { label: "Failed calls", value: totals.failed, icon: User },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
                <s.icon className="h-5 w-5 text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="students" className="space-y-4">
        <TabsList>
          <TabsTrigger value="students">Per student</TabsTrigger>
          <TabsTrigger value="features">Per feature</TabsTrigger>
          <TabsTrigger value="log">Call log</TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage by student</CardTitle>
              <CardDescription>AI reports generated for each student.</CardDescription>
            </CardHeader>
            <CardContent>
              {byStudent.length === 0 ? (
                <p className="text-sm text-muted-foreground">No student AI usage in this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead>Last used</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byStudent.map(([id, v]) => (
                      <TableRow key={id}>
                        <TableCell className="font-medium">{studentNames[id] || "Unknown"}</TableCell>
                        <TableCell>{v.classId ? classNames[v.classId] || "—" : "—"}</TableCell>
                        <TableCell className="text-right">{v.calls}</TableCell>
                        <TableCell className="text-right">{v.tokens.toLocaleString()}</TableCell>
                        <TableCell>{format(new Date(v.last), "dd MMM yyyy, HH:mm")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage by feature</CardTitle>
            </CardHeader>
            <CardContent>
              {byFeature.length === 0 ? (
                <p className="text-sm text-muted-foreground">No AI usage yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feature</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byFeature.map(([f, v]) => (
                      <TableRow key={f}>
                        <TableCell className="font-medium">{FEATURE_LABELS[f] || f}</TableCell>
                        <TableCell className="text-right">{v.calls}</TableCell>
                        <TableCell className="text-right">{v.tokens.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Who triggered the AI</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {byActor.length === 0 ? (
                <p className="text-sm text-muted-foreground">No AI usage yet.</p>
              ) : (
                byActor.map(([k, v]) => (
                  <div key={k} className="rounded-lg border p-4 min-w-[180px]">
                    <p className="text-xs text-muted-foreground">{k}</p>
                    <p className="text-xl font-bold">{v.calls} requests</p>
                    <p className="text-xs text-muted-foreground">{v.tokens.toLocaleString()} tokens</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="log">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent AI calls</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[560px] overflow-auto">
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No AI calls recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Feature</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(l.created_at), "dd MMM, HH:mm")}
                        </TableCell>
                        <TableCell>{FEATURE_LABELS[l.feature] || l.feature}</TableCell>
                        <TableCell>{l.student_id ? studentNames[l.student_id] || "—" : "—"}</TableCell>
                        <TableCell className="text-right">{(l.total_tokens || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={l.status === "success" ? "secondary" : "destructive"}>
                            {l.status === "success" ? "Success" : l.error_message || "Failed"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
