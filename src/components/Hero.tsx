import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Gamepad2, 
  Zap, 
  Trophy, 
  Star,
  ArrowRight,
  LogIn
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-gaming.jpg";

interface HeroProps {
  onStartPlaying?: () => void;
  onViewLeaderboard?: () => void;
}

export const Hero = ({ onStartPlaying, onViewLeaderboard }: HeroProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleStartPlaying = () => {
    if (user) {
      onStartPlaying?.();
    } else {
      navigate("/auth");
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image - Using img tag for LCP optimization */}
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

      {/* Floating Elements */}
      <div className="absolute inset-0 z-1">
        <div className="absolute top-20 left-10 animate-float">
          <Badge className="bg-primary/20 text-primary border-primary/30">
            <Star className="h-3 w-3 mr-1 fill-current" />
            Level Up!
          </Badge>
        </div>
        <div className="absolute top-40 right-20 animate-float" style={{animationDelay: '1s'}}>
          <Badge className="bg-success/20 text-success border-success/30">
            <Trophy className="h-3 w-3 mr-1 fill-current" />
            Achievement
          </Badge>
        </div>
        <div className="absolute bottom-40 left-20 animate-float" style={{animationDelay: '2s'}}>
          <Badge className="bg-secondary/20 text-secondary border-secondary/30">
            <Zap className="h-3 w-3 mr-1 fill-current" />
            Streak: 7
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center space-y-8 animate-slide-up">
        {/* Badge */}
        <Badge className="bg-gradient-primary text-primary-foreground px-4 py-2 text-sm font-medium">
          <Gamepad2 className="h-4 w-4 mr-2" />
          NSW Selective School Prep
        </Badge>

        {/* Headline */}
        <div className="space-y-4">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            Level Up Your{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              Vocabulary
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Master words through epic gaming adventures. Four skill-building games, 
            endless fun, and real results for your selective school test.
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center gap-8 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">10</div>
            <div className="text-muted-foreground">Words per Unit</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-secondary">4</div>
            <div className="text-muted-foreground">Game Types</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">∞</div>
            <div className="text-muted-foreground">Practice Rounds</div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button 
            variant="hero" 
            size="lg" 
            className="text-lg px-8 py-6 animate-glow-pulse"
            onClick={handleStartPlaying}
          >
            {user ? (
              <>
                <Gamepad2 className="h-5 w-5 mr-2" />
                Continue Playing
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            ) : (
              <>
                <LogIn className="h-5 w-5 mr-2" />
                Sign In to Play
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>
          
          <Button 
            variant="gaming" 
            size="lg" 
            className="text-lg px-8 py-6"
            onClick={onViewLeaderboard}
          >
            <Trophy className="h-5 w-5 mr-2" />
            View Leaderboard
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-3xl mx-auto">
          {[
            { icon: "📖", label: "Reading", desc: "Comprehension" },
            { icon: "🎧", label: "Listening", desc: "Dictation" },
            { icon: "🎤", label: "Speaking", desc: "Pronunciation" },
            { icon: "✍️", label: "Writing", desc: "Creativity" },
          ].map((feature, index) => (
            <div 
              key={feature.label}
              className="text-center p-4 rounded-lg bg-card/30 backdrop-blur-sm border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-card"
              style={{animationDelay: `${index * 0.1}s`}}
            >
              <div className="text-3xl mb-2">{feature.icon}</div>
              <div className="font-semibold">{feature.label}</div>
              <div className="text-xs text-muted-foreground">{feature.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
