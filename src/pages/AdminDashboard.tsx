import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, LogOut, FileQuestion, Users, Loader2, BarChart3, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminQuestionReview } from "@/components/admin/AdminQuestionReview";
import { AdminUserManagement } from "@/components/admin/AdminUserManagement";
import { AdminContentStats } from "@/components/admin/AdminContentStats";
import { AdminUnitEditor } from "@/components/admin/AdminUnitEditor";

const AdminDashboard = () => {
  const { isAdmin, loading, user } = useAdminAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("questions");

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/admin-auth");
    }
  }, [loading, user, isAdmin, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/admin-auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-xl">Admin Portal</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleSignOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="units" className="gap-2">
              <Settings className="h-4 w-4" />
              Unit Management
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Game Management
            </TabsTrigger>
            <TabsTrigger value="questions" className="gap-2">
              <FileQuestion className="h-4 w-4" />
              Question Review
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              User Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="questions">
            <AdminQuestionReview />
          </TabsContent>

          <TabsContent value="stats">
            <AdminContentStats />
          </TabsContent>

          <TabsContent value="units">
            <AdminUnitEditor />
          </TabsContent>

          <TabsContent value="users">
            <AdminUserManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
