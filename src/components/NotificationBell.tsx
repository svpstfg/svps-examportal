import { useState, useEffect } from "react";
import { Bell, FileText, Image as ImageIcon, Link as LinkIcon, X, ArrowRight, Crown, CheckCircle2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { toast } from "sonner";

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

interface UpgradeNotice {
  id: string;
  kind: "upgrade_request" | "upgrade_response";
  title: string;
  subtitle: string;
  status?: string;
  created_at: string;
}

export const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [upgradeNotices, setUpgradeNotices] = useState<UpgradeNotice[]>([]);
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    loadNotices();
    loadUpgradeNotices();

    // Load read IDs from localStorage
    const stored = localStorage.getItem(`read_notices_${user.id}`);
    if (stored) setReadIds(new Set(JSON.parse(stored)));

    // Subscribe to realtime notices
    const channel = supabase
      .channel('notices-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notices' }, (payload) => {
        const newNotice = payload.new as Notice;
        setNotices(prev => [newNotice, ...prev]);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'upgrade_requests' }, async (payload) => {
        const r: any = payload.new;
        // Teacher receives new request
        if (r.teacher_id === user.id) {
          toast.info("New Pro upgrade request received");
          loadUpgradeNotices();
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'upgrade_requests' }, (payload) => {
        const r: any = payload.new;
        // Student receives status update — check via email match in load
        if (r.status === 'approved' || r.status === 'rejected') {
          loadUpgradeNotices();
          if (r.status === 'approved') toast.success("Your Pro upgrade was approved!");
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadNotices = async () => {
    const { data } = await supabase
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setNotices(data as Notice[]);
  };

  const loadUpgradeNotices = async () => {
    if (!user) return;
    // Teacher: show pending requests
    const { data: teacherReqs } = await supabase
      .from('upgrade_requests')
      .select('id, status, created_at, student_id, class_id')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    // Student: show their request statuses (via student records)
    const { data: studentRows } = user.email
      ? await supabase.from('students').select('id').eq('email', user.email)
      : { data: null as any };
    let studentReqs: any[] = [];
    if (studentRows && studentRows.length > 0) {
      const ids = studentRows.map((s: any) => s.id);
      const { data } = await supabase
        .from('upgrade_requests')
        .select('id, status, created_at, class_id, responded_at')
        .in('student_id', ids)
        .order('created_at', { ascending: false })
        .limit(20);
      studentReqs = data || [];
    }

    const allReqs = [...(teacherReqs || []), ...studentReqs];
    if (allReqs.length === 0) {
      setUpgradeNotices([]);
      return;
    }

    const studentIds = [...new Set((teacherReqs || []).map((r: any) => r.student_id))];
    const classIds = [...new Set(allReqs.map((r: any) => r.class_id))];
    const [{ data: students }, { data: classes }] = await Promise.all([
      studentIds.length ? supabase.from('students').select('id, name').in('id', studentIds) : Promise.resolve({ data: [] as any }),
      supabase.from('classes').select('id, name').in('id', classIds),
    ]);
    const studentMap = new Map((students || []).map((s: any) => [s.id, s.name]));
    const classMap = new Map((classes || []).map((c: any) => [c.id, c.name]));

    const items: UpgradeNotice[] = [];
    (teacherReqs || []).forEach((r: any) => {
      if (r.status === 'pending') {
        items.push({
          id: `t-${r.id}`,
          kind: 'upgrade_request',
          title: `Pro upgrade request`,
          subtitle: `${studentMap.get(r.student_id) || 'Student'} · ${classMap.get(r.class_id) || ''}`,
          status: r.status,
          created_at: r.created_at,
        });
      }
    });
    studentReqs.forEach((r: any) => {
      if (r.status === 'approved' || r.status === 'rejected') {
        items.push({
          id: `s-${r.id}`,
          kind: 'upgrade_response',
          title: r.status === 'approved' ? 'Pro upgrade approved' : 'Pro upgrade rejected',
          subtitle: classMap.get(r.class_id) || '',
          status: r.status,
          created_at: r.responded_at || r.created_at,
        });
      }
    });
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setUpgradeNotices(items);
  };

  const markAllRead = () => {
    const allIds = new Set([...notices.map(n => n.id), ...upgradeNotices.map(u => u.id)]);
    setReadIds(allIds);
    if (user) localStorage.setItem(`read_notices_${user.id}`, JSON.stringify([...allIds]));
  };

  const unreadCount =
    notices.filter(n => !readIds.has(n.id)).length +
    upgradeNotices.filter(u => !readIds.has(u.id)).length;

  const getAttachmentUrl = (path: string) => {
    const { data } = supabase.storage.from('notice-attachments').getPublicUrl(path);
    return data.publicUrl;
  };

  const getFileIcon = (type: string | null) => {
    if (!type) return <FileText className="h-3 w-3" />;
    if (type.startsWith('image/')) return <ImageIcon className="h-3 w-3" />;
    return <FileText className="h-3 w-3" />;
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) markAllRead();
  };

  const hasAny = notices.length > 0 || upgradeNotices.length > 0;

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {hasAny && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {!hasAny ? (
            <p className="text-sm text-muted-foreground p-4 text-center">No notifications yet</p>
          ) : (
            <>
              {upgradeNotices.map((u, i) => (
                <div key={u.id}>
                  <button
                    onClick={() => { setOpen(false); navigate('/'); }}
                    className={`w-full text-left p-3 space-y-1 hover:bg-muted/50 ${!readIds.has(u.id) ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      {u.status === 'approved' ? (
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                      ) : u.status === 'rejected' ? (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      ) : (
                        <Crown className="h-4 w-4 text-warning shrink-0" />
                      )}
                      <p className="text-sm font-medium leading-tight">{u.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">{u.subtitle}</p>
                    <p className="text-[10px] text-muted-foreground pl-6">
                      {format(new Date(u.created_at), 'PPp')}
                    </p>
                  </button>
                  <Separator />
                </div>
              ))}
              {notices.map((notice, i) => (
                <div key={notice.id}>
                  <div className={`p-3 space-y-1 ${!readIds.has(notice.id) ? 'bg-primary/5' : ''}`}>
                    <p className="text-sm font-medium leading-tight">{notice.title}</p>
                    {notice.content && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{notice.content}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      {notice.link && (
                        <a href={notice.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                          <LinkIcon className="h-3 w-3" /> Link
                        </a>
                      )}
                      {notice.attachment_path && notice.attachment_name && (
                        <a href={getAttachmentUrl(notice.attachment_path)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                          {getFileIcon(notice.attachment_type)} {notice.attachment_name}
                        </a>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(notice.created_at), 'PPp')}
                    </p>
                  </div>
                  {i < notices.length - 1 && <Separator />}
                </div>
              ))}
            </>
          )}
        </ScrollArea>
        <Separator />
        <button
          onClick={() => {
            setOpen(false);
            navigate("/notifications");
          }}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors rounded-b-md"
        >
          View all notifications
          <ArrowRight className="h-3 w-3" />
        </button>
      </PopoverContent>
    </Popover>
  );
};
