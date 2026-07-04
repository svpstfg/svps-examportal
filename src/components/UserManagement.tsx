import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  UsersRound,
  Search,
  Trash2,
  Ban,
  ShieldCheck,
  KeyRound,
  Globe,
  Save,
  Loader2,
} from "lucide-react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Class } from "@/types";

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  classIds: string[];
  hasAccount: boolean;
  confirmed: boolean;
  blocked: boolean;
}

interface Props {
  classes: Class[];
}

export const UserManagement = ({ classes }: Props) => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const [domain, setDomain] = useState("svps.com");
  const [domainInput, setDomainInput] = useState("svps.com");
  const [savingDomain, setSavingDomain] = useState(false);

  const [pwUser, setPwUser] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteUser, setDeleteUser] = useState<ManagedUser | null>(null);




  const loadDomain = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    const { data } = await supabase
      .from("teacher_settings")
      .select("student_email_domain")
      .eq("teacher_id", uid)
      .maybeSingle();
    if (data?.student_email_domain) {
      setDomain(data.student_email_domain);
      setDomainInput(data.student_email_domain);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    const classIds = classes.map((c) => c.id);
    if (classIds.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "list", classIds },
      });
      if (error) throw error;
      setUsers(data?.users ?? []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [classes]);

  useEffect(() => {
    loadDomain();
    loadUsers();
  }, [loadDomain, loadUsers]);

  useEffect(() => {
    // default collapsed for all class groups
    const map: Record<string, boolean> = {};
    classes.forEach((c) => {
      map[c.id] = false;
    });
    setOpenGroups(map);
  }, [classes]);

  const saveDomain = async () => {
    const cleaned = domainInput
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^@/, "")
      .replace(/\/.*$/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(cleaned)) {
      toast.error("Enter a valid domain, e.g. svps.com");
      return;
    }
    setSavingDomain(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Not signed in");
      const { error } = await supabase
        .from("teacher_settings")
        .upsert(
          { teacher_id: uid, student_email_domain: cleaned },
          { onConflict: "teacher_id" },
        );
      if (error) throw error;
      setDomain(cleaned);
      setDomainInput(cleaned);
      toast.success("Student email domain saved");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save domain");
    } finally {
      setSavingDomain(false);
    }
  };

  const callAction = async (
    email: string,
    action: "block" | "unblock" | "delete" | "change-password",
    extra: Record<string, unknown> = {},
  ) => {
    setBusyEmail(email);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action, email, ...extra },
      });
      if (error) {
        const msg = (await error.context?.json?.())?.error;
        throw new Error(msg || error.message);
      }
      if (data?.error) throw new Error(data.error);
      return true;
    } catch (err) {
      toast.error((err as Error).message || "Action failed");
      return false;
    } finally {
      setBusyEmail(null);
    }
  };

  const handleBlockToggle = async (u: ManagedUser) => {
    const ok = await callAction(u.email, u.blocked ? "unblock" : "block");
    if (ok) {
      toast.success(u.blocked ? "Student unblocked" : "Student blocked");
      loadUsers();
    }
  };

  const handleChangePassword = async () => {
    if (!pwUser) return;
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    const ok = await callAction(pwUser.email, "change-password", {
      password: newPassword,
    });
    if (ok) {
      toast.success(`Password updated for ${pwUser.name || pwUser.email}`);
      setPwUser(null);
      setNewPassword("");
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    const ok = await callAction(deleteUser.email, "delete");
    if (ok) {
      toast.success("Student deleted");
      setDeleteUser(null);
      loadUsers();
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  });

  const groupedByClass = classes
    .map((c) => ({
      id: c.id,
      name: c.name,
      members: filtered.filter((u) => u.classIds.includes(c.id)),
    }))
    .filter((g) => g.members.length > 0);

  const ungrouped = filtered.filter(
    (u) => !classes.some((c) => u.classIds.includes(c.id)),
  );

  const renderUserCard = (u: ManagedUser) => {
    const busy = busyEmail === u.email;
    return (
      <div
        key={u.id}
        className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium truncate">{u.name || "Unnamed"}</span>
            {u.blocked && <Badge variant="destructive">Blocked</Badge>}
            {!u.hasAccount && <Badge variant="outline">No account</Badge>}
            {u.hasAccount && !u.confirmed && (
              <Badge variant="secondary">Unverified</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{u.email}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !u.hasAccount}
            onClick={() => {
              setPwUser(u);
              setNewPassword("");
            }}
          >
            <KeyRound className="h-4 w-4 mr-1" /> Password
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !u.hasAccount}
            onClick={() => handleBlockToggle(u)}
          >
            {u.blocked ? (
              <>
                <ShieldCheck className="h-4 w-4 mr-1" /> Unblock
              </>
            ) : (
              <>
                <Ban className="h-4 w-4 mr-1" /> Block
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => setDeleteUser(u)}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <UsersRound className="h-6 w-6 text-primary" /> User Management
        </h2>
        <p className="text-sm text-muted-foreground">
          Delete, block, and reset student passwords, and set the email domain used for bulk student sign-ups.
        </p>
      </div>

      {/* Domain settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-5 w-5" /> Student Email Domain
          </CardTitle>
          <CardDescription>
            When you bulk sign up students, each login email is built as{" "}
            <code>&lt;mobile&gt;@{domain}</code>. Update the domain below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">@</span>
                <Input
                  id="domain"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="svps.com"
                />
              </div>
            </div>
            <Button onClick={saveDomain} disabled={savingDomain}>
              {savingDomain ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Domain
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Students</CardTitle>
          <CardDescription>
            {classes.length === 0
              ? "Create a class to manage its students."
              : "Manage every student enrolled in your classes."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 mx-auto animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No students found.
            </p>
          ) : (
            <div className="space-y-6">
              {groupedByClass.map((g) => (
                <div key={g.id} className="space-y-3">
                  <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => setOpenGroups((prev) => ({ ...prev, [g.id]: !prev[g.id] }))}
                    role="button"
                    aria-expanded={!!openGroups[g.id]}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenGroups((prev) => ({ ...prev, [g.id]: !prev[g.id] }));
                      }
                    }}
                  >
                    {openGroups[g.id] ? (
                      <ChevronDown className="h-4 w-4 text-primary" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <UsersRound className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">{g.name}</h3>
                    <Badge variant="outline">{g.members.length}</Badge>
                  </div>
                  {openGroups[g.id] && (
                    <div className="space-y-3">
                      {g.members.map((u) => renderUserCard(u))}
                    </div>
                  )}
                </div>
              ))}

              {ungrouped.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <UsersRound className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Unassigned</h3>
                    <Badge variant="outline">{ungrouped.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {ungrouped.map((u) => renderUserCard(u))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change password dialog */}
      <Dialog open={!!pwUser} onOpenChange={(o) => !o && setPwUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Set a new password for {pwUser?.name || pwUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={busyEmail === pwUser?.email}
            >
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteUser}
        onOpenChange={(o) => !o && setDeleteUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this student?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {deleteUser?.name || deleteUser?.email},
              their login account and all enrollments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
