import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, LogIn, GraduationCap, Users } from "lucide-react";
import { toast } from "sonner";
import { Class, Student } from "@/types";

interface StudentLoginProps {
  classes: Class[];
  onStudentLogin: (student: Student) => void;
  onBack: () => void;
}

export const StudentLogin = ({ classes, onStudentLogin, onBack }: StudentLoginProps) => {
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
    classId: ''
  });

  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    classId: ''
  });

  const handleLogin = () => {
    if (!loginForm.email || !loginForm.password || !loginForm.classId) {
      toast.error("Please fill all fields");
      return;
    }

    // Mock login - in real app, this would authenticate with backend
    const student: Student = {
      id: Date.now().toString(),
      name: loginForm.email.split('@')[0], // Mock name from email
      email: loginForm.email,
      classId: loginForm.classId,
      enrolledAt: new Date()
    };

    onStudentLogin(student);
    toast.success("Login successful!");
  };

  const handleRegister = () => {
    if (!registerForm.name || !registerForm.email || !registerForm.password || !registerForm.classId) {
      toast.error("Please fill all fields");
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    // Mock registration - in real app, this would create account in backend
    const student: Student = {
      id: Date.now().toString(),
      name: registerForm.name,
      email: registerForm.email,
      classId: registerForm.classId,
      enrolledAt: new Date()
    };

    onStudentLogin(student);
    toast.success("Registration successful!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Student Portal</h1>
          <p className="text-muted-foreground">Access your class tests and assignments</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center">
              Login or register to access your class
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      placeholder="student@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      placeholder="Enter your password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-class">Select Your Class</Label>
                    <Select value={loginForm.classId} onValueChange={(value) => setLoginForm({ ...loginForm, classId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose your class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4" />
                              <span>{cls.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleLogin} className="w-full">
                  <LogIn className="h-4 w-4 mr-2" />
                  Login
                </Button>
              </TabsContent>

              <TabsContent value="register" className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="register-name">Full Name</Label>
                    <Input
                      id="register-name"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      placeholder="student@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-password">Password</Label>
                    <Input
                      id="register-password"
                      type="password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      placeholder="Create a password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-confirm">Confirm Password</Label>
                    <Input
                      id="register-confirm"
                      type="password"
                      value={registerForm.confirmPassword}
                      onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                      placeholder="Confirm your password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-class">Select Your Class</Label>
                    <Select value={registerForm.classId} onValueChange={(value) => setRegisterForm({ ...registerForm, classId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose your class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4" />
                              <span>{cls.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleRegister} className="w-full">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Register
                </Button>
              </TabsContent>
            </Tabs>

            <div className="mt-4 text-center">
              <Button variant="outline" onClick={onBack}>
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};