import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, Zap, Trophy, Star, LogIn, GraduationCap, BookOpen, Target, Award, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTestType, TestType } from "@/contexts/TestTypeContext";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-gaming.jpg";

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
          src={heroImage}
          alt=""
          fetchPriority="high"
          decoding="async"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" />
      </div>

      {/* Floating Elements - Hidden on mobile */}
      <div className="absolute inset-0 z-1 hidden sm:block">
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
          VocabQuest Learning
        </Badge>

        {/* Headline */}
        <div className="space-y-3 sm:space-y-4">
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight">
            Level Up Your <span className="bg-gradient-primary bg-clip-text text-transparent">Vocabulary</span>
          </h1>
          <p className="text-base sm:text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed px-2">
            Master words through epic gaming adventures.
            <br />
            15-minute daily challenges that build your vocabulary with endless fun and real results
          </p>
        </div>

        {/* Test Type Selection */}
        <div className="space-y-4">
          {!user ? (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Button
                variant="hero"
                size="lg"
                className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 animate-glow-pulse w-full sm:w-auto"
                onClick={() => navigate("/auth")}
              >
                <LogIn className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Student Sign In
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 border-secondary text-secondary hover:bg-secondary/10 w-full sm:w-auto"
                onClick={() => navigate("/parent-auth")}
              >
                <Users className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Parent Sign In
              </Button>
            </div>
          ) : loading ? (
            <div className="flex justify-center gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-40 h-32 bg-card/30 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto">
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
                      hover:scale-105 hover:shadow-card text-left
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
