import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Search,
  Download,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, formatDistanceToNow } from "date-fns";

interface Notice {
  id: string;
  class_id: string;
  title: string;
  content: string | null;
  link: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  created_at: string;
}

interface ClassInfo {
  id: string;
  name: string;
}

const Notifications = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [classes, setClasses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    loadAll();

    const channel = supabase
      .channel("notices-page-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notices" },
        (payload) => {
          setNotices((prev) => [payload.new as Notice, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  // Mark all as read when the page is opened
  useEffect(() => {
    if (!user || notices.length === 0) return;
    const allIds = notices.map((n) => n.id);
    localStorage.setItem(`read_notices_${user.id}`, JSON.stringify(allIds));
  }, [user, notices]);

  const loadAll = async () => {
    setLoading(true);
    const { data: noticeData } = await supabase
      .from("notices")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    const list = (noticeData ?? []) as Notice[];
    setNotices(list);

    const classIds = Array.from(new Set(list.map((n) => n.class_id)));
    if (classIds.length) {
      const { data: classData } = await supabase
        .from("classes")
        .select("id, name")
        .in("id", classIds);
      const map: Record<string, string> = {};
      (classData ?? []).forEach((c: ClassInfo) => {
        map[c.id] = c.name;
      });
      setClasses(map);
    }
    setLoading(false);
  };

  const getAttachmentUrl = (path: string) => {
    const { data } = supabase.storage
      .from("notice-attachments")
      .getPublicUrl(path);
    return data.publicUrl;
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return notices;
    const q = search.toLowerCase();
    return notices.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.content ?? "").toLowerCase().includes(q) ||
        (classes[n.class_id] ?? "").toLowerCase().includes(q)
    );
  }, [notices, search, classes]);

  const renderAttachmentIcon = (type: string | null) => {
    if (type?.startsWith("image/"))
      return <ImageIcon className="h-3.5 w-3.5" />;
    return <FileText className="h-3.5 w-3.5" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Notifications
                </h1>
                <p className="text-sm text-muted-foreground">
                  All notices from your classes in one place
                </p>
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {notices.length} total
          </Badge>
        </div>

        <Card className="shadow-sm border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-lg">Inbox</CardTitle>
                <CardDescription>
                  Notices broadcast by your teachers
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notices..."
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Inbox className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="font-medium">
                  {search ? "No matching notifications" : "No notifications yet"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {search
                    ? "Try a different search term"
                    : "You'll see notices from your teachers here"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-[28%]">Title</TableHead>
                      <TableHead className="w-[32%]">Message</TableHead>
                      <TableHead className="w-[14%]">Class</TableHead>
                      <TableHead className="w-[14%]">Attachment</TableHead>
                      <TableHead className="w-[12%] text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((n) => (
                      <TableRow key={n.id} className="align-top">
                        <TableCell className="font-medium">
                          <div className="flex flex-col gap-1">
                            <span className="leading-snug">{n.title}</span>
                            {n.link && (
                              <a
                                href={n.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline w-fit"
                              >
                                <LinkIcon className="h-3 w-3" />
                                Open link
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <p className="line-clamp-3 whitespace-pre-wrap">
                            {n.content || (
                              <span className="italic">No message</span>
                            )}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {classes[n.class_id] ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {n.attachment_path && n.attachment_name ? (
                            <a
                              href={getAttachmentUrl(n.attachment_path)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline max-w-[160px]"
                              title={n.attachment_name}
                            >
                              {renderAttachmentIcon(n.attachment_type)}
                              <span className="truncate">
                                {n.attachment_name}
                              </span>
                              <Download className="h-3 w-3 flex-shrink-0" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-medium">
                              {formatDistanceToNow(new Date(n.created_at), {
                                addSuffix: true,
                              })}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {format(new Date(n.created_at), "PP")}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Notifications;
