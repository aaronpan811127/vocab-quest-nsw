import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Gamepad2, 
  BookOpen, 
  Trophy, 
  Zap, 
  Target, 
  Brain, 
  Sparkles, 
  Clock, 
  TrendingUp, 
  Star,
  ArrowRight,
  CheckCircle2,
  Headphones,
  Mic,
  PenTool,
  LayoutGrid,
  Lightbulb,
  FileText
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { Sun, Moon, Home } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Choose Your Test",
    description: "Select your target exam - Selective, OC, or NAPLAN. We'll customize your learning path to match the exact vocabulary and format you need.",
    icon: Target,
    color: "from-primary to-primary/80",
  },
  {
    number: "02", 
    title: "Pick a Unit",
    description: "Each unit contains carefully curated vocabulary words. Start from Unit 1 or jump to any unit that matches your current level.",
    icon: BookOpen,
    color: "from-secondary to-secondary/80",
  },
  {
    number: "03",
    title: "Play & Learn",
    description: "Engage with 10+ game modes designed to build deep vocabulary understanding. From flashcards to reading comprehension, there's something for every learning style.",
    icon: Gamepad2,
    color: "from-success to-success/80",
  },
  {
    number: "04",
    title: "Track Progress",
    description: "Watch your XP grow, maintain streaks, and climb the leaderboard. Parents can monitor progress through the dedicated parent dashboard.",
    icon: TrendingUp,
    color: "from-accent to-accent/80",
  },
];

const gameCategories = [
  {
    title: "Learn",
    description: "Build your vocabulary foundation",
    icon: Brain,
    color: "bg-primary/10 text-primary border-primary/30",
    games: [
      { name: "Flashcards", icon: LayoutGrid, desc: "Interactive word cards with definitions" },
      { name: "Word Intuition", icon: Lightbulb, desc: "Guess meanings from context clues" },
    ],
  },
  {
    title: "Practice",
    description: "Reinforce what you've learned",
    icon: Target,
    color: "bg-secondary/10 text-secondary border-secondary/30",
    games: [
      { name: "Context Master", icon: BookOpen, desc: "Choose correct word meanings" },
      { name: "Cloze Challenge", icon: FileText, desc: "Fill in the missing words" },
      { name: "Matching Game", icon: LayoutGrid, desc: "Match words to definitions" },
    ],
  },
  {
    title: "Apply",
    description: "Use vocabulary in real contexts",
    icon: Sparkles,
    color: "bg-success/10 text-success border-success/30",
    games: [
      { name: "Reading Quest", icon: BookOpen, desc: "Comprehension with vocabulary focus" },
      { name: "Linked Extracts", icon: FileText, desc: "Connect ideas across passages" },
      { name: "Gap Fill Passage", icon: PenTool, desc: "Complete passages with context" },
    ],
  },
  {
    title: "Master",
    description: "Multi-sensory deep learning",
    icon: Trophy,
    color: "bg-accent/10 text-accent border-accent/30",
    games: [
      { name: "Listening", icon: Headphones, desc: "Audio-based word recognition" },
      { name: "Speaking", icon: Mic, desc: "Pronunciation and recall practice" },
    ],
  },
];

const benefits = [
  {
    icon: Clock,
    title: "15 Minutes Daily",
    description: "Short, focused sessions that fit into any schedule",
  },
  {
    icon: Brain,
    title: "Science-Backed",
    description: "Spaced repetition and active recall techniques",
  },
  {
    icon: Zap,
    title: "Gamified Learning",
    description: "XP, streaks, and achievements keep motivation high",
  },
  {
    icon: Star,
    title: "Real Results",
    description: "Vocabulary retention that lasts for exams and beyond",
  },
];

export default function HowItWorks() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

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

      {/* Hero Section */}
      <section className="pt-24 sm:pt-32 pb-16 sm:pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <Badge className="bg-gradient-primary text-primary-foreground px-4 py-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 mr-2" />
            How VocabQuest Works
          </Badge>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
            Learn Vocabulary <span className="bg-gradient-primary bg-clip-text text-transparent">The Fun Way</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform exam prep into an exciting adventure. Our game-based approach makes learning stick while keeping students engaged and motivated.
          </p>
        </div>
      </section>

      {/* How It Works Steps */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Your Learning Journey</h2>
            <p className="text-muted-foreground text-lg">Four simple steps to vocabulary mastery</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, index) => (
              <Card key={step.number} className="relative overflow-hidden border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-card group">
                <CardContent className="p-6 pt-8">
                  <div className="absolute top-0 right-0 text-6xl font-bold text-muted/20 -mt-2 mr-2">
                    {step.number}
                  </div>
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <step.icon className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Game Categories */}
      <section className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">10+ Engaging Game Modes</h2>
            <p className="text-muted-foreground text-lg">From learning to mastery, we've got you covered</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {gameCategories.map((category) => (
              <Card key={category.title} className="overflow-hidden hover:shadow-card transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Badge className={category.color}>
                      <category.icon className="h-4 w-4 mr-1" />
                      {category.title}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{category.description}</span>
                  </div>
                  <div className="space-y-3">
                    {category.games.map((game) => (
                      <div key={game.name} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="p-2 rounded-lg bg-background">
                          <game.icon className="h-4 w-4 text-foreground" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{game.name}</div>
                          <div className="text-xs text-muted-foreground">{game.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Why VocabQuest Works</h2>
            <p className="text-muted-foreground text-lg">Built on proven learning science</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="text-center p-6 rounded-xl bg-card border hover:shadow-card transition-all duration-300">
                <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="font-bold mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features List */}
      <section className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything You Need</h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              "Curated vocabulary for NSW exams",
              "Progress tracking & analytics",
              "Parent dashboard for monitoring",
              "Leaderboards & achievements",
              "Dark mode support",
              "Works on all devices",
              "Regular content updates",
              "AI-generated practice passages",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3 p-4 rounded-lg bg-card border">
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                <span className="font-medium">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-gradient-primary">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground">
            Ready to Start Your Quest?
          </h2>
          <p className="text-primary-foreground/80 text-lg">
            Join thousands of students building their vocabulary the fun way.
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            className="text-lg px-8 py-6"
            onClick={() => navigate("/auth")}
          >
            Get Started Free
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </section>

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
}