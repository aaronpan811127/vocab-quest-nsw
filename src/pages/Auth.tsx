import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, Sparkles, Trophy, BookOpen, ArrowLeft, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { signIn, signUp, resetPassword, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    const { error } = await signIn(email, password, 'student');
    setIsLoading(false);
    
    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    const { error } = await resetPassword(email);
    setIsLoading(false);
    
    if (error) {
      toast({
        title: "Reset failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Check your email",
        description: "We've sent you a password reset link.",
      });
      setShowForgotPassword(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    const { error } = await signUp(email, password, username);
    setIsLoading(false);
    
    if (error) {
      if (/(already registered|already exists)/i.test(error.message)) {
        toast({
          title: "Account exists",
          description: "This email is already registered. Try signing in instead.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive"
        });
      }
    } else {
      toast({
        title: "Welcome to VocabQuest!",
        description: "Your account has been created successfully.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Gamepad2 className="h-10 w-10 text-primary" />
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              VocabQuest
            </h1>
          </div>
          <Badge className="bg-primary/20 text-primary border-primary/30">
            Student Portal
          </Badge>
          <p className="text-muted-foreground">Master vocabulary through gaming!</p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <BookOpen className="h-6 w-6 mx-auto text-primary" />
            <p className="text-xs text-muted-foreground">10+ Units</p>
          </div>
          <div className="space-y-1">
            <Trophy className="h-6 w-6 mx-auto text-warning" />
            <p className="text-xs text-muted-foreground">Leaderboard</p>
          </div>
          <div className="space-y-1">
            <Sparkles className="h-6 w-6 mx-auto text-success" />
            <p className="text-xs text-muted-foreground">4 Game Types</p>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="border-primary/20 bg-card/80 backdrop-blur-sm">
          {showForgotPassword ? (
            <>
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl text-center">Reset Password</CardTitle>
                <CardDescription className="text-center">
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
                      placeholder="player@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    variant="gaming"
                    disabled={isLoading}
                  >
                    {isLoading ? "Sending..." : "Send Reset Link"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setShowForgotPassword(false)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Sign In
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl text-center">Get Started</CardTitle>
                <CardDescription className="text-center">
                  Sign in to save your progress and compete on the leaderboard
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="signin" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="signin">Sign In</TabsTrigger>
                    <TabsTrigger value="signup">Sign Up</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="signin">
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signin-email">Email</Label>
                        <Input
                          id="signin-email"
                          type="email"
                          placeholder="player@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signin-password">Password</Label>
                        <Input
                          id="signin-password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full" 
                        variant="gaming"
                        disabled={isLoading}
                      >
                        {isLoading ? "Signing in..." : "Sign In"}
                      </Button>
                      <Button
                        type="button"
                        variant="link"
                        className="w-full text-muted-foreground"
                        onClick={() => setShowForgotPassword(true)}
                      >
                        Forgot your password?
                      </Button>
                    </form>
                  </TabsContent>
                  
                  <TabsContent value="signup">
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-username">Username</Label>
                        <Input
                          id="signup-username"
                          type="text"
                          placeholder="VocabMaster"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="player@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full" 
                        variant="gaming"
                        disabled={isLoading}
                      >
                        {isLoading ? "Creating account..." : "Create Account"}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          )}
        </Card>

        <div className="text-center space-y-2">
          <Button 
            variant="ghost" 
            className="text-muted-foreground"
            onClick={() => navigate("/parent-auth")}
          >
            <Users className="h-4 w-4 mr-2" />
            Are you a parent? Sign in here
          </Button>
          <p className="text-xs text-muted-foreground">
            By continuing, you agree to learn awesome vocabulary! 🎮
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
