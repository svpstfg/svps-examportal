import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, Send, ImagePlus, Plus, X, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Doubt {
  id: string;
  student_id: string;
  class_id: string;
  subject: string;
  status: string;
  created_at: string;
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
  studentIds: string[];
  enrolledClassIds: string[];
  classes: { id: string; name: string }[];
}

export const StudentDoubtChat = ({ studentIds, enrolledClassIds, classes }: Props) => {
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [messages, setMessages] = useState<DoubtMessage[]>([]);
  const [selectedDoubt, setSelectedDoubt] = useState<Doubt | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newDoubtSubject, setNewDoubtSubject] = useState("");
  const [newDoubtClassId, setNewDoubtClassId] = useState("");
  const [showNewDoubt, setShowNewDoubt] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (studentIds.length > 0) loadDoubts();
  }, [studentIds]);

  useEffect(() => {
    if (selectedDoubt) {
      loadMessages(selectedDoubt.id);

      const channel = supabase
        .channel(`doubt-messages-${selectedDoubt.id}`)
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

  const loadDoubts = async () => {
    const { data, error } = await supabase
      .from('doubts')
      .select('*')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false });
    if (data) setDoubts(data);
  };

  const loadMessages = async (doubtId: string) => {
    const { data } = await supabase
      .from('doubt_messages')
      .select('*')
      .eq('doubt_id', doubtId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const createDoubt = async () => {
    if (!newDoubtSubject.trim() || !newDoubtClassId) return;
    const studentForClass = studentIds.find((_, i) => {
      // Find the student_id that matches the selected class
      return true;
    });
    
    // Find the correct student_id for the selected class
    const { data: studentData } = await supabase
      .from('students')
      .select('id')
      .in('id', studentIds)
      .eq('class_id', newDoubtClassId)
      .single();

    if (!studentData) {
      toast.error('Could not find your enrollment for this class');
      return;
    }

    const { data, error } = await supabase
      .from('doubts')
      .insert({
        student_id: studentData.id,
        class_id: newDoubtClassId,
        subject: newDoubtSubject.trim(),
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create doubt');
      return;
    }
    if (data) {
      setDoubts(prev => [data, ...prev]);
      setSelectedDoubt(data);
      setShowNewDoubt(false);
      setNewDoubtSubject("");
      setNewDoubtClassId("");
      toast.success('Doubt created! Your teacher will be notified.');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedDoubt) return;
    const { error } = await supabase.from('doubt_messages').insert({
      doubt_id: selectedDoubt.id,
      sender_id: studentIds[0],
      sender_role: 'student',
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
      sender_id: studentIds[0],
      sender_role: 'student',
      image_url: urlData.publicUrl,
    });
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getClassName = (classId: string) => {
    return classes.find(c => c.id === classId)?.name || 'Unknown';
  };

  const enrolledClasses = classes.filter(c => enrolledClassIds.includes(c.id));

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
                {getClassName(selectedDoubt.class_id)} • {selectedDoubt.status === 'open' ? '🟢 Open' : '🔴 Resolved'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <ScrollArea className="h-[300px] p-4">
            <div className="space-y-3">
              {messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Start the conversation by sending a message or screenshot
                </p>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_role === 'student' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.sender_role === 'student'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <p className="text-[10px] opacity-70 mb-1">
                      {msg.sender_role === 'student' ? 'You' : '👨‍🏫 Teacher'} • {format(new Date(msg.created_at), 'HH:mm')}
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
              placeholder="Type your doubt..."
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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5" />
            Doubt Clearing
          </CardTitle>
          <Button size="sm" onClick={() => setShowNewDoubt(true)}>
            <Plus className="h-4 w-4 mr-1" /> Ask Doubt
          </Button>
        </div>
        <CardDescription>Ask your teacher to clear your doubts</CardDescription>
      </CardHeader>
      <CardContent>
        {showNewDoubt && (
          <div className="mb-4 p-3 border rounded-lg space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">New Doubt</span>
              <Button variant="ghost" size="icon" onClick={() => setShowNewDoubt(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={newDoubtClassId}
              onChange={(e) => setNewDoubtClassId(e.target.value)}
            >
              <option value="">Select Class</option>
              {enrolledClasses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Input
              placeholder="What's your doubt about?"
              value={newDoubtSubject}
              onChange={(e) => setNewDoubtSubject(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createDoubt()}
            />
            <Button size="sm" onClick={createDoubt} disabled={!newDoubtSubject.trim() || !newDoubtClassId} className="w-full">
              Submit Doubt
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {doubts.length === 0 && !showNewDoubt && (
            <p className="text-center text-sm text-muted-foreground py-6">
              No doubts yet. Click "Ask Doubt" to get started!
            </p>
          )}
          {doubts.map((doubt) => (
            <button
              key={doubt.id}
              className="w-full text-left p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedDoubt(doubt)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm truncate">{doubt.subject}</span>
                <Badge variant={doubt.status === 'open' ? 'default' : 'secondary'} className="text-xs ml-2">
                  {doubt.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {getClassName(doubt.class_id)} • {format(new Date(doubt.created_at), 'dd MMM, HH:mm')}
              </p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
