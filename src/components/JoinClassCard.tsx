import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface JoinClassCardProps {
  studentId: string;
  studentName: string;
  studentEmail: string;
  onClassJoined: () => void;
}

export const JoinClassCard = ({ studentId, studentName, studentEmail, onClassJoined }: JoinClassCardProps) => {
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoinClass = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      toast.error("Please enter an invite code");
      return;
    }

    setLoading(true);
    try {
      // Find the class by invite code using security definer function
      const { data: classResults, error: classError } = await supabase
        .rpc('find_class_by_invite_code', { _invite_code: code });

      const classData = classResults?.[0] || null;

      if (classError) throw classError;

      if (!classData) {
        toast.error("Invalid invite code. Please check and try again.");
        setLoading(false);
        return;
      }

      // Check if already enrolled
      const { data: existingStudent } = await supabase
        .from('students')
        .select('id')
        .eq('email', studentEmail)
        .eq('class_id', classData.id)
        .maybeSingle();

      if (existingStudent) {
        toast.error("You are already enrolled in this class!");
        setLoading(false);
        return;
      }

      // Create student record for this class
      const { data: newStudent, error: studentError } = await supabase
        .from('students')
        .insert({
          name: studentName,
          email: studentEmail,
          class_id: classData.id,
        })
        .select()
        .single();

      if (studentError) throw studentError;

      // Create enrollment record
      const { error: enrollError } = await supabase
        .from('student_enrollments')
        .insert({
          student_id: newStudent.id,
          class_id: classData.id,
        });

      if (enrollError) throw enrollError;

      // Update student count
      await supabase.rpc('is_student_in_class', { _class_id: classData.id, _email: studentEmail });

      toast.success(`Successfully joined "${classData.name}"!`);
      setInviteCode("");
      onClassJoined();
    } catch (error: any) {
      console.error('Error joining class:', error);
      toast.error("Failed to join class. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-base">
          <UserPlus className="h-5 w-5" />
          <span>Join Another Class</span>
        </CardTitle>
        <CardDescription>
          Enter the invite code provided by your teacher
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Enter invite code (e.g., ABC123)"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="uppercase tracking-widest font-mono"
              onKeyDown={(e) => e.key === 'Enter' && handleJoinClass()}
            />
          </div>
          <Button onClick={handleJoinClass} disabled={loading || !inviteCode.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
            {loading ? "" : "Join"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
