import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Crown, Check, X, Clock, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

interface RequestRow {
  id: string;
  student_id: string;
  class_id: string;
  status: string;
  message: string | null;
  created_at: string;
  responded_at: string | null;
  approved_duration_days: number | null;
  student_name?: string;
  student_email?: string;
  class_name?: string;
}

const DURATION_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "6 months" },
  { value: "365", label: "1 year" },
  { value: "0", label: "Permanent (no expiry)" },
  { value: "custom", label: "Custom days..." },
];

export const UpgradeRequestsManager = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<RequestRow | null>(null);
  const [duration, setDuration] = useState("30");
  const [customDays, setCustomDays] = useState("60");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("upgrade_requests")
      .select("*")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });

    if (!data) {
      setLoading(false);
      return;
    }

    const studentIds = [...new Set(data.map((r) => r.student_id))];
    const classIds = [...new Set(data.map((r) => r.class_id))];

    const [{ data: students }, { data: classes }] = await Promise.all([
      supabase.from("students").select("id, name, email").in("id", studentIds),
      supabase.from("classes").select("id, name").in("id", classIds),
    ]);

    const studentMap = new Map((students || []).map((s) => [s.id, s]));
    const classMap = new Map((classes || []).map((c) => [c.id, c]));

    setRequests(
      data.map((r) => ({
        ...r,
        student_name: studentMap.get(r.student_id)?.name,
        student_email: studentMap.get(r.student_id)?.email,
        class_name: classMap.get(r.class_id)?.name,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      .channel("teacher-upgrade-reqs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "upgrade_requests", filter: `teacher_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleApprove = async () => {
    if (!approving) return;
    const days = duration === "custom" ? parseInt(customDays) : parseInt(duration);
    if (duration === "custom" && (!days || days <= 0)) {
      toast.error("Enter a valid number of days");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("approve_upgrade_request", {
      _request_id: approving.id,
      _duration_days: days === 0 ? null : days,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`${approving.student_name} upgraded to Pro`);
      setApproving(null);
      load();
    }
    setSubmitting(false);
  };

  const handleReject = async (req: RequestRow) => {
    const { error } = await supabase.rpc("reject_upgrade_request", { _request_id: req.id });
    if (error) toast.error(error.message);
    else {
      toast.success("Request rejected");
      load();
    }
  };

  const pending = requests.filter((r) => r.status === "pending");
  const handled = requests.filter((r) => r.status !== "pending");

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-warning" /> Pro Upgrade Requests
            {pending.length > 0 && (
              <Badge className="bg-destructive text-destructive-foreground ml-1">{pending.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>Review and approve student requests to upgrade to Pro tier</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">
                Pending {pending.length > 0 && `(${pending.length})`}
              </TabsTrigger>
              <TabsTrigger value="handled">History</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4 space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Loading...</p>
              ) : pending.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No pending requests</p>
              ) : (
                pending.map((r) => (
                  <div key={r.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold">{r.student_name || r.student_email}</h4>
                          <Badge variant="outline" className="text-xs">
                            {r.class_name}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{r.student_email}</p>
                        {r.message && (
                          <div className="mt-2 flex items-start gap-2 text-sm bg-muted/50 rounded p-2">
                            <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                            <span>{r.message}</span>
                          </div>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(r.created_at), "PPp")}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button size="sm" onClick={() => setApproving(r)} className="gap-1">
                          <Check className="h-4 w-4" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleReject(r)} className="gap-1">
                          <X className="h-4 w-4" /> Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="handled" className="mt-4 space-y-2">
              {handled.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No history yet</p>
              ) : (
                handled.map((r) => (
                  <div key={r.id} className="flex items-center justify-between border rounded-lg p-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.student_name || r.student_email}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.class_name} · {r.responded_at && format(new Date(r.responded_at), "PP")}
                      </p>
                    </div>
                    <Badge
                      variant={r.status === "approved" ? "default" : "secondary"}
                      className={r.status === "approved" ? "bg-success text-success-foreground" : ""}
                    >
                      {r.status === "approved"
                        ? `Approved (${r.approved_duration_days ? `${r.approved_duration_days}d` : "permanent"})`
                        : "Rejected"}
                    </Badge>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Pro Upgrade</DialogTitle>
            <DialogDescription>
              Grant Pro access to <strong>{approving?.student_name}</strong> for{" "}
              <strong>{approving?.class_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {duration === "custom" && (
              <div className="space-y-2">
                <Label>Number of days</Label>
                <Input
                  type="number"
                  min={1}
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApproving(null)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={submitting}>
              <Check className="h-4 w-4 mr-2" />
              {submitting ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
