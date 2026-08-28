import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, Send, ImagePlus, ArrowLeft, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Class } from "@/types";

interface Doubt {
  id: string;
  student_id: string;
  class_id: string;
  subject: string;
  status: string;
  created_at: string;
  student_name?: string;
  class_name?: string;
}

interface DoubtMessage {
  id: string;
  doubt_id: string;
  sender_id: string;
  sender_role: string;
  message: string | null;
  image_url: string | null;
  created_at: string;
}

interface Props {
  classes: Class[];
  userId: string;
}

export const TeacherDoubtChat = ({ classes, userId }: Props) => {
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [messages, setMessages] = useState<DoubtMessage[]>([]);
  const [selectedDoubt, setSelectedDoubt] = useState<Doubt | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDoubts();

    // Real-time: listen for new doubts across all teacher's classes
    const classIds = classes.map(c => c.id);
    if (classIds.length === 0) return;

    const channel = supabase
      .channel('teacher-doubts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'doubts',
      }, (payload) => {
        const newDoubt = payload.new as Doubt;
        if (classIds.includes(newDoubt.class_id)) {
          enrichDoubt(newDoubt).then(enriched => {
            setDoubts(prev => [enriched, ...prev]);
            toast.info(`New doubt from a student: ${enriched.subject}`);
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [classes]);

  useEffect(() => {
    if (selectedDoubt) {
      loadMessages(selectedDoubt.id);

      const channel = supabase
        .channel(`teacher-doubt-msgs-${selectedDoubt.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'doubt_messages',
          filter: `doubt_id=eq.${selectedDoubt.id}`,
        }, (payload) => {
          setMessages(prev => [...prev, payload.new as DoubtMessage]);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [selectedDoubt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const enrichDoubt = async (doubt: Doubt): Promise<Doubt> => {
    const { data: student } = await supabase
      .from('students')
      .select('name')
      .eq('id', doubt.student_id)
      .single();

    return {
      ...doubt,
      student_name: student?.name || 'Unknown',
      class_name: classes.find(c => c.id === doubt.class_id)?.name || 'Unknown',
    };
  };

  const loadDoubts = async () => {
    const classIds = classes.map(c => c.id);
    if (classIds.length === 0) return;

    const { data } = await supabase
      .from('doubts')
      .select('*')
      .in('class_id', classIds)
      .order('created_at', { ascending: false });

    if (data) {
      const enriched = await Promise.all(data.map(enrichDoubt));
      setDoubts(enriched);
    }
  };

  const loadMessages = async (doubtId: string) => {
    const { data } = await supabase
      .from('doubt_messages')
      .select('*')
      .eq('doubt_id', doubtId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedDoubt) return;
    const { error } = await supabase.from('doubt_messages').insert({
      doubt_id: selectedDoubt.id,
      sender_id: userId,
      sender_role: 'teacher',
      message: newMessage.trim(),
    });
    if (error) toast.error('Failed to send message');
    else setNewMessage("");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !selectedDoubt) return;
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }
    setUploading(true);
    const filePath = `${selectedDoubt.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('doubt-images')
      .upload(filePath, file);

    if (uploadError) {
      toast.error('Failed to upload image');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('doubt-images')
      .getPublicUrl(filePath);

    await supabase.from('doubt_messages').insert({
      doubt_id: selectedDoubt.id,
      sender_id: userId,
      sender_role: 'teacher',
      image_url: urlData.publicUrl,
    });
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resolveDoubt = async (doubt: Doubt) => {
    const { error } = await supabase
      .from('doubts')
      .update({ status: 'resolved' })
      .eq('id', doubt.id);
    if (!error) {
      setDoubts(prev => prev.map(d => d.id === doubt.id ? { ...d, status: 'resolved' } : d));
      if (selectedDoubt?.id === doubt.id) {
        setSelectedDoubt({ ...selectedDoubt, status: 'resolved' });
      }
      toast.success('Doubt marked as resolved');
    }
  };

  const openDoubts = doubts.filter(d => d.status === 'open');
  const resolvedDoubts = doubts.filter(d => d.status === 'resolved');

  if (selectedDoubt) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => { setSelectedDoubt(null); setMessages([]); }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base truncate">{selectedDoubt.subject}</CardTitle>
              <CardDescription className="text-xs">
                👤 {selectedDoubt.student_name} • {selectedDoubt.class_name} • {selectedDoubt.status === 'open' ? '🟢 Open' : '🔴 Resolved'}
              </CardDescription>
            </div>
            {selectedDoubt.status === 'open' && (
              <Button size="sm" variant="outline" onClick={() => resolveDoubt(selectedDoubt)}>
                <CheckCircle className="h-4 w-4 mr-1" /> Resolve
              </Button>
            )}
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <ScrollArea className="h-[400px] p-4">
            <div className="space-y-3">
              {messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No messages yet. Reply to help the student.
                </p>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_role === 'teacher' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.sender_role === 'teacher'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <p className="text-[10px] opacity-70 mb-1">
                      {msg.sender_role === 'teacher' ? 'You' : '🎓 Student'} • {format(new Date(msg.created_at), 'HH:mm')}
                    </p>
                    {msg.message && <p>{msg.message}</p>}
                    {msg.image_url && (
                      <img
                        src={msg.image_url}
                        alt="Shared image"
                        className="rounded mt-1 max-w-full cursor-pointer"
                        onClick={() => window.open(msg.image_url!, '_blank')}
                      />
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
          <Separator />
          <div className="p-3 flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
            <Input
              placeholder="Reply to student..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              className="flex-1"
            />
            <Button size="icon" onClick={sendMessage} disabled={!newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Student Doubts
          {openDoubts.length > 0 && (
            <Badge variant="destructive" className="ml-auto">{openDoubts.length} open</Badge>
          )}
        </CardTitle>
        <CardDescription>Respond to student queries in real-time</CardDescription>
      </CardHeader>
      <CardContent>
        {doubts.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No doubts from students yet
          </p>
        ) : (
          <div className="space-y-2">
            {openDoubts.length > 0 && (
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Open Doubts</p>
            )}
            {openDoubts.map((doubt) => (
              <button
                key={doubt.id}
                className="w-full text-left p-3 border rounded-lg hover:bg-muted/50 transition-colors border-l-4 border-l-primary"
                onClick={() => setSelectedDoubt(doubt)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">{doubt.subject}</span>
                  <Badge variant="default" className="text-xs ml-2">open</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  👤 {doubt.student_name} • {doubt.class_name} • {format(new Date(doubt.created_at), 'dd MMM, HH:mm')}
                </p>
              </button>
            ))}

            {resolvedDoubts.length > 0 && (
              <>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-4 mb-2">Resolved</p>
                {resolvedDoubts.slice(0, 5).map((doubt) => (
                  <button
                    key={doubt.id}
                    className="w-full text-left p-3 border rounded-lg hover:bg-muted/50 transition-colors opacity-60"
                    onClick={() => setSelectedDoubt(doubt)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate">{doubt.subject}</span>
                      <Badge variant="secondary" className="text-xs ml-2">resolved</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      👤 {doubt.student_name} • {doubt.class_name}
                    </p>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
