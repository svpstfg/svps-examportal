import { BookOpen, LogOut, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { NotificationBell } from "@/components/NotificationBell";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<'teacher' | 'student' | null>(null);

  useEffect(() => {
    if (!user) {
      setUserRole(null);
      return;
    }
    // Cache role in sessionStorage to avoid repeat fetches across pages
    const cacheKey = `user_role_${user.id}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached === 'teacher' || cached === 'student') {
      setUserRole(cached);
      return;
    }
    let cancelled = false;
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const role = data.role as 'teacher' | 'student';
        sessionStorage.setItem(cacheKey, role);
        setUserRole(role);
      });
    return () => { cancelled = true; };
  }, [user]);

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <header className="border-b bg-card shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-primary to-accent p-2 rounded-lg">
              <BookOpen className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Skyview Test Pro
              </h1>
              <p className="text-sm text-muted-foreground">Advanced Mock Testing Platform</p>
            </div>
          </div>
          
          {user && (
            <div className="flex items-center space-x-4">
              {userRole && (
                <span className="text-sm font-medium text-muted-foreground capitalize">
                  {userRole} Account
                </span>
              )}
              <NotificationBell />
              <span className="text-sm text-muted-foreground hidden sm:inline">{user.email}</span>
              <Button variant="ghost" size="sm" onClick={() => navigate('/profile')} title="Profile">
                <User className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Profile</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout} title="Sign Out">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
