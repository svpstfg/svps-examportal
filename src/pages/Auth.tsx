import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { GraduationCap, BookOpen, KeyRound, Users } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

const Auth = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [resolvedClassId, setResolvedClassId] = useState<string | null>(null);
  const [resolvedClassName, setResolvedClassName] = useState('');
  const [joinMethod, setJoinMethod] = useState<'code' | 'browse' | 'skip'>('code');
  const [publicClasses, setPublicClasses] = useState<Array<{ id: string; name: string; description: string | null }>>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'student' as 'teacher' | 'student'
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteFromUrl = params.get('inviteCode') || params.get('invite') || params.get('code');
    if (inviteFromUrl) {
      setInviteCode(inviteFromUrl.toUpperCase());
      setJoinMethod('code');
    }
  }, []);

  // Resolve invite code to class
  useEffect(() => {
    const resolveCode = async () => {
      if (inviteCode.length < 4) {
        setResolvedClassId(null);
        setResolvedClassName('');
        return;
      }
      const { data } = await supabase
        .rpc('find_class_by_invite_code', { _invite_code: inviteCode.toUpperCase() });
      const classData = data?.[0] || null;
      if (classData) {
        setResolvedClassId(classData.id);
        setResolvedClassName(classData.name);
      } else {
        setResolvedClassId(null);
        setResolvedClassName('');
      }
    };
    const timer = setTimeout(resolveCode, 300);
    return () => clearTimeout(timer);
  }, [inviteCode]);

  useEffect(() => {
    // Increment + fetch visitor count (fire and forget)
    supabase.rpc('increment_visitor_count', { _page: 'auth' }).then(({ data }) => {
      if (typeof data === 'number') setVisitorCount(data);
    });

    let isMounted = true;

    const routeByRole = async (userId: string) => {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      if (!isMounted) return;
      navigate(roleData?.role === 'student' ? '/student' : '/');
    };

    // Fast initial check using cached session (no network round-trip)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) routeByRole(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        // Defer the role lookup so the listener returns immediately
        setTimeout(() => routeByRole(session.user.id), 0);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });
      if (error) {
        toast.error(error.message);
        setLoading(false);
      } else {
        toast.success('Logged in successfully!');
        // Don't reset loading — onAuthStateChange will navigate away
      }
    } catch {
      toast.error('Network error. Please check your connection and try again.');
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    // Determine final class id based on join method
    let finalClassId: string | null = null;
    if (formData.role === 'student') {
      if (joinMethod === 'code') {
        if (!resolvedClassId) {
          toast.error('Please enter a valid teacher invite code');
          return;
        }
        finalClassId = resolvedClassId;
      } else if (joinMethod === 'browse') {
        if (!selectedClassId) {
          toast.error('Please select a class');
          return;
        }
        finalClassId = selectedClassId;
      }
      // 'skip' → finalClassId stays null; student signs up without a class
    }

    setLoading(true);

    try {
      const metadata: Record<string, string> = {
        name: formData.name,
        role: formData.role
      };
      if (formData.role === 'student' && finalClassId) {
        metadata.class_id = finalClassId;
      }

      const { data: signUpData, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: metadata
        }
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Account created! Please check your email for verification.');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail || !resetEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password reset link sent! Please check your email.');
        setShowForgotPassword(false);
        setResetEmail('');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Mock Test Platform</h1>
          <p className="text-muted-foreground text-sm mt-1">Learn, practice, and excel</p>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardContent className="pt-6">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label>I am a</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => {
                        setFormData(prev => ({ ...prev, role: value as 'teacher' | 'student' }));
                        if (value === 'teacher') {
                          setInviteCode('');
                          setResolvedClassId(null);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">
                          <span className="flex items-center space-x-2">
                            <BookOpen className="h-4 w-4" />
                            <span>Student</span>
                          </span>
                        </SelectItem>
                        <SelectItem value="teacher">
                          <span className="flex items-center space-x-2">
                            <GraduationCap className="h-4 w-4" />
                            <span>Teacher</span>
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.role === 'student' && (
                    <div className="space-y-2">
                      <Label>Join a class (optional)</Label>
                      <Tabs
                        value={joinMethod}
                        onValueChange={async (v) => {
                          const method = v as 'code' | 'browse' | 'skip';
                          setJoinMethod(method);
                          if (method === 'browse' && publicClasses.length === 0) {
                            const { data } = await (supabase.rpc as any)('list_public_classes');
                            if (data) setPublicClasses(data as any);
                          }
                        }}
                      >
                        <TabsList className="grid w-full grid-cols-3 h-9">
                          <TabsTrigger value="code" className="text-xs">Invite Code</TabsTrigger>
                          <TabsTrigger value="browse" className="text-xs">Select Class</TabsTrigger>
                          <TabsTrigger value="skip" className="text-xs">Skip</TabsTrigger>
                        </TabsList>

                        <TabsContent value="code" className="mt-3 space-y-2">
                          <Label className="flex items-center space-x-2 text-xs text-muted-foreground">
                            <KeyRound className="h-3.5 w-3.5" />
                            <span>Teacher Invite Code</span>
                          </Label>
                          <Input
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                            placeholder="Enter 6-digit code"
                            maxLength={6}
                            className="font-mono tracking-widest text-center text-lg uppercase"
                          />
                          {inviteCode.length >= 4 && (
                            resolvedClassName ? (
                              <p className="text-sm text-accent flex items-center space-x-1">
                                <span>✓ Joining:</span>
                                <span className="font-semibold">{resolvedClassName}</span>
                              </p>
                            ) : (
                              <p className="text-sm text-destructive">Invalid invite code</p>
                            )
                          )}
                        </TabsContent>

                        <TabsContent value="browse" className="mt-3 space-y-2">
                          <Label className="flex items-center space-x-2 text-xs text-muted-foreground">
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>Pick a class to access free demo tests</span>
                          </Label>
                          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                            <SelectTrigger>
                              <SelectValue placeholder={publicClasses.length ? "Choose a class" : "Loading..."} />
                            </SelectTrigger>
                            <SelectContent>
                              {publicClasses.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            You'll get all free / demo tests for the selected class.
                          </p>
                        </TabsContent>

                        <TabsContent value="skip" className="mt-3">
                          <p className="text-xs text-muted-foreground">
                            You can join classes later from your dashboard.
                          </p>
                        </TabsContent>
                      </Tabs>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Your full name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Min 6 characters"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Visitor counter link */}
        <div className="mt-4 text-center">
          <a
            href="https://mock-test.lovable.app/auth"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Users className="h-3.5 w-3.5" />
            <span>
              {visitorCount !== null
                ? `${visitorCount.toLocaleString()} visitors`
                : 'Count visitors'}
            </span>
          </a>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
              <CardDescription>
                Enter your email and we'll send you a reset link
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmail('');
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Auth;
