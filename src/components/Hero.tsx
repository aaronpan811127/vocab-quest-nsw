import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, Zap, Trophy, Star, LogIn, GraduationCap, BookOpen, Target, Award, Users, HelpCircle, ShieldCheck, GraduationCap as EducatorIcon, FlaskConical, Clock, Swords } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTestType, TestType } from "@/contexts/TestTypeContext";
import { useNavigate } from "react-router-dom";

interface HeroProps {
  onSelectTestType?: (testType: TestType) => void;
}

const testTypeIcons: Record<string, typeof GraduationCap> = {
  SELECTIVE: GraduationCap,
  OC: Target,
  NAPLAN_Y3: BookOpen,
  NAPLAN_Y5: Award,
};

const testTypeColors: Record<string, string> = {
  SELECTIVE: "from-primary to-primary/80",
  OC: "from-secondary to-secondary/80",
  NAPLAN_Y3: "from-success to-success/80",
  NAPLAN_Y5: "from-warning to-warning/80",
};

export const Hero = ({ onSelectTestType }: HeroProps) => {
  const { user } = useAuth();
  const { testTypes, selectedTestType, setSelectedTestType, loading } = useTestType();
  const navigate = useNavigate();

  // Defer decorative cat-pattern (73KB) to avoid blocking LCP
  const [catPatternUrl, setCatPatternUrl] = useState<string | null>(null);
  useEffect(() => {
    import("@/assets/cat-pattern.png").then(mod => setCatPatternUrl(mod.default));
  }, []);

  const handleSelectTestType = (testType: TestType) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setSelectedTestType(testType);
    onSelectTestType?.(testType);
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src="/images/hero-gaming.jpg"
          alt="VocabQuests gamified vocabulary learning for NSW students"
          fetchPriority="high"
          decoding="async"
          width={1539}
          height={1080}
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" />
      </div>

      {/* Cartoon Cat Pattern Overlay - deferred to not block LCP */}
      {catPatternUrl && (
        <div
          className="absolute inset-0 z-[1] opacity-[0.12] dark:opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage: `url(${catPatternUrl})`,
            backgroundSize: '400px 400px',
            backgroundRepeat: 'repeat',
          }}
        />
      )}

      {/* Floating Elements - Hidden on mobile */}
      <div className="absolute inset-0 z-[2] hidden sm:block">
        <div className="absolute top-20 left-10 animate-float">
          <Badge className="bg-primary/20 text-primary border-primary/30">
            <Star className="h-3 w-3 mr-1 fill-current" />
            Level Up!
          </Badge>
        </div>
        <div className="absolute top-40 right-20 animate-float" style={{ animationDelay: "1s" }}>
          <Badge className="bg-success/20 text-success border-success/30">
            <Trophy className="h-3 w-3 mr-1 fill-current" />
            Achievement
          </Badge>
        </div>
        <div className="absolute bottom-40 left-20 animate-float" style={{ animationDelay: "2s" }}>
          <Badge className="bg-secondary/20 text-secondary border-secondary/30">
            <Zap className="h-3 w-3 mr-1 fill-current" />
            Streak: 7
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6 sm:space-y-8 animate-slide-up">
        {/* Badge */}
        <Badge className="bg-gradient-primary text-primary-foreground px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium">
          <Gamepad2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
          VocabQuests Learning
        </Badge>

        {/* Headline */}
        <div className="space-y-3 sm:space-y-4">
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight">
            Level Up Your <span className="bg-gradient-primary bg-clip-text text-transparent">Vocabulary</span>
          </h1>
           <p className="text-base sm:text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed px-2">
             The only platform purpose-built for NSW students to master vocabulary, strengthen reading skills, and excel in Selective, OC &amp; NAPLAN tests.
           </p>
         </div>

         {/* Value Props */}
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-2xl mx-auto">
           <div className="flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-card/40 backdrop-blur-sm border border-border/50 text-left">
             <div className="p-2 rounded-lg bg-warning/15 flex-shrink-0">
               <Swords className="h-5 w-5 text-warning" />
             </div>
             <div>
               <div className="font-semibold text-xs sm:text-sm">Epic Gaming Adventures</div>
               <div className="text-[10px] sm:text-xs text-muted-foreground">Master words through fun, engaging game modes</div>
             </div>
           </div>
           <div className="flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-card/40 backdrop-blur-sm border border-border/50 text-left">
             <div className="p-2 rounded-lg bg-primary/15 flex-shrink-0">
               <Clock className="h-5 w-5 text-primary" />
             </div>
             <div>
               <div className="font-semibold text-xs sm:text-sm">20-Min Daily Challenges</div>
               <div className="text-[10px] sm:text-xs text-muted-foreground">Build vocabulary with real results, every day</div>
             </div>
           </div>
         </div>

        {/* Trust Signals */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-3xl mx-auto">
          <div className="flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-card/40 backdrop-blur-sm border border-border/50 text-left">
            <div className="p-2 rounded-lg bg-primary/15 flex-shrink-0">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-xs sm:text-sm">NSW-Focused</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Only platform dedicated to NSW vocab test prep</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-card/40 backdrop-blur-sm border border-border/50 text-left">
            <div className="p-2 rounded-lg bg-secondary/15 flex-shrink-0">
              <GraduationCap className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <div className="font-semibold text-xs sm:text-sm">Expert-Created</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Built by educators with decades of experience</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-card/40 backdrop-blur-sm border border-border/50 text-left">
            <div className="p-2 rounded-lg bg-success/15 flex-shrink-0">
              <FlaskConical className="h-5 w-5 text-success" />
            </div>
            <div>
              <div className="font-semibold text-xs sm:text-sm">Science-Backed</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Spaced repetition based on proven research</div>
            </div>
          </div>
        </div>

        {/* Test Type Selection */}
        <div className="space-y-4">
          {!user ? (
            <div className="flex flex-col items-center gap-6">
              <Button
                variant="hero"
                size="lg"
                className="text-lg sm:text-xl px-8 sm:px-10 py-6 sm:py-7 animate-glow-pulse w-full sm:w-auto"
                onClick={() => navigate("/auth")}
              >
                <Zap className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
                Start 7-Day Free Trial
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-5 border-primary/50 text-primary hover:bg-primary/10 font-semibold gap-2"
                onClick={() => navigate("/how-it-works")}
              >
                <HelpCircle className="h-5 w-5" />
                See How It Works
              </Button>
            </div>
          ) : loading ? (
            <div className="flex justify-center gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-40 h-32 bg-card/30 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 max-w-3xl mx-auto">
              {testTypes.map((testType) => {
                const Icon = testTypeIcons[testType.code] || GraduationCap;
                const gradient = testTypeColors[testType.code] || "from-primary to-primary/80";
                const isSelected = selectedTestType?.id === testType.id;

                return (
                  <button
                    key={testType.id}
                    onClick={() => handleSelectTestType(testType)}
                    className={`
                      relative p-4 sm:p-5 rounded-xl border-2 transition-all duration-300
                      hover:scale-105 hover:shadow-card text-left w-36 sm:w-40
                      ${
                        isSelected
                          ? `border-primary bg-primary/10 ring-2 ring-primary/50`
                          : `border-border/50 bg-card/30 backdrop-blur-sm hover:border-primary/30`
                      }
                    `}
                  >
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1">
                        <Star className="h-3 w-3 fill-current" />
                      </div>
                    )}
                    <div
                      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center mb-3`}
                    >
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
                    </div>
                    <div className="font-semibold text-sm sm:text-base">{testType.name}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {testType.description || "Vocabulary prep"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
