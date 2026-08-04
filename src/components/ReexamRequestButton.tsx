import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Clock, KeyRound, XCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  testId: string;
  testTitle: string;
  studentId: string;
  classId: string;
  size?: "sm" | "default";
  onApproved?: () => void;
}

type Status = "none" | "pending" | "approved" | "rejected";

export const ReexamRequestButton = ({ testId, testTitle, studentId, classId, size = "sm", onApproved }: Props) => {
  const [status, setStatus] = useState<Status>("none");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadStatus = async () => {
    const { data } = await supabase
      .from("reexam_requests")
      .select("id, status, used_at")
      .eq("student_id", studentId)
      .eq("test_id", testId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data && !data.used_at) {
      setStatus(data.status as Status);
      setRequestId(data.id);
      if (data.status === "approved") onApproved?.();
    } else {
      setStatus("none");
      setRequestId(null);
    }
  };

  useEffect(() => {
    loadStatus();
    const channel = supabase
      .channel(`reexam-req-${studentId}-${testId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reexam_requests", filter: `student_id=eq.${studentId}` },
        () => loadStatus()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, testId]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const { data: cls } = await supabase.from("classes").select("teacher_id").eq("id", classId).maybeSingle();
    if (!cls) {
      toast.error("Class not found");
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.from("reexam_requests").insert({
      test_id: testId,
      student_id: studentId,
      class_id: classId,
      teacher_id: cls.teacher_id,
      message: message.trim() || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Request sent to your teacher");
      setOpen(false);
      setMessage("");
      loadStatus();
    }
    setSubmitting(false);
  };

  const handleCancel = async () => {
    if (!requestId) return;
    const { error } = await supabase.from("reexam_requests").delete().eq("id", requestId);
    if (error) toast.error(error.message);
    else {
      toast.success("Request cancelled");
      loadStatus();
    }
  };

  if (status === "approved") {
    return (
      <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/15">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Re-exam allowed
      </Badge>
    );
  }

  if (status === "pending") {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-warning border-warning/40">
          <Clock className="h-3 w-3 mr-1" /> Awaiting approval
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
        <Button size={size} variant="outline" className="gap-1.5">
          <KeyRound className="h-4 w-4" /> Request Re-exam
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request permission to re-take</DialogTitle>
          <DialogDescription>
            Ask your teacher to reopen “{testTitle}” for you. They can approve or reject the request.
          </DialogDescription>
        </DialogHeader>
        {status === "rejected" && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <XCircle className="h-4 w-4 text-destructive mt-0.5" />
            <span>Your previous request was rejected. You can send a new one with more details.</span>
          </div>
        )}
        <div className="space-y-2">
          <label className="text-sm font-medium">Reason (optional)</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Why do you need to take this test again?"
            rows={3}
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Sending..." : "Send Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
