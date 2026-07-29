
import { Button } from "@/components/ui/button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  // Radix's AlertDialog ignored outside clicks; a backdrop dismiss here would
  // silently drop the pending file selection instead of confirming/cancelling.
  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (reason !== "backdropClick") onOpenChange(false);
      }}
      slotProps={{
        paper: {
          className:
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg"
        }
      }}
    >
      <div className="flex flex-col space-y-2 text-center sm:text-left">
        <DialogTitle className="p-0 text-lg font-semibold">
          {t('progressDialog.title')}
        </DialogTitle>
        <DialogContentText className="m-0 text-sm text-muted-foreground">
          {t('progressDialog.description', { count: modifiedCount })}
        </DialogContentText>
      </div>
      <DialogActions className="flex flex-col-reverse p-0 sm:flex-row sm:justify-end sm:space-x-2 [&>:not(style)~:not(style)]:ml-0">
        <Button variant="outline" className="mt-2 sm:mt-0" onClick={onCancel}>
          {t('progressDialog.dontSave')}
        </Button>
        <Button onClick={onConfirm}>
          {t('progressDialog.saveProgress')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaveProgressDialog;
