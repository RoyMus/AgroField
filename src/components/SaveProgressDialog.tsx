
import { Button } from "@/components/ui/button";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";

interface SaveProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  modifiedCount: number;
}

const SaveProgressDialog = ({ 
  open, 
  onOpenChange, 
  onConfirm, 
  onCancel, 
  modifiedCount 
}: SaveProgressDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save Current Progress?</AlertDialogTitle>
          <AlertDialogDescription>
            You have {modifiedCount} unsaved changes to the current sheet. 
            Would you like to save your progress before switching to a new sheet?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Don't Save
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Save Progress
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SaveProgressDialog;
