import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Heart, BarChart3, CreditCard, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ParentAuth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [parentName, setParentName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { signIn, signUpAsParent, resetPassword, user, currentRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user && currentRole === 'parent') {
      navigate("/parent-dashboard");
    }
  }, [user, currentRole, navigate]);

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
    const { error } = await signIn(email, password, 'parent');
    setIsLoading(false);
    
    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      navigate("/parent-dashboard");
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
    if (!email || !password || !parentName) {
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
    const { error } = await signUpAsParent(email, password, parentName);
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
        description: "Your parent account has been created successfully.",
      });
      navigate("/parent-dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/10 via-background to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Users className="h-10 w-10 text-secondary" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-secondary to-secondary/70 bg-clip-text text-transparent">
              Parent Portal
            </h1>
          </div>
          <p className="text-muted-foreground">Monitor and support your child's learning journey</p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <BarChart3 className="h-6 w-6 mx-auto text-secondary" />
            <p className="text-xs text-muted-foreground">Track Progress</p>
          </div>
          <div className="space-y-1">
            <Heart className="h-6 w-6 mx-auto text-destructive" />
            <p className="text-xs text-muted-foreground">Support Learning</p>
          </div>
          <div className="space-y-1">
            <CreditCard className="h-6 w-6 mx-auto text-success" />
            <p className="text-xs text-muted-foreground">Manage Plan</p>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="border-secondary/20 bg-card/80 backdrop-blur-sm">
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
                      placeholder="parent@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-secondary hover:bg-secondary/90" 
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
                <CardTitle className="text-2xl text-center">Parent Account</CardTitle>
                <CardDescription className="text-center">
                  Sign in to manage your children's learning
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
                          placeholder="parent@example.com"
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
                        className="w-full bg-secondary hover:bg-secondary/90" 
                        disabled={isLoading}
                      >
                        {isLoading ? "Signing in..." : "Sign In as Parent"}
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
                        <Label htmlFor="signup-name">Your Name</Label>
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="John Smith"
                          value={parentName}
                          onChange={(e) => setParentName(e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="parent@example.com"
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
                        className="w-full bg-secondary hover:bg-secondary/90" 
                        disabled={isLoading}
                      >
                        {isLoading ? "Creating account..." : "Create Parent Account"}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          )}
        </Card>

        <div className="text-center space-y-2">
          <div className="flex flex-col gap-2">
            <Button 
              variant="ghost" 
              className="text-muted-foreground"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            <Button 
              variant="link" 
              className="text-muted-foreground"
              onClick={() => navigate("/auth")}
            >
              Student Sign In
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Supporting your child's vocabulary journey! 📚
          </p>
        </div>
      </div>
    </div>
  );
};

export default ParentAuth;
