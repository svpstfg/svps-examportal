import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { StudentDashboard } from "@/components/StudentDashboard";

const StudentPortal = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/auth');
      return;
    }

    // Use cached role to avoid blocking on a network round-trip
    const cacheKey = `user_role_${user.id}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached === 'teacher') {
      navigate('/');
      return;
    }

    // Background verification — only redirect if confirmed teacher
    if (!cached) {
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          sessionStorage.setItem(cacheKey, data.role);
          if (data.role === 'teacher') navigate('/');
        });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <StudentDashboard />
      </main>
    </div>
  );
};

export default StudentPortal;
