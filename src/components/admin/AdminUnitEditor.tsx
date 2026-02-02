import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil, Save, X, AlertTriangle, Info, Plus } from "lucide-react";

interface TestType {
  id: string;
  name: string;
  code: string;
}

interface Unit {
  id: string;
  title: string;
  description: string | null;
  unit_number: number;
  test_type_id: string | null;
  words: string[];
}

export const AdminUnitEditor = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testTypes, setTestTypes] = useState<TestType[]>([]);
  const [testTypeFilter, setTestTypeFilter] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addConfirmDialogOpen, setAddConfirmDialogOpen] = useState(false);
  
  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editWords, setEditWords] = useState("");
  
  // Add form state
  const [addTitle, setAddTitle] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addWords, setAddWords] = useState("");
  
  const { toast } = useToast();

  // Fetch test types
  useEffect(() => {
    const fetchTestTypes = async () => {
      const { data } = await supabase
        .from('test_types')
        .select('id, name, code')
        .order('name');
      
      if (data) {
        setTestTypes(data);
        const selective = data.find(t => t.code === 'SELECTIVE');
        setTestTypeFilter(selective?.id || data[0]?.id || '');
      }
    };
    fetchTestTypes();
  }, []);

  // Fetch units when test type changes
  useEffect(() => {
    if (!testTypeFilter) return;
    
    const fetchUnits = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('units')
        .select('id, title, description, unit_number, test_type_id, words')
        .eq('test_type_id', testTypeFilter)
        .order('unit_number');
      
      if (error) {
        toast({
          title: "Error",
          description: "Failed to fetch units",
          variant: "destructive",
        });
      } else if (data) {
        setUnits(data as Unit[]);
      }
      setLoading(false);
    };
    fetchUnits();
  }, [testTypeFilter, toast]);

  const openEditDialog = (unit: Unit) => {
    setSelectedUnit(unit);
    setEditTitle(unit.title);
    setEditDescription(unit.description || "");
    setEditWords(Array.isArray(unit.words) ? unit.words.join(", ") : "");
    setEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setSelectedUnit(null);
    setEditTitle("");
    setEditDescription("");
    setEditWords("");
  };

  const handleSaveClick = () => {
    // Show confirmation dialog before saving
    setConfirmDialogOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!selectedUnit) return;
    
    setConfirmDialogOpen(false);
    setSaving(true);

    try {
      // Parse words from comma-separated string
      const wordsArray = editWords
        .split(",")
        .map(w => w.trim())
        .filter(w => w.length > 0);

      const { error } = await supabase
        .from('units')
        .update({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          words: wordsArray,
        })
        .eq('id', selectedUnit.id);

      if (error) throw error;

      // Update local state
      setUnits(prev => prev.map(u => 
        u.id === selectedUnit.id 
          ? { ...u, title: editTitle.trim(), description: editDescription.trim() || null, words: wordsArray }
          : u
      ));

      toast({
        title: "Unit Updated",
        description: "Changes saved. Existing user snapshots are not affected.",
      });

      closeEditDialog();
    } catch (error) {
      console.error('Error updating unit:', error);
      toast({
        title: "Error",
        description: "Failed to update unit",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Add unit handlers
  const openAddDialog = () => {
    // Calculate next unit number
    const maxUnitNumber = units.length > 0 ? Math.max(...units.map(u => u.unit_number)) : 0;
    setAddTitle("");
    setAddDescription("");
    setAddWords("");
    setAddDialogOpen(true);
  };

  const closeAddDialog = () => {
    setAddDialogOpen(false);
    setAddTitle("");
    setAddDescription("");
    setAddWords("");
  };

  const handleAddClick = () => {
    setAddConfirmDialogOpen(true);
  };

  const handleConfirmAdd = async () => {
    setAddConfirmDialogOpen(false);
    setSaving(true);

    try {
      // Calculate next unit number
      const maxUnitNumber = units.length > 0 ? Math.max(...units.map(u => u.unit_number)) : 0;
      const newUnitNumber = maxUnitNumber + 1;

      // Parse words from comma-separated string
      const wordsArray = addWords
        .split(",")
        .map(w => w.trim())
        .filter(w => w.length > 0);

      const { data, error } = await supabase
        .from('units')
        .insert({
          title: addTitle.trim(),
          description: addDescription.trim() || null,
          words: wordsArray,
          unit_number: newUnitNumber,
          test_type_id: testTypeFilter,
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setUnits(prev => [...prev, data as Unit]);

      toast({
        title: "Unit Created",
        description: `Unit ${newUnitNumber}: ${addTitle.trim()} has been created.`,
      });

      closeAddDialog();
    } catch (error) {
      console.error('Error creating unit:', error);
      toast({
        title: "Error",
        description: "Failed to create unit",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        
        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border">
          <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">About Unit Snapshots</p>
            <p>
              When users first access a unit, a snapshot of the unit configuration (including words) is saved for them. 
              Editing units here will only affect <span className="font-medium text-foreground">new users</span> or users who haven't accessed the unit yet. 
              Existing user progress and snapshots remain unchanged.
            </p>
          </div>
        </div>

        {/* Test Type Radio Buttons + Add Button */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <RadioGroup 
            value={testTypeFilter} 
            onValueChange={setTestTypeFilter}
            className="flex flex-wrap gap-4"
          >
            {testTypes.map((tt) => (
              <div key={tt.id} className="flex items-center space-x-2">
                <RadioGroupItem value={tt.id} id={`unit-tt-${tt.id}`} />
                <Label htmlFor={`unit-tt-${tt.id}`} className="cursor-pointer">{tt.name}</Label>
              </div>
            ))}
          </RadioGroup>
          
          <Button onClick={openAddDialog} disabled={!testTypeFilter}>
            <Plus className="h-4 w-4 mr-2" />
            Add Unit
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : units.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No units found for the selected test type.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {units.map((unit) => (
            <Card key={unit.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">
                      Unit {unit.unit_number}: {unit.title}
                    </CardTitle>
                    {unit.description && (
                      <CardDescription className="line-clamp-2 mt-1">
                        {unit.description}
                      </CardDescription>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => openEditDialog(unit)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {Array.isArray(unit.words) ? unit.words.length : 0} words
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {Array.isArray(unit.words) && unit.words.slice(0, 12).map((word, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {word}
                      </Badge>
                    ))}
                    {Array.isArray(unit.words) && unit.words.length > 12 && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        +{unit.words.length - 12} more
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Unit {selectedUnit?.unit_number}: {selectedUnit?.title}
            </DialogTitle>
            <DialogDescription>
              Update the unit configuration. Existing user snapshots will not be affected.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="unit-title">Title</Label>
              <Input
                id="unit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Enter unit title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit-description">Description</Label>
              <Textarea
                id="unit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Enter unit description (optional)"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit-words">
                Words <span className="text-muted-foreground font-normal">(comma-separated)</span>
              </Label>
              <Textarea
                id="unit-words"
                value={editWords}
                onChange={(e) => setEditWords(e.target.value)}
                placeholder="word1, word2, word3, ..."
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Current count: {editWords.split(",").map(w => w.trim()).filter(w => w.length > 0).length} words
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeEditDialog} disabled={saving}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSaveClick} disabled={saving || !editTitle.trim()}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Confirm Unit Update
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You are about to update the unit configuration. This change will:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Apply to <span className="font-medium">new users</span> who haven't accessed this unit yet</li>
                  <li>Apply to <span className="font-medium">newly generated content</span> for this unit</li>
                  <li><span className="font-medium">NOT affect</span> existing user snapshots or their progress</li>
                </ul>
                <p className="text-sm">
                  Are you sure you want to proceed?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave}>
              Yes, Update Unit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Unit Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Add New Unit
            </DialogTitle>
            <DialogDescription>
              Create a new unit for {testTypes.find(t => t.id === testTypeFilter)?.name || 'the selected test type'}. 
              The unit will be assigned the next available unit number.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-unit-title">Title</Label>
              <Input
                id="add-unit-title"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder="Enter unit title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-unit-description">Description</Label>
              <Textarea
                id="add-unit-description"
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
                placeholder="Enter unit description (optional)"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-unit-words">
                Words <span className="text-muted-foreground font-normal">(comma-separated)</span>
              </Label>
              <Textarea
                id="add-unit-words"
                value={addWords}
                onChange={(e) => setAddWords(e.target.value)}
                placeholder="word1, word2, word3, ..."
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Current count: {addWords.split(",").map(w => w.trim()).filter(w => w.length > 0).length} words
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeAddDialog} disabled={saving}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleAddClick} disabled={saving || !addTitle.trim()}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Unit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Confirmation Dialog */}
      <AlertDialog open={addConfirmDialogOpen} onOpenChange={setAddConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm New Unit
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You are about to create a new unit with {addWords.split(",").map(w => w.trim()).filter(w => w.length > 0).length} words.
                </p>
                <p className="text-sm">
                  The unit will be available for content generation and user access immediately.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAdd}>
              Yes, Create Unit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
