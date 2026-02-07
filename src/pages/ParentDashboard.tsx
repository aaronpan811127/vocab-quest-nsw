import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  CreditCard, 
  Settings, 
  Plus, 
  LogOut,
  User,
  AlertCircle,
  Moon,
  Sun,
  Check,
  Crown,
  Loader2,
  Gamepad2,
  ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { AddChildDialog } from "@/components/parent/AddChildDialog";
import { ChildProgressCard } from "@/components/parent/ChildProgressCard";
import { PRICING, PlanType } from "@/config/pricing";

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
  const { tier, subscribed, subscriptionEnd, billingInterval, loading: subLoading, checkSubscription, maxChildren, canViewProgressReports, hasFullProgressReports } = useSubscription();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  
  const [parentProfile, setParentProfile] = useState<ParentProfile | null>(null);
  const [children, setChildren] = useState<ChildData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('monthly');

  // Check for checkout success/cancel
  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout');
    if (checkoutStatus === 'success') {
      toast({
        title: "Subscription activated!",
        description: "Welcome to Premium! You now have access to all features.",
      });
      checkSubscription();
    } else if (checkoutStatus === 'cancelled') {
      toast({
        title: "Checkout cancelled",
        description: "No charges were made.",
        variant: "destructive",
      });
    }
  }, [searchParams]);

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
        .select("id, parent_name, subscription_status, subscription_tier")
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

  const handleUpgrade = async (plan: PlanType = 'monthly') => {
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan }
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: "Error",
        description: "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error opening portal:', error);
      toast({
        title: "Error",
        description: "Failed to open subscription management. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const canAddChild = children.length < maxChildren;

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
                  {children.length}/{maxChildren} student{maxChildren !== 1 ? 's' : ''} linked
                  {!canAddChild && tier === 'free' && (
                    <span className="text-accent ml-2">• Upgrade for more</span>
                  )}
                </p>
              </div>
              <Button 
                onClick={() => canAddChild ? setShowAddChild(true) : handleUpgrade('monthly')} 
                className={canAddChild ? "bg-secondary hover:bg-secondary/90" : ""}
                variant={canAddChild ? "default" : "outline"}
              >
                {canAddChild ? (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Child
                  </>
                ) : (
                  <>
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade to Add More
                  </>
                )}
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
                    canViewProgress={canViewProgressReports}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Subscription & Billing</h2>
              <p className="text-muted-foreground">Choose the plan that's right for your family</p>
            </div>

            {/* Billing Toggle - Only show if not subscribed */}
            {!subscribed && (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setSelectedPlan('monthly')}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedPlan === 'monthly'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setSelectedPlan('annual')}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-colors relative ${
                    selectedPlan === 'annual'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  Annual
                  <Badge className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-xs px-1.5">
                    Save ${PRICING.premium.annualSavings}
                  </Badge>
                </button>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              {/* Free Plan */}
              <Card className={`relative ${tier === 'free' ? 'border-primary ring-2 ring-primary/20' : ''}`}>
                {tier === 'free' && (
                  <Badge className="absolute -top-2 right-4 bg-primary">Current Plan</Badge>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {PRICING.free.name}
                  </CardTitle>
                  <CardDescription>7-day trial access</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-3xl font-bold">$0<span className="text-lg font-normal text-muted-foreground"> for 7 days</span></div>
                  
                  {/* Student Features */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Gamepad2 className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">For Students</span>
                    </div>
                    <ul className="space-y-1.5 text-sm">
                      {PRICING.free.student.features.slice(0, 3).map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Parent Features */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-secondary" />
                      <span className="font-semibold text-sm">For Parents</span>
                    </div>
                    <ul className="space-y-1.5 text-sm">
                      {PRICING.free.parent.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-secondary shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {tier === 'free' && (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Premium Plan */}
              <Card className={`relative ${tier === 'premium' ? 'border-primary ring-2 ring-primary/20' : 'border-secondary'}`}>
                {tier === 'premium' ? (
                  <Badge className="absolute -top-2 right-4 bg-primary">
                    Current Plan {billingInterval === 'annual' ? '(Annual)' : '(Monthly)'}
                  </Badge>
                ) : (
                  <Badge className="absolute -top-2 right-4 bg-secondary">Recommended</Badge>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-secondary" />
                    {PRICING.premium.name}
                  </CardTitle>
                  <CardDescription>Full access for your family</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="text-3xl font-bold">
                      ${subscribed 
                        ? (billingInterval === 'annual' ? PRICING.premium.annualPrice : PRICING.premium.monthlyPrice)
                        : (selectedPlan === 'annual' ? PRICING.premium.annualPrice : PRICING.premium.monthlyPrice)
                      }
                      <span className="text-lg font-normal text-muted-foreground">
                        {subscribed 
                          ? (billingInterval === 'annual' ? '/year' : '/month')
                          : (selectedPlan === 'annual' ? '/year' : '/month')
                        }
                      </span>
                    </div>
                    {!subscribed && selectedPlan === 'annual' && (
                      <p className="text-sm text-accent mt-1">
                        Save ${PRICING.premium.annualSavings} compared to monthly
                      </p>
                    )}
                  </div>
                  
                  {/* Student Features */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Gamepad2 className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">For Students</span>
                    </div>
                    <ul className="space-y-1.5 text-sm">
                      {PRICING.premium.student.features.slice(0, 3).map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Parent Features */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-secondary" />
                      <span className="font-semibold text-sm">For Parents</span>
                    </div>
                    <ul className="space-y-1.5 text-sm">
                      {PRICING.premium.parent.features.slice(0, 3).map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-secondary shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {tier === 'premium' ? (
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={handleManageSubscription}
                      disabled={portalLoading}
                    >
                      {portalLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4 mr-2" />
                      )}
                      Manage Subscription
                    </Button>
                  ) : (
                    <Button 
                      className="w-full bg-secondary hover:bg-secondary/90" 
                      onClick={() => handleUpgrade(selectedPlan)}
                      disabled={checkoutLoading}
                    >
                      {checkoutLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Crown className="h-4 w-4 mr-2" />
                      )}
                      Upgrade to Premium
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            {subscribed && subscriptionEnd && (
              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">Subscription Active</p>
                    <p className="text-sm text-muted-foreground">
                      Next billing date: {new Date(subscriptionEnd).toLocaleDateString()}
                      {billingInterval && ` • Billed ${billingInterval === 'annual' ? 'annually' : 'monthly'}`}
                    </p>
                  </div>
                  <Button variant="outline" onClick={handleManageSubscription} disabled={portalLoading}>
                    {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Manage'}
                  </Button>
                </CardContent>
              </Card>
            )}
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
