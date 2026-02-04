import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Gamepad2, Users, Crown, Clock, Trophy, Star, Home, Sun, Moon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { PRICING, PlanType } from "@/config/pricing";

const Pricing = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [billingCycle, setBillingCycle] = useState<PlanType>('monthly');

  const currentPrice = billingCycle === 'annual' 
    ? PRICING.premium.annualPrice 
    : PRICING.premium.monthlyPrice;
  
  const priceLabel = billingCycle === 'annual' ? '/year' : '/month';

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-primary">
                <Gamepad2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
              </div>
              <h1 className="font-bold text-lg sm:text-2xl">VocabQuest</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Home</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-24 sm:pt-32 pb-8 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="bg-primary/10 text-primary border-primary/30 px-4 py-2 text-sm font-medium mb-4">
            <Crown className="h-4 w-4 mr-2" />
            Simple Pricing
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Start Learning Today</h2>
        </div>
      </section>


      {/* Billing Toggle */}
      <div className="max-w-5xl mx-auto px-4 pt-12">
        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
              billingCycle === 'monthly'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors relative ${
              billingCycle === 'annual'
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
      </div>

      {/* Pricing Cards */}
      <div className="max-w-5xl mx-auto px-4 pb-12">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Free Trial Card */}
          <Card className="relative border-2 border-border hover:border-primary/50 transition-colors">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Gamepad2 className="h-8 w-8 text-primary" />
              </div>
              <Badge variant="outline" className="mb-2 bg-primary/10 text-primary border-primary/30">
                <Clock className="h-3 w-3 mr-1" />
                7-Day Trial
              </Badge>
              <CardTitle className="text-2xl">{PRICING.free.name}</CardTitle>
              <CardDescription>Perfect to get started</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground ml-2">for 7 days</span>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Student Features */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Gamepad2 className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">For Students</span>
                </div>
                <ul className="space-y-2">
                  {PRICING.free.student.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Parent Features */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-secondary" />
                  <span className="font-semibold text-sm">For Parents</span>
                </div>
                <ul className="space-y-2">
                  {PRICING.free.parent.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => navigate("/auth")}
              >
                <Gamepad2 className="h-4 w-4 mr-2" />
                Start Free Trial
              </Button>
              <p className="text-xs text-muted-foreground text-center">
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
                <Crown className="h-8 w-8 text-secondary" />
              </div>
              <Badge variant="outline" className="mb-2 bg-secondary/10 text-secondary border-secondary/30">
                <Crown className="h-3 w-3 mr-1" />
                Full Access
              </Badge>
              <CardTitle className="text-2xl">{PRICING.premium.name}</CardTitle>
              <CardDescription>Unlimited access for your family</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">${currentPrice}</span>
                <span className="text-muted-foreground ml-2">{priceLabel}</span>
                {billingCycle === 'annual' && (
                  <p className="text-sm text-accent mt-1">
                    Save ${PRICING.premium.annualSavings} compared to monthly
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Student Features */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Gamepad2 className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">For Students</span>
                </div>
                <ul className="space-y-2">
                  {PRICING.premium.student.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Parent Features */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-secondary" />
                  <span className="font-semibold text-sm">For Parents</span>
                </div>
                <ul className="space-y-2">
                  {PRICING.premium.parent.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button 
                className="w-full bg-secondary hover:bg-secondary/90"
                onClick={() => navigate("/parent-auth")}
              >
                <Users className="h-4 w-4 mr-2" />
                Subscribe as Parent
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Cancel anytime • Billed {billingCycle === 'annual' ? 'annually' : 'monthly'}
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
                Create a free student account and get instant access to the first 2 units for 7 days
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
                Unlock unlimited units and full progress reports with a Premium subscription
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
              <CardTitle className="text-base">What's included in the free trial?</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <p className="text-sm text-muted-foreground">
                Students get 7 days of access to the first 2 units and all vocabulary games. 
                Parents can link 1 child and view high-level progress. Perfect for trying before subscribing!
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base">Can I add multiple children to my account?</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <p className="text-sm text-muted-foreground">
                Yes! Premium parent accounts can link up to 3 student accounts, making it perfect for families 
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
                After the trial period, students will need a parent to subscribe to continue accessing all units. 
                All progress is saved, so nothing is lost when upgrading to Premium.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base">Should I choose monthly or annual billing?</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <p className="text-sm text-muted-foreground">
                Annual billing saves you ${PRICING.premium.annualSavings} per year compared to monthly billing. 
                If you're committed to long-term preparation, annual is the better value.
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

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 border-t bg-card">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-primary">
              <Gamepad2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold">VocabQuest</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} VocabQuest. Making vocabulary learning fun.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;
