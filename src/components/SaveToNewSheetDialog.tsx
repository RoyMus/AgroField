import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
    <Dialog
      open={open}
      onClose={() => onOpenChange(false)}
      slotProps={{
        paper: {
          className:
            "grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg sm:rounded-lg"
        }
      }}
    >
      <div className="flex flex-col space-y-1.5 text-center sm:text-left">
        <DialogTitle className="p-0 text-lg font-semibold leading-none tracking-tight">
          {t('saveDialog.title')}
        </DialogTitle>
        <DialogContentText className="m-0 text-sm text-muted-foreground">
          {t('saveDialog.description')}
        </DialogContentText>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fileName">{t('saveDialog.fileNameLabel')}</Label>
          <Input
            id="fileName"
            placeholder={previousFileName}
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            disabled={isLoading}
          />
        </div>
      </div>

      <DialogActions className="flex flex-col-reverse p-0 sm:flex-row sm:justify-end sm:space-x-2 [&>:not(style)~:not(style)]:ml-0">
        <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
          {t('saveDialog.cancel')}
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!fileName.trim() || isLoading}
        >
          {isLoading ? t('saveDialog.creating') : t('saveDialog.createNewFile')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaveToNewSheetDialog;
