import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { User, Mail, Shield, BookOpen, GraduationCap, KeyRound, ArrowLeft, Save, Crown } from "lucide-react";
import { UpgradeRequestButton } from "@/components/UpgradeRequestButton";

interface ProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

interface EnrolledClass {
  id: string;
  name: string;
  description: string | null;
  tier: string;
  studentRecordId: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [classes, setClasses] = useState<EnrolledClass[]>([]);
  const [taughtCount, setTaughtCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    // Fetch profile + role-specific data in parallel — don't block UI on it
    (async () => {
      const profilePromise = supabase
        .from("profiles")
        .select("id, name, email, role, created_at")
        .eq("user_id", user.id)
        .maybeSingle();

      // Kick off teacher count immediately (cheap, no dependency on profile)
      const teacherCountPromise = supabase
        .from("classes")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", user.id);

      const { data: p } = await profilePromise;
      if (cancelled) return;

      if (p) {
        setProfile(p as ProfileData);
        setName(p.name || "");
        setLoading(false);

        if (p.role === "student" && user.email) {
          const { data: studentRows } = await supabase
            .from("students")
            .select("id, class_id")
            .eq("email", user.email);
          if (cancelled || !studentRows || studentRows.length === 0) return;
          const studentIds = studentRows.map((s) => s.id);
          const { data: enrolls } = await supabase
            .from("student_enrollments")
            .select("tier, student_id, classes(id, name, description)")
            .in("student_id", studentIds);
          if (cancelled) return;
          const list: EnrolledClass[] = (enrolls || [])
            .filter((e: any) => e.classes)
            .map((e: any) => ({
              id: e.classes.id,
              name: e.classes.name,
              description: e.classes.description,
              tier: e.tier,
              studentRecordId: e.student_id,
            }));
          setClasses(list);
        } else {
          const { count } = await teacherCountPromise;
          if (!cancelled) setTaughtCount(count || 0);
        }
      } else {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSaveName = async () => {
    if (!user || !name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: name.trim() })
      .eq("user_id", user.id);

    if (!error && profile?.role === "student" && user.email) {
      await supabase
        .from("students")
        .update({ name: name.trim() })
        .eq("email", user.email);
    }

    if (error) toast.error(error.message);
    else {
      toast.success("Profile updated");
      setProfile((p) => (p ? { ...p, name: name.trim() } : p));
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated");
      setNewPassword("");
      setConfirmPassword("");
    }
    setSaving(false);
  };

  const initials = (profile?.name || user?.email || "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(profile?.role === "student" ? "/student" : "/")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Profile header card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{profile?.name || user?.email?.split("@")[0] || "User"}</h1>
                <p className="text-muted-foreground flex items-center gap-1.5 text-sm mt-1">
                  <Mail className="h-3.5 w-3.5" />
                  {profile?.email || user?.email}
                </p>
                <div className="flex gap-2 mt-2">
                  {profile ? (
                    <>
                      <Badge variant="secondary" className="capitalize">
                        {profile.role === "teacher" ? (
                          <GraduationCap className="h-3 w-3 mr-1" />
                        ) : (
                          <BookOpen className="h-3 w-3 mr-1" />
                        )}
                        {profile.role}
                      </Badge>
                      {profile.role === "student" && (
                        <Badge variant="outline">{classes.length} class{classes.length === 1 ? "" : "es"}</Badge>
                      )}
                      {profile.role === "teacher" && (
                        <Badge variant="outline">{taughtCount} class{taughtCount === 1 ? "" : "es"}</Badge>
                      )}
                    </>
                  ) : (
                    <div className="h-5 w-20 bg-muted animate-pulse rounded" />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="account" className="space-y-4">
          <TabsList>
            <TabsTrigger value="account">
              <User className="h-4 w-4 mr-2" />
              Account
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
            {profile?.role === "student" && (
              <TabsTrigger value="classes">
                <BookOpen className="h-4 w-4 mr-2" />
                My Classes
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={profile?.email || ""} disabled />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>
                <div className="space-y-2">
                  <Label>Member Since</Label>
                  <Input
                    value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : ""}
                    disabled
                  />
                </div>
                <Button onClick={handleSaveName} disabled={saving || name === profile?.name}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your password to keep your account secure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                  />
                </div>
                <Button
                  onClick={handleChangePassword}
                  disabled={saving || !newPassword || !confirmPassword}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  {saving ? "Updating..." : "Update Password"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {profile?.role === "student" && (
            <TabsContent value="classes">
              <Card>
                <CardHeader>
                  <CardTitle>Enrolled Classes</CardTitle>
                  <CardDescription>Classes you are currently enrolled in</CardDescription>
                </CardHeader>
                <CardContent>
                  {classes.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      You haven't joined any classes yet.
                    </p>
                  ) : (
                    <div className="grid gap-3">
                      {classes.map((c) => (
                        <div
                          key={`${c.id}-${c.studentRecordId}`}
                          className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <h3 className="font-semibold flex items-center gap-2">
                                {c.name}
                                {c.tier === "pro" && (
                                  <Crown className="h-4 w-4 text-warning" />
                                )}
                              </h3>
                              {c.description && (
                                <p className="text-sm text-muted-foreground mt-0.5">{c.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={c.tier === "pro" ? "default" : "secondary"} className="capitalize">
                                {c.tier}
                              </Badge>
                            </div>
                          </div>
                          {c.tier !== "pro" && (
                            <div className="mt-3 pt-3 border-t flex items-center justify-between gap-2 flex-wrap">
                              <p className="text-xs text-muted-foreground">
                                Currently on Free tier — request Pro for full access.
                              </p>
                              <UpgradeRequestButton
                                studentId={c.studentRecordId}
                                classId={c.id}
                                className={c.name}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default Profile;
