import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Gamepad2, Mail, MessageSquare, Send, Home, Sun, Moon, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Please enter a valid email address").max(255, "Email must be less than 255 characters"),
  subject: z.string().trim().min(1, "Subject is required").max(200, "Subject must be less than 200 characters"),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(2000, "Message must be less than 2000 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

const Contact = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormData, string>>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof ContactFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate form data
    const result = contactSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ContactFormData, string>> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof ContactFormData] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-contact-email', {
        body: {
          name: result.data.name,
          email: result.data.email,
          subject: result.data.subject,
          message: result.data.message,
        },
      });

      if (error) {
        throw error;
      }

      setIsSubmitted(true);
      toast({
        title: "Message sent!",
        description: "We'll get back to you as soon as possible.",
      });
    } catch (error: any) {
      console.error("Error sending contact form:", error);
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
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

        {/* Success Message */}
        <section className="pt-24 sm:pt-32 pb-16 px-4 sm:px-6">
          <div className="max-w-lg mx-auto text-center">
            <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Thank You!</h2>
            <p className="text-muted-foreground mb-8">
              Your message has been sent successfully. We'll get back to you within 24-48 hours.
            </p>
            <Button onClick={() => navigate("/")} className="gap-2">
              <Home className="h-4 w-4" />
              Back to Home
            </Button>
          </div>
        </section>
      </div>
    );
  }

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
            <MessageSquare className="h-4 w-4 mr-2" />
            Get in Touch
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Contact Us</h2>
          <p className="text-muted-foreground text-lg">Have a question or feedback? We'd love to hear from you.</p>
        </div>
      </section>

      {/* Contact Form */}
      <section className="pb-16 px-4 sm:px-6">
        <div className="max-w-xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Send us a message
              </CardTitle>
              <CardDescription>
                Fill out the form below and we'll get back to you as soon as possible.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={handleChange}
                    className={errors.name ? "border-destructive" : ""}
                  />
                  {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    name="subject"
                    placeholder="What's this about?"
                    value={formData.subject}
                    onChange={handleChange}
                    className={errors.subject ? "border-destructive" : ""}
                  />
                  {errors.subject && <p className="text-sm text-destructive">{errors.subject}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder="Tell us more..."
                    rows={5}
                    value={formData.message}
                    onChange={handleChange}
                    className={errors.message ? "border-destructive" : ""}
                  />
                  {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
                </div>

                <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>Sending...</>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
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
};

export default Contact;
