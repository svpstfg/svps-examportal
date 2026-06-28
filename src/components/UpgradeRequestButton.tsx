import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Crown, Clock, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  studentId: string;
  classId: string;
  className?: string;
  size?: "sm" | "default";
}

type Status = "none" | "pending" | "approved" | "rejected";

export const UpgradeRequestButton = ({ studentId, classId, className: cls, size = "sm" }: Props) => {
  const [status, setStatus] = useState<Status>("none");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadStatus = async () => {
    const { data } = await supabase
      .from("upgrade_requests")
      .select("id, status")
      .eq("student_id", studentId)
      .eq("class_id", classId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setStatus(data.status as Status);
      setRequestId(data.id);
    } else {
      setStatus("none");
      setRequestId(null);
    }
  };

  useEffect(() => {
    loadStatus();
    const channel = supabase
      .channel(`upgrade-req-${studentId}-${classId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "upgrade_requests", filter: `student_id=eq.${studentId}` },
        () => loadStatus()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, classId]);

  const handleSubmit = async () => {
    setSubmitting(true);
    // Find teacher_id
    const { data: cls } = await supabase.from("classes").select("teacher_id").eq("id", classId).maybeSingle();
    if (!cls) {
      toast.error("Class not found");
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.from("upgrade_requests").insert({
      student_id: studentId,
      class_id: classId,
      teacher_id: cls.teacher_id,
      message: message.trim() || null,
    });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Request already pending" : error.message);
    } else {
      toast.success("Upgrade request sent to your teacher");
      setOpen(false);
      setMessage("");
      loadStatus();
    }
    setSubmitting(false);
  };

  const handleCancel = async () => {
    if (!requestId) return;
    const { error } = await supabase.from("upgrade_requests").delete().eq("id", requestId);
    if (error) toast.error(error.message);
    else {
      toast.success("Request cancelled");
      loadStatus();
    }
  };

  if (status === "approved") {
    return (
      <Badge className="bg-warning/15 text-warning border-warning/30 hover:bg-warning/15">
        <Crown className="h-3 w-3 mr-1" /> Pro Active
      </Badge>
    );
  }

  if (status === "pending") {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-warning border-warning/40">
          <Clock className="h-3 w-3 mr-1" /> Pending review
        </Badge>
        <Button size={size} variant="ghost" onClick={handleCancel} className="text-xs h-7">
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant="default" className="gap-1.5">
          <Crown className="h-4 w-4" /> Request Pro Upgrade
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Pro Access</DialogTitle>
          <DialogDescription>
            {cls ? `Send an upgrade request to your teacher for "${cls}". ` : ""}
            They will be notified immediately and can approve or reject your request.
          </DialogDescription>
        </DialogHeader>
        {status === "rejected" && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <XCircle className="h-4 w-4 text-destructive mt-0.5" />
            <span>Your previous request was rejected. You can send a new one with additional context.</span>
          </div>
        )}
        <div className="space-y-2">
          <label className="text-sm font-medium">Message to teacher (optional)</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Why would you like Pro access?"
            rows={3}
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {submitting ? "Sending..." : "Send Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
