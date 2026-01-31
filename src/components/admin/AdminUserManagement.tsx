import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, ChevronLeft, ChevronRight, RotateCcw, Trophy, Flame, AlertTriangle } from "lucide-react";

interface InProgressUnit {
  unit_id: string;
  unit_title: string;
  unit_number: number;
  test_type_id: string;
  test_type_name: string;
  games_completed: number;
  games_total: number;
}

interface User {
  id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  total_xp: number;
  level: number;
  study_streak: number;
  test_type_name: string | null;
  test_type_code: string | null;
  current_unit_title: string | null;
  current_unit_number: number | null;
  in_progress_units: InProgressUnit[];
  created_at: string;
}

export const AdminUserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<InProgressUnit | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-users?search=${encodeURIComponent(search)}&page=${page}&limit=20`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setUsers(data.users || []);
      setTotalPages(data.total_pages || 1);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchUsers();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [search, page]);

  const handleResetUnit = async () => {
    if (!selectedUser || !selectedUnit) return;
    
    setResetLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-user-unit`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            target_user_id: selectedUser.user_id,
            unit_id: selectedUnit.unit_id,
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Success",
        description: `Unit "${selectedUnit.unit_title}" has been reset for ${selectedUser.username || 'user'}. XP recalculated.`,
      });

      setResetDialogOpen(false);
      setSelectedUser(null);
      setSelectedUnit(null);
      fetchUsers();
    } catch (error) {
      console.error('Error resetting unit:', error);
      toast({
        title: "Error",
        description: "Failed to reset unit",
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  };

  const openResetDialog = (user: User, unit: InProgressUnit) => {
    setSelectedUser(user);
    setSelectedUnit(unit);
    setResetDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">User Management</h2>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by username..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No users found{search ? ` matching "${search}"` : ""}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {users.map((user) => (
            <Card key={user.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold overflow-hidden">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        user.username?.[0]?.toUpperCase() || "U"
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{user.username || "Unknown User"}</CardTitle>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Trophy className="h-3 w-3" /> Level {user.level}
                        </span>
                        <span>{user.total_xp} XP</span>
                        <span className="flex items-center gap-1">
                          <Flame className="h-3 w-3 text-warning" /> {user.study_streak} day streak
                        </span>
                        {user.test_type_name && (
                          <Badge variant="secondary" className="text-xs">
                            {user.test_type_name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {user.in_progress_units.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">In-Progress Units:</p>
                    <div className="space-y-2">
                      {user.in_progress_units.map((unit) => (
                        <div
                          key={`${unit.unit_id}-${unit.test_type_id}`}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">Unit {unit.unit_number}: {unit.unit_title}</p>
                              <Badge variant="secondary" className="text-xs">
                                {unit.test_type_name}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {unit.games_completed} / {unit.games_total} games completed
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-destructive border-destructive hover:bg-destructive/10"
                            onClick={() => openResetDialog(user, unit)}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Reset
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No units in progress</p>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Reset Unit Progress
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm">
              You are about to reset <strong>Unit {selectedUnit?.unit_number}: {selectedUnit?.unit_title}</strong> ({selectedUnit?.test_type_name}) for user <strong>{selectedUser?.username || "Unknown"}</strong>.
            </p>
            <div className="mt-4 p-3 bg-destructive/10 rounded-lg text-sm">
              <p className="font-medium text-destructive mb-2">This will delete:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>All game attempts for this unit</li>
                <li>All incorrect answers records</li>
                <li>User progress for this unit</li>
                <li>Game snapshot for this unit</li>
              </ul>
              <p className="mt-2 text-destructive">The user's total XP will be recalculated.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleResetUnit} disabled={resetLoading}>
              {resetLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Reset Unit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
