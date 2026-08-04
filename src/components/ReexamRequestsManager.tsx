import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { KeyRound, Check, X, Clock, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

interface RequestRow {
  id: string;
  test_id: string;
  student_id: string;
  class_id: string;
  status: string;
  message: string | null;
  created_at: string;
  responded_at: string | null;
  used_at: string | null;
  student_name?: string;
  student_email?: string;
  class_name?: string;
  test_title?: string;
}

export const ReexamRequestsManager = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("reexam_requests")
      .select("*")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });

    if (!data) {
      setLoading(false);
      return;
    }

    const studentIds = [...new Set(data.map((r) => r.student_id))];
    const classIds = [...new Set(data.map((r) => r.class_id))];
    const testIds = [...new Set(data.map((r) => r.test_id))];

    const [{ data: students }, { data: classes }, { data: tests }] = await Promise.all([
      supabase.from("students").select("id, name, email").in("id", studentIds),
      supabase.from("classes").select("id, name").in("id", classIds),
      supabase.from("tests").select("id, title").in("id", testIds),
    ]);

    const studentMap = new Map((students || []).map((s) => [s.id, s]));
    const classMap = new Map((classes || []).map((c) => [c.id, c]));
    const testMap = new Map((tests || []).map((t) => [t.id, t]));

    setRequests(
      data.map((r) => ({
        ...r,
        student_name: studentMap.get(r.student_id)?.name,
        student_email: studentMap.get(r.student_id)?.email,
        class_name: classMap.get(r.class_id)?.name,
        test_title: testMap.get(r.test_id)?.title,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      .channel("reexam-requests-teacher")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reexam_requests", filter: `teacher_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const respond = async (req: RequestRow, status: "approved" | "rejected") => {
    setBusy(req.id);
    const { error } = await supabase
      .from("reexam_requests")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", req.id);
    if (error) toast.error(error.message);
    else {
      toast.success(status === "approved" ? "Re-exam allowed" : "Request rejected");
      load();
    }
    setBusy(null);
  };

  const pending = requests.filter((r) => r.status === "pending");
  const handled = requests.filter((r) => r.status !== "pending");

  const Row = ({ r }: { r: RequestRow }) => (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{r.student_name || "Unknown student"}</p>
          <p className="text-xs text-muted-foreground">{r.student_email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{r.class_name}</Badge>
          {r.status === "pending" ? (
            <Badge variant="outline" className="text-warning border-warning/40">
              <Clock className="h-3 w-3 mr-1" /> Pending
            </Badge>
          ) : (
            <Badge variant={r.status === "approved" ? "default" : "destructive"}>{r.status}</Badge>
          )}
          {r.used_at && <Badge variant="secondary">Re-exam taken</Badge>}
        </div>
      </div>
      <p className="text-sm">
        Test: <span className="font-medium">{r.test_title || r.test_id}</span>
      </p>
      {r.message && (
        <p className="text-sm text-muted-foreground flex items-start gap-1.5">
          <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" /> {r.message}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Requested {format(new Date(r.created_at), "dd MMM yyyy, p")}
      </p>
      {r.status === "pending" && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" disabled={busy === r.id} onClick={() => respond(r, "approved")}>
            <Check className="h-4 w-4 mr-1" /> Allow re-exam
          </Button>
          <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => respond(r, "rejected")}>
            <X className="h-4 w-4 mr-1" /> Reject
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <KeyRound className="h-6 w-6 text-primary" /> Re-exam Requests
        </h2>
        <p className="text-sm text-muted-foreground">
          Students ask here when a test is closed or limited to a single attempt.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
          <CardDescription>Approve to give the student one extra attempt.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <Tabs defaultValue="pending">
              <TabsList>
                <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
                <TabsTrigger value="handled">Handled ({handled.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="pending" className="space-y-3 mt-4">
                {pending.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">No pending requests</p>
                ) : (
                  pending.map((r) => <Row key={r.id} r={r} />)
                )}
              </TabsContent>
              <TabsContent value="handled" className="space-y-3 mt-4">
                {handled.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">Nothing here yet</p>
                ) : (
                  handled.map((r) => <Row key={r.id} r={r} />)
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
