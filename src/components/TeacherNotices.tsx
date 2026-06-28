import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Send, Paperclip, Link as LinkIcon, Trash2, FileText, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Class } from "@/types";
import { format } from "date-fns";

interface Notice {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  content: string | null;
  link: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  created_at: string;
}

interface TeacherNoticesProps {
  classes: Class[];
}

export const TeacherNotices = ({ classes }: TeacherNoticesProps) => {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [link, setLink] = useState("");
  const [classId, setClassId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    loadNotices();
  }, [user]);

  const loadNotices = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setNotices(data as Notice[]);
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
    if (!allowedTypes.includes(selected.type)) {
      toast.error('Only images, PDF, and PPTX files are allowed');
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB');
      return;
    }
    setFile(selected);
  };

  const handleSend = async () => {
    if (!user || !classId || !title.trim()) {
      toast.error('Please select a class and enter a title');
      return;
    }

    setSending(true);
    try {
      let attachmentPath: string | null = null;
      let attachmentName: string | null = null;
      let attachmentType: string | null = null;

      if (file) {
        const ext = file.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('notice-attachments')
          .upload(filePath, file);
        if (uploadError) throw uploadError;
        attachmentPath = filePath;
        attachmentName = file.name;
        attachmentType = file.type;
      }

      const { data, error } = await supabase
        .from('notices')
        .insert({
          class_id: classId,
          teacher_id: user.id,
          title: title.trim(),
          content: content.trim() || null,
          link: link.trim() || null,
          attachment_path: attachmentPath,
          attachment_name: attachmentName,
          attachment_type: attachmentType,
        } as any)
        .select()
        .single();

      if (error) throw error;

      setNotices(prev => [data as Notice, ...prev]);
      setTitle("");
      setContent("");
      setLink("");
      setClassId("");
      setFile(null);
      toast.success('Notice sent successfully!');
    } catch (error) {
      console.error('Error sending notice:', error);
      toast.error('Failed to send notice');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (notice: Notice) => {
    try {
      if (notice.attachment_path) {
        await supabase.storage.from('notice-attachments').remove([notice.attachment_path]);
      }
      const { error } = await supabase.from('notices').delete().eq('id', notice.id);
      if (error) throw error;
      setNotices(prev => prev.filter(n => n.id !== notice.id));
      toast.success('Notice deleted');
    } catch (error) {
      toast.error('Failed to delete notice');
    }
  };

  const getAttachmentUrl = (path: string) => {
    const { data } = supabase.storage.from('notice-attachments').getPublicUrl(path);
    return data.publicUrl;
  };

  const getClassName = (id: string) => classes.find(c => c.id === id)?.name || 'Unknown';

  const getFileIcon = (type: string | null) => {
    if (!type) return <FileText className="h-4 w-4" />;
    if (type.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Create Notice
          </CardTitle>
          <CardDescription>Send a notice to students of a specific class</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Class *</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Notice title" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Content</Label>
            <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Notice details..." rows={3} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><LinkIcon className="h-3 w-3" /> Link (optional)</Label>
              <Input value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." type="url" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Paperclip className="h-3 w-3" /> Attachment (optional)</Label>
              <div className="flex items-center gap-2">
                <Input type="file" onChange={handleFileChange} accept="image/*,.pdf,.pptx,.ppt" className="flex-1" />
                {file && (
                  <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {file && <p className="text-xs text-muted-foreground">{file.name}</p>}
            </div>
          </div>

          <Button onClick={handleSend} disabled={sending || !classId || !title.trim()}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Sending...' : 'Send Notice'}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Notices */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Sent Notices</h3>
        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : notices.length === 0 ? (
          <p className="text-muted-foreground">No notices sent yet.</p>
        ) : (
          notices.map(notice => (
            <Card key={notice.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold">{notice.title}</h4>
                      <Badge variant="outline">{getClassName(notice.class_id)}</Badge>
                    </div>
                    {notice.content && <p className="text-sm text-muted-foreground">{notice.content}</p>}
                    <div className="flex items-center gap-3 flex-wrap mt-2">
                      {notice.link && (
                        <a href={notice.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                          <LinkIcon className="h-3 w-3" /> {notice.link}
                        </a>
                      )}
                      {notice.attachment_path && notice.attachment_name && (
                        <a href={getAttachmentUrl(notice.attachment_path)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                          {getFileIcon(notice.attachment_type)} {notice.attachment_name}
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(notice.created_at), 'PPp')}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(notice)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
