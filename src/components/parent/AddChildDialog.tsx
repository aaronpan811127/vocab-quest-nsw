import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Link, AlertCircle } from "lucide-react";

interface AddChildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: string;
  onSuccess: () => void;
}

export const AddChildDialog = ({ open, onOpenChange, parentId, onSuccess }: AddChildDialogProps) => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setEmail("");
    setUsername("");
    setPassword("");
  };

  const handleLinkExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your child's email address",
        variant: "destructive"
      });
      return;
    }

    if (!parentId) {
      toast({
        title: "Loading...",
        description: "Please wait for your profile to load",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // Check if student exists and is available
      const { data: availability, error: checkError } = await supabase
        .rpc('check_child_availability', { p_student_email: email });

      if (checkError) throw checkError;

      const result = availability?.[0];
      
      if (!result?.available) {
        toast({
          title: "Cannot link student",
          description: result?.message || "This student is not available to link",
          variant: "destructive"
        });
        return;
      }

      if (!result?.existing_user_id) {
        toast({
          title: "Student not found",
          description: "No account found with this email. Try creating a new account instead.",
          variant: "destructive"
        });
        return;
      }

      // Link the existing student
      const { error: linkError } = await supabase
        .from("parent_children")
        .insert({
          parent_id: parentId,
          student_user_id: result.existing_user_id,
          student_email: email,
          relationship_status: 'active'
        });

      if (linkError) throw linkError;

      toast({
        title: "Child linked successfully!",
        description: "You can now view their progress.",
      });

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error linking child:", error);
      toast({
        title: "Error linking child",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !username || !password) {
      toast({
        title: "All fields required",
        description: "Please fill in all fields to create a new account",
        variant: "destructive"
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // Check if email is already in use
      const { data: availability, error: checkError } = await supabase
        .rpc('check_child_availability', { p_student_email: email });

      if (checkError) throw checkError;

      const result = availability?.[0];
      
      if (result?.existing_user_id) {
        toast({
          title: "Account exists",
          description: "An account with this email already exists. Try linking instead.",
          variant: "destructive"
        });
        return;
      }

      // Create the student account
      const redirectUrl = `${window.location.origin}/`;
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            username,
            signup_type: 'student'
          }
        }
      });

      if (signUpError) throw signUpError;

      const isRepeatedSignup = !!authData.user && Array.isArray(authData.user.identities) && authData.user.identities.length === 0;
      if (isRepeatedSignup) {
        toast({
          title: "Account exists",
          description: "An account with this email already exists. Try linking instead.",
          variant: "destructive"
        });
        return;
      }

      if (!authData.user) {
        throw new Error("Failed to create user account");
      }

      // Wait a moment for the trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Link the new student to parent
      const { error: linkError } = await supabase
        .from("parent_children")
        .insert({
          parent_id: parentId,
          student_user_id: authData.user.id,
          student_email: email,
          relationship_status: 'active'
        });

      if (linkError) throw linkError;

      toast({
        title: "Child account created!",
        description: "They can sign in with the credentials you provided.",
      });

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error creating child account:", error);
      toast({
        title: "Error creating account",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a Child</DialogTitle>
          <DialogDescription>
            Link an existing student account or create a new one.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="link" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Link Existing
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Create New
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4 mt-4">
            <form onSubmit={handleLinkExisting} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="link-email">Child's Email</Label>
                <Input
                  id="link-email"
                  type="email"
                  placeholder="child@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <p className="text-muted-foreground">
                  Your child will keep their existing credentials. 
                  An email notification will be sent to them.
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading} className="bg-secondary hover:bg-secondary/90">
                  {isLoading ? "Linking..." : "Link Account"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="create" className="space-y-4 mt-4">
            <form onSubmit={handleCreateNew} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-username">Username</Label>
                <Input
                  id="create-username"
                  type="text"
                  placeholder="VocabStar"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  type="email"
                  placeholder="child@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-password">Password</Label>
                <Input
                  id="create-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <p className="text-muted-foreground">
                  An email will be sent to your child with their login details.
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading} className="bg-secondary hover:bg-secondary/90">
                  {isLoading ? "Creating..." : "Create Account"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
