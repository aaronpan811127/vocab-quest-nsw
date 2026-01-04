import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trophy, Flame, BookOpen, MoreVertical, Eye, UserMinus, Lock, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChildData {
  id: string;
  student_user_id: string;
  student_email: string;
  relationship_status: string;
  profile?: {
    username: string;
    avatar_url: string | null;
  };
  stats?: {
    total_xp: number;
    level: number;
    study_streak: number;
  };
}

interface ChildProgressCardProps {
  child: ChildData;
  onRefresh: () => void;
  canViewProgress?: boolean;
}

export const ChildProgressCard = ({ child, onRefresh, canViewProgress = true }: ChildProgressCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const displayName = child.profile?.username || child.student_email.split('@')[0];
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleViewProgress = () => {
    navigate(`/parent-dashboard/child/${child.student_user_id}`);
  };

  const handleRemoveChild = async () => {
    setIsRemoving(true);
    try {
      const { error } = await supabase
        .from("parent_children")
        .update({ 
          relationship_status: 'removed',
          removed_at: new Date().toISOString()
        })
        .eq("id", child.id);

      if (error) throw error;

      toast({
        title: "Child removed",
        description: "You can re-link this child anytime using their email.",
      });
      
      onRefresh();
    } catch (error: any) {
      console.error("Error removing child:", error);
      toast({
        title: "Error",
        description: "Failed to remove child. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsRemoving(false);
      setShowRemoveDialog(false);
    }
  };

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={child.profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">{displayName}</h3>
                <p className="text-sm text-muted-foreground">{child.student_email}</p>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleViewProgress}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setShowRemoveDialog(true)}
                  className="text-destructive"
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  Remove Child
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-muted/50 rounded-lg">
              <Trophy className="h-4 w-4 mx-auto text-warning mb-1" />
              <div className="font-semibold text-sm">{child.stats?.level || 1}</div>
              <div className="text-xs text-muted-foreground">Level</div>
            </div>
            <div className="p-2 bg-muted/50 rounded-lg">
              <BookOpen className="h-4 w-4 mx-auto text-primary mb-1" />
              <div className="font-semibold text-sm">{child.stats?.total_xp || 0}</div>
              <div className="text-xs text-muted-foreground">XP</div>
            </div>
            <div className="p-2 bg-muted/50 rounded-lg">
              <Flame className="h-4 w-4 mx-auto text-destructive mb-1" />
              <div className="font-semibold text-sm">{child.stats?.study_streak || 0}</div>
              <div className="text-xs text-muted-foreground">Streak</div>
            </div>
          </div>

          {canViewProgress ? (
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleViewProgress}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Full Progress
            </Button>
          ) : (
            <div className="text-center p-3 bg-muted/30 rounded-lg border border-dashed">
              <Lock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Upgrade to Premium for detailed progress reports
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {displayName} from your parent dashboard. 
              They will keep their account and can continue learning.
              You can re-link them anytime using their email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveChild}
              disabled={isRemoving}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isRemoving ? "Removing..." : "Remove Child"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
