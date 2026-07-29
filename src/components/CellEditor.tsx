
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, SkipForward, Save, Type, UnfoldVertical } from "lucide-react";
import { observer } from 'mobx-react-lite';
import VoiceControls from "./VoiceControls";
import SimpleDropdown from "./ui/simpleDropdown";
import { editor, lang } from "@/stores";
import { useTranslation } from 'react-i18next';

const CellEditor = () => {
  const { t } = useTranslation();

  if (!editor.currentCell || editor.headers.length === 0) {
    return <div dir={lang.dir}>{t('editor.unsupportedFormat')}</div>;
  }

  return (
    <div className="bg-card border-2 border-border rounded-xl p-4 shadow-lg">
      {/* Header Section */}
      <div className="mb-4">
        <div className="flex flex-col space-y-3">
          <h3 className="text-lg font-semibold text-foreground">
            {editor.currentHeader}
            {editor.currentCell?.isModified &&
              <span className="ml-2 text-sm text-green-600"> {t('editor.edited')}</span>
            }
          </h3>

          {/* Dropdown Controls */}
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground min-w-[60px]">{t('editor.greenhouse')}</span>
              <SimpleDropdown options={editor.optionsHamama} value={editor.selectedHamama} onSelect={(v) => editor.selectHamama(v)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground min-w-[60px]">{t('editor.valve')}</span>
              <SimpleDropdown options={editor.optionsMagof} value={editor.selectedMagof} onSelect={(v) => editor.selectMagof(v)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground min-w-[60px]">{t('editor.crop')}</span>
              <SimpleDropdown options={editor.optionsGidul} value={editor.selectedGidul} onSelect={(v) => editor.selectGidul(v)} />
            </div>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="mt-4 space-y-2">
          <div className="flex">
            <Button
              onClick={() => editor.resetCurrentCell()}
              variant="outline"
              size="sm"
              disabled={!editor.currentCell?.isModified}
              className="h-9 text-sm"
            >
              {t('editor.delete')}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => editor.movePrevious()}
            disabled={editor.isFirstCell}
            variant="outline"
            className="h-9 px-4 text-sm"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t('editor.back')}
          </Button>
          <Button
            onClick={() => editor.skip()}
            disabled={editor.isLastCell}
            variant="outline"
            className="text-orange-600 border-orange-300 hover:bg-orange-50 h-9 px-4 text-sm"
          >
            <SkipForward className="mr-2 h-4 w-4" />
            {t('editor.skip')}
          </Button>
          <Button
            onClick={() => editor.recordValue(editor.currentValue)}
            disabled={editor.isLastCell}
            className="bg-green-600 hover:bg-green-700 text-white h-9 px-4 text-sm"
          >
            <Type className="mr-2 h-4 w-4" />
            {t('editor.save')}
          </Button>
        </div>
      </div>
      {/* Input Section */}
      <div className="mb-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            {t('editor.valueLabel')}
          </label>
          <Input
            value={editor.currentValue}
            onChange={(e) => editor.handleInput(e.target.value)}
            onInput={(e) => editor.handleInput((e.target as HTMLInputElement).value)}
            placeholder={editor.currentCell?.value ?? ''}
            className="text-base p-3 h-11"
            autoFocus
          />
        </div>
      </div>

      {/* Voice Recording Controls */}
      <div className="mb-4">
        <VoiceControls />
      </div>
    </div>
  );
};

export default observer(CellEditor);
