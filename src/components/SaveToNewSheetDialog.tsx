import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";

interface SaveToNewSheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (fileName: string) => void;
  onCancel: () => void;
  previousFileName: string;
  isLoading?: boolean;
}

const SaveToNewSheetDialog = ({ 
  open, 
  onOpenChange, 
  onConfirm, 
  onCancel, 
  previousFileName,
  isLoading = false
}: SaveToNewSheetDialogProps) => {
  const [fileName, setFileName] = useState(previousFileName);

  const handleConfirm = () => {
    if (fileName.trim()) {
      onConfirm(fileName.trim());
    }
  };

  const handleCancel = () => {
    setFileName("");
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>שמור לקובץ חדש</DialogTitle>
          <DialogDescription>
            צור קובץ חדש באותו המיקום עם אותן הרשאות
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fileName">שם הקובץ</Label>
            <Input
              id="fileName"
              placeholder={previousFileName}
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            ביטול
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!fileName.trim() || isLoading}
          >
            {isLoading ? "יוצר..." : "צור קובץ חדש"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaveToNewSheetDialog;