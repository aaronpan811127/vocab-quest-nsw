import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  CreditCard, 
  BarChart3, 
  Settings, 
  Plus, 
  LogOut,
  User,
  Trophy,
  Flame,
  BookOpen,
  AlertCircle,
  ChevronRight,
  Moon,
  Sun
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { AddChildDialog } from "@/components/parent/AddChildDialog";
import { ChildProgressCard } from "@/components/parent/ChildProgressCard";

interface ParentProfile {
  id: string;
  parent_name: string;
  subscription_status: string;
  subscription_tier: string | null;
}

interface ChildData {
  id: string;
  student_user_id: string;
  student_email: string;
  relationship_status: string;
  profile?: {
    username: string;
    avatar_url: string | null;
  };
  stats?: {
    total_xp: number;
    level: number;
    study_streak: number;
  };
}

const ParentDashboard = () => {
  const { user, currentRole, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  
  const [parentProfile, setParentProfile] = useState<ParentProfile | null>(null);
  const [children, setChildren] = useState<ChildData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/parent-auth");
      return;
    }
    
    if (currentRole !== 'parent') {
      navigate("/");
      return;
    }

    fetchParentData();
  }, [user, currentRole, navigate]);

  const fetchParentData = async () => {
    if (!user) return;

    try {
      // Fetch parent profile
      let { data: profile, error: profileError } = await supabase
        .from("parent_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      // If no parent profile exists (e.g., existing student adding parent role), create one
      if (!profile) {
        const { data: newProfile, error: createError } = await supabase
          .from("parent_profiles")
          .insert({
            user_id: user.id,
            parent_name: user.email?.split('@')[0] || 'Parent'
          })
          .select()
          .single();

        if (createError) throw createError;
        profile = newProfile;

        // Also ensure parent role exists in user_roles
        await supabase
          .from("user_roles")
          .insert({ user_id: user.id, role: 'parent' })
          .select();
      }

      setParentProfile(profile);

      // Fetch children
      const { data: childrenData, error: childrenError } = await supabase
        .from("parent_children")
        .select("*")
        .eq("parent_id", profile.id)
        .eq("relationship_status", "active");

      if (childrenError) throw childrenError;

      // Fetch profiles and stats for each child
      const enrichedChildren = await Promise.all(
        (childrenData || []).map(async (child) => {
          const [profileResult, statsResult] = await Promise.all([
            supabase
              .from("profiles")
              .select("username, avatar_url")
              .eq("user_id", child.student_user_id)
              .single(),
            supabase
              .from("leaderboard")
              .select("total_xp, level, study_streak")
              .eq("user_id", child.student_user_id)
              .limit(1)
          ]);

          return {
            ...child,
            profile: profileResult.data || undefined,
            stats: statsResult.data?.[0] || undefined
          };
        })
      );

      setChildren(enrichedChildren);
    } catch (error) {
      console.error("Error fetching parent data:", error);
      toast({
        title: "Error loading data",
        description: "Failed to load your dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-secondary" />
            <div>
              <h1 className="font-bold text-xl">Parent Portal</h1>
              <p className="text-sm text-muted-foreground">
                Welcome, {parentProfile?.parent_name}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="children" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="children" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Children
            </TabsTrigger>
            <TabsTrigger value="subscription" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Plan
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Children Tab */}
          <TabsContent value="children" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Your Children</h2>
                <p className="text-muted-foreground">
                  {children.length} student{children.length !== 1 ? 's' : ''} linked
                </p>
              </div>
              <Button onClick={() => setShowAddChild(true)} className="bg-secondary hover:bg-secondary/90">
                <Plus className="h-4 w-4 mr-2" />
                Add Child
              </Button>
            </div>

            {children.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No children linked yet</h3>
                  <p className="text-muted-foreground mb-4 max-w-sm">
                    Add your children to track their progress and manage their learning journey.
                  </p>
                  <Button onClick={() => setShowAddChild(true)} className="bg-secondary hover:bg-secondary/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Child
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {children.map((child) => (
                  <ChildProgressCard 
                    key={child.id} 
                    child={child}
                    onRefresh={fetchParentData}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Subscription & Billing</h2>
              <p className="text-muted-foreground">Manage your plan and payment details</p>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Current Plan</CardTitle>
                    <CardDescription>Your subscription details</CardDescription>
                  </div>
                  <Badge variant={parentProfile?.subscription_status === 'active' ? 'default' : 'secondary'}>
                    {parentProfile?.subscription_status || 'Free'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">
                      {parentProfile?.subscription_tier || 'Free Tier'}
                    </span>
                    <span className="text-muted-foreground">
                      {parentProfile?.subscription_status === 'active' ? 'Active' : 'Limited Access'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {parentProfile?.subscription_status === 'active' 
                      ? 'Full access to all features and unlimited children'
                      : 'Upgrade to unlock premium features and add more children'}
                  </p>
                </div>

                <Button className="w-full" variant="outline">
                  <CreditCard className="h-4 w-4 mr-2" />
                  {parentProfile?.subscription_status === 'active' ? 'Manage Subscription' : 'Upgrade Plan'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Settings</h2>
              <p className="text-muted-foreground">Manage your account and preferences</p>
            </div>

            <div className="grid gap-4">
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Profile Settings</p>
                      <p className="text-sm text-muted-foreground">Update your name and email</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Notifications</p>
                      <p className="text-sm text-muted-foreground">Manage email and push notifications</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <AddChildDialog 
        open={showAddChild} 
        onOpenChange={setShowAddChild}
        parentId={parentProfile?.id || ''}
        parentName={parentProfile?.parent_name || ''}
        onSuccess={fetchParentData}
      />
    </div>
  );
};

export default ParentDashboard;
