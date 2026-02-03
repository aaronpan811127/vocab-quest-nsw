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

// Student-focused content
const studentSteps = [
  {
    number: "01",
    title: "Choose Your Quest",
    description: "Pick your adventure - Selective, OC, or NAPLAN. Your personalized learning journey awaits!",
    icon: Target,
    color: "from-primary to-primary/80",
  },
  {
    number: "02", 
    title: "Pick Your Unit",
    description: "Each unit is packed with exciting words to master. Start fresh or jump to your level!",
    icon: BookOpen,
    color: "from-secondary to-secondary/80",
  },
  {
    number: "03",
    title: "Play & Win",
    description: "Battle through 10+ fun games! Flashcards, matching, listening challenges - variety keeps it exciting.",
    icon: Gamepad2,
    color: "from-success to-success/80",
  },
  {
    number: "04",
    title: "Level Up",
    description: "Earn XP, build streaks, unlock achievements, and climb the leaderboard to become the ultimate vocab champion!",
    icon: Trophy,
    color: "from-accent to-accent/80",
  },
];

const studentGameHighlights = [
  { icon: Gamepad2, title: "10+ Game Modes", desc: "Never get bored with variety" },
  { icon: Trophy, title: "Leaderboards", desc: "Compete with other students" },
  { icon: Zap, title: "Daily Streaks", desc: "Build habits, earn bonuses" },
  { icon: Star, title: "XP & Levels", desc: "Track your growth journey" },
];

// Parent-focused content
const parentFeatures = [
  {
    icon: BookOpen,
    title: "Curated Vocabulary",
    description: "Expert-selected words aligned with NSW Selective, OC, and NAPLAN exams. Each unit contains carefully chosen vocabulary that appears in actual tests.",
    color: "from-primary to-primary/80",
  },
  {
    icon: Target,
    title: "Selective-Level Questions",
    description: "Practice questions mirror the difficulty and format of real Selective School placement tests. Your child trains with authentic exam-style content.",
    color: "from-secondary to-secondary/80",
  },
  {
    icon: Brain,
    title: "Science-Based Repetition",
    description: "Our spaced repetition system is built on proven memory research. Words are reviewed at optimal intervals to maximize long-term retention.",
    color: "from-success to-success/80",
  },
  {
    icon: TrendingUp,
    title: "Detailed Progress Tracking",
    description: "Monitor your child's learning with the dedicated parent dashboard. See completed units, struggling words, time spent, and improvement trends.",
    color: "from-accent to-accent/80",
  },
];

const testimonials = [
  {
    quote: "My daughter improved her vocabulary score by 30% in just 2 months. The practice questions are exactly like the Selective test!",
    author: "Sarah M.",
    role: "Parent of Year 5 student",
  },
  {
    quote: "Finally, a learning app my son actually wants to use. He's excited to maintain his streak every day.",
    author: "David L.",
    role: "Parent of Year 4 student",
  },
  {
    quote: "The progress tracking helps me understand exactly where my child needs more support. Invaluable for exam prep.",
    author: "Michelle K.",
    role: "Parent of Year 6 student",
  },
];

const parentBenefits = [
  { icon: Clock, title: "15 Min/Day", desc: "Fits any schedule" },
  { icon: Brain, title: "Proven Methods", desc: "Research-backed learning" },
  { icon: TrendingUp, title: "Real Progress", desc: "Measurable improvement" },
  { icon: Star, title: "Exam Ready", desc: "Selective-level prep" },
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

      {/* FOR STUDENTS Section */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="bg-primary/10 text-primary border-primary/30 px-4 py-2 text-sm font-medium mb-4">
              <Gamepad2 className="h-4 w-4 mr-2" />
              For Students
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Your Epic Learning Adventure</h2>
            <p className="text-muted-foreground text-lg">Level up your vocabulary while having a blast!</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {studentSteps.map((step) => (
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

          {/* Game highlights */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {studentGameHighlights.map((item) => (
              <div key={item.title} className="flex items-center gap-3 p-4 rounded-xl bg-card border hover:shadow-card transition-all duration-300">
                <div className="p-2 rounded-lg bg-gradient-primary">
                  <item.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <div className="font-bold text-sm">{item.title}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOR PARENTS Section */}
      <section className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="bg-secondary/10 text-secondary border-secondary/30 px-4 py-2 text-sm font-medium mb-4">
              <BookOpen className="h-4 w-4 mr-2" />
              For Parents
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Serious Learning, Made Engaging</h2>
            <p className="text-muted-foreground text-lg">Expert-designed curriculum that delivers real results</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {parentFeatures.map((feature) => (
              <Card key={feature.title} className="overflow-hidden hover:shadow-card transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center flex-shrink-0`}>
                      <feature.icon className="h-7 w-7 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Parent benefits strip */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {parentBenefits.map((item) => (
              <div key={item.title} className="text-center p-4 rounded-xl bg-muted/50">
                <item.icon className="h-6 w-6 mx-auto mb-2 text-secondary" />
                <div className="font-bold text-sm">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">What Parents Say</h2>
            <p className="text-muted-foreground text-lg">Real results from real families</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="overflow-hidden hover:shadow-card transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                    ))}
                  </div>
                  <p className="text-foreground mb-4 italic">"{testimonial.quote}"</p>
                  <div className="border-t pt-4">
                    <div className="font-bold text-sm">{testimonial.author}</div>
                    <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                  </div>
                </CardContent>
              </Card>
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