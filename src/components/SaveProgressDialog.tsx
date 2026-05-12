
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
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('progressDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('progressDialog.description', { count: modifiedCount })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {t('progressDialog.dontSave')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t('progressDialog.saveProgress')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SaveProgressDialog;
