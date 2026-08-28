import { useEffect, useState } from "react";
import { Bot, Loader2, Settings, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

export const PortalSettings = () => {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (active) setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("teacher_settings")
        .select("student_ai_reports_enabled")
        .eq("teacher_id", auth.user.id)
        .maybeSingle();
      if (!active) return;
      if (error) toast.error("Failed to load portal settings");
      else if (data) setEnabled(data.student_ai_reports_enabled);
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, []);

  const updateAiReports = async (next: boolean) => {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { error } = await supabase.from("teacher_settings").upsert(
        { teacher_id: auth.user.id, student_ai_reports_enabled: next },
        { onConflict: "teacher_id" },
      );
      if (error) throw error;
      setEnabled(next);
      toast.success(next ? "AI Report enabled for students" : "AI Report hidden from students");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save portal settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="flex items-center gap-2 text-2xl font-semibold"><Settings className="h-6 w-6 text-primary" /> Settings</h2>
        <p className="text-sm text-muted-foreground">Control the features available in your student portal.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-5 w-5" /> Student AI Reports</CardTitle>
          <CardDescription>Allow students to generate an AI performance report from their completed answer sheet.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-6 rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="student-ai-reports" className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-primary" /> Show “AI Report” button</Label>
              <p className="text-sm text-muted-foreground">{enabled ? "Students can generate their report after completing a test." : "The button is hidden from students."}</p>
            </div>
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Switch id="student-ai-reports" checked={enabled} onCheckedChange={updateAiReports} disabled={saving} />}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
