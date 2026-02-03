import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Gamepad2, Users, Crown, Clock, BookOpen, Trophy, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Pricing = () => {
  const navigate = useNavigate();

  const freeFeatures = [
    "Access to all vocabulary games",
    "NSW Selective & OC curriculum aligned",
    "Progress tracking dashboard",
    "Leaderboard access",
    "7 days full access",
  ];

  const premiumFeatures = [
    "Everything in Free Trial",
    "Unlimited access to all units",
    "Priority content updates",
    "Detailed progress analytics",
    "Parent dashboard access",
    "Multiple child accounts",
    "Email support",
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-hero py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-primary/20 text-primary border-primary/30">
            <Crown className="h-4 w-4 mr-2" />
            Simple Pricing
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Start Learning Today
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Give your child the best preparation for NSW Selective & OC tests with our engaging vocabulary platform
          </p>
        </div>
      </div>

      {/* Trial Highlight Banner */}
      <div className="max-w-4xl mx-auto px-4 -mt-8">
        <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-secondary/20 border-2 border-primary/30 rounded-2xl p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-2xl font-bold text-primary">7-Day Free Trial</span>
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <p className="text-muted-foreground">
            Students can start their learning journey immediately with full access for 7 days — no payment required!
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Free Trial Card */}
          <Card className="relative border-2 border-border hover:border-primary/50 transition-colors">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Gamepad2 className="h-8 w-8 text-primary" />
              </div>
              <Badge variant="outline" className="mb-2 bg-primary/10 text-primary border-primary/30">
                <Clock className="h-3 w-3 mr-1" />
                For Students
              </Badge>
              <CardTitle className="text-2xl">Free Trial</CardTitle>
              <CardDescription>Perfect to get started</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground ml-2">for 7 days</span>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <ul className="space-y-3">
                {freeFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button 
                className="w-full mt-6" 
                variant="outline"
                onClick={() => navigate("/auth")}
              >
                <Gamepad2 className="h-4 w-4 mr-2" />
                Start Free Trial
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                Sign up with a student account to begin
              </p>
            </CardContent>
          </Card>

          {/* Premium Card */}
          <Card className="relative border-2 border-secondary shadow-lg shadow-secondary/20">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <Badge className="bg-secondary text-secondary-foreground px-4 py-1">
                <Star className="h-3 w-3 mr-1 fill-current" />
                Most Popular
              </Badge>
            </div>
            <CardHeader className="text-center pb-2 pt-8">
              <div className="mx-auto w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-secondary" />
              </div>
              <Badge variant="outline" className="mb-2 bg-secondary/10 text-secondary border-secondary/30">
                <Crown className="h-3 w-3 mr-1" />
                For Parents
              </Badge>
              <CardTitle className="text-2xl">Premium</CardTitle>
              <CardDescription>Full access for your family</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">$9.99</span>
                <span className="text-muted-foreground ml-2">/month</span>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <ul className="space-y-3">
                {premiumFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button 
                className="w-full mt-6 bg-secondary hover:bg-secondary/90"
                onClick={() => navigate("/parent-auth")}
              >
                <Users className="h-4 w-4 mr-2" />
                Subscribe as Parent
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                Cancel anytime • Billed monthly
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="bg-muted/30 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-primary">1</span>
              </div>
              <h3 className="font-semibold mb-2">Student Signs Up</h3>
              <p className="text-sm text-muted-foreground">
                Create a free student account and get instant access to all games for 7 days
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-primary">2</span>
              </div>
              <h3 className="font-semibold mb-2">Learn & Play</h3>
              <p className="text-sm text-muted-foreground">
                Explore vocabulary games, track progress, and compete on leaderboards
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-secondary">3</span>
              </div>
              <h3 className="font-semibold mb-2">Parent Subscribes</h3>
              <p className="text-sm text-muted-foreground">
                After the trial, parents can subscribe to continue the learning journey
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base">Why do parents need to subscribe?</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <p className="text-sm text-muted-foreground">
                VocabQuest is designed for families. Parent accounts allow you to manage your child's learning, 
                track their progress, and ensure a safe learning environment. Subscription revenue helps us 
                maintain quality content aligned with NSW curriculum.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base">Can I add multiple children to my account?</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <p className="text-sm text-muted-foreground">
                Yes! Premium parent accounts can link multiple student accounts, making it perfect for families 
                with more than one child preparing for Selective or OC tests.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base">What happens after the 7-day trial?</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <p className="text-sm text-muted-foreground">
                After the trial period, students will need a parent to subscribe to continue accessing the platform. 
                All progress is saved, so nothing is lost when upgrading to Premium.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-hero py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <Trophy className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Ready to Start?</h2>
          <p className="text-muted-foreground mb-6">
            Join thousands of NSW students preparing for their Selective and OC tests
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth")}>
              <Gamepad2 className="h-5 w-5 mr-2" />
              Start Free Trial
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/parent-auth")}>
              <Users className="h-5 w-5 mr-2" />
              Parent Sign Up
            </Button>
          </div>
        </div>
      </div>

      {/* Back to Home */}
      <div className="py-8 text-center">
        <Button variant="ghost" onClick={() => navigate("/")}>
          ← Back to Home
        </Button>
      </div>
    </div>
  );
};

export default Pricing;