import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { TestTypeProvider } from "@/contexts/TestTypeContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";

// Eagerly load the main index page for fast initial render
import Index from "./pages/Index";

// Lazy-load all other routes to reduce initial bundle size
const Auth = lazy(() => import("./pages/Auth"));
const ParentAuth = lazy(() => import("./pages/ParentAuth"));
const ParentDashboard = lazy(() => import("./pages/ParentDashboard"));
const ChildProgress = lazy(() => import("./pages/ChildProgress"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AdminAuth = lazy(() => import("./pages/AdminAuth"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Contact = lazy(() => import("./pages/Contact"));
const Terms = lazy(() => import("./pages/Terms"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <SubscriptionProvider>
          <TestTypeProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Suspense fallback={<div className="min-h-screen" />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/how-it-works" element={<HowItWorks />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/parent-auth" element={<ParentAuth />} />
                  <Route path="/parent-dashboard" element={<ParentDashboard />} />
                  <Route path="/parent-dashboard/child/:childId" element={<ChildProgress />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/admin-auth" element={<AdminAuth />} />
                  <Route path="/admin" element={<AdminDashboard />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </TestTypeProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
