import { useSearchParams } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gamepad2, FileText, Home, Sun, Moon, ScrollText, CreditCard, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { SiteFooter } from "@/components/SiteFooter";
import { WebsiteTerms } from "@/components/terms/WebsiteTerms";
import { SubscriptionTerms } from "@/components/terms/SubscriptionTerms";
import { PrivacyPolicy } from "@/components/terms/PrivacyPolicy";

const Terms = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "subscription" ? "subscription" : tabParam === "privacy" ? "privacy" : "website";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Terms & Conditions"
        description="Read VocabQuests' terms of service, subscription terms, and privacy policy. Learn about our data practices and children's privacy protections."
        path="/terms"
      />
      <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-primary">
                <Gamepad2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg sm:text-2xl">VocabQuests</span>
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
      <section className="pt-24 sm:pt-32 pb-4 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="bg-primary/10 text-primary border-primary/30 px-4 py-2 text-sm font-medium mb-4">
            <FileText className="h-4 w-4 mr-2" />
            Legal
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Terms & Conditions</h1>
          <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </section>

      {/* Tabs */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="website" className="gap-2">
              <ScrollText className="h-4 w-4" />
              Website T&C
            </TabsTrigger>
            <TabsTrigger value="subscription" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Subscription T&C
            </TabsTrigger>
            <TabsTrigger value="privacy" className="gap-2">
              <Shield className="h-4 w-4" />
              Privacy Policy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="website">
            <WebsiteTerms />
          </TabsContent>

          <TabsContent value="subscription">
            <SubscriptionTerms />
          </TabsContent>

          <TabsContent value="privacy">
            <PrivacyPolicy />
          </TabsContent>
        </Tabs>
      </section>

      <SiteFooter />
    </div>
  );
};

export default Terms;
