import { useEffect, useState } from "react";
import { Bot, Calendar, CheckCircle, Clock, Loader2, Settings, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

export const PortalSettings = () => {
  const [settings, setSettings] = useState({ aiReports: true, newTests: true, proTests: true, scheduledTests: true, completedTests: true });
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
        .select("student_ai_reports_enabled, student_new_tests_enabled, student_pro_tests_enabled, student_scheduled_tests_enabled, student_completed_tests_enabled")
        .eq("teacher_id", auth.user.id)
        .maybeSingle();
      if (!active) return;
      if (error) toast.error("Failed to load portal settings");
      else if (data) setSettings({ aiReports: data.student_ai_reports_enabled, newTests: data.student_new_tests_enabled, proTests: data.student_pro_tests_enabled, scheduledTests: data.student_scheduled_tests_enabled, completedTests: data.student_completed_tests_enabled });
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, []);

  const updateSetting = async (key: keyof typeof settings, next: boolean) => {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { error } = await supabase.from("teacher_settings").upsert(
        { teacher_id: auth.user.id, [key === "aiReports" ? "student_ai_reports_enabled" : key === "newTests" ? "student_new_tests_enabled" : key === "proTests" ? "student_pro_tests_enabled" : key === "scheduledTests" ? "student_scheduled_tests_enabled" : "student_completed_tests_enabled"]: next },
        { onConflict: "teacher_id" },
      );
      if (error) throw error;
      setSettings((current) => ({ ...current, [key]: next }));
      toast.success(next ? "Student portal option enabled" : "Student portal option hidden");
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
              <p className="text-sm text-muted-foreground">{settings.aiReports ? "Students can generate their report after completing a test." : "The button is hidden from students."}</p>
            </div>
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Switch id="student-ai-reports" checked={settings.aiReports} onCheckedChange={(value) => updateSetting("aiReports", value)} disabled={saving} />}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Available Tests Tabs</CardTitle><CardDescription>Choose which tabs and related tests students can see in their dashboard.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {[
            ["newTests", "New tests", "Show currently available free tests", Sparkles],
            ["proTests", "Pro tests", "Show Pro-only test tab", CheckCircle],
            ["scheduledTests", "Scheduled tests", "Show upcoming scheduled tests", Calendar],
            ["completedTests", "Completed tests", "Show completed tests and answer-sheet links", Clock],
          ].map(([key, title, description, Icon]) => <div key={String(key)} className="flex items-center justify-between gap-6 rounded-lg border p-4"><div><Label className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4 text-primary" />{title}</Label><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Switch checked={settings[key as keyof typeof settings]} onCheckedChange={(value) => updateSetting(key as keyof typeof settings, value)} disabled={saving} />}</div>)}
        </CardContent>
      </Card>
    </div>
  );
};
