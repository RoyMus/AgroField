import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Plus, Minus, Copy, Clipboard } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CellFormat } from "@/types/cellTypes";
import { drive } from "@/stores";
import { useTranslation } from 'react-i18next';

const EditableSheetTable = () => {
  const { t } = useTranslation();
  const [selectedCell, setSelectedCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<CellFormat | null>(null);

  const sheet = drive.sheet;
  if (!sheet) return null;

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    sheet.ensureCell(rowIndex, colIndex).setValue(value);
  };

  const handleCellFocus = (rowIndex: number, colIndex: number) => {
    setSelectedCell({ rowIndex, colIndex });
  };

  const addRow = () => {
    sheet.insertRow(selectedCell ? selectedCell.rowIndex + 1 : sheet.values.length);
  };

  const removeRow = () => {
    if (sheet.values.length > 1 && selectedCell) {
      sheet.removeRow(selectedCell.rowIndex);
    }
  };

  const addColumn = () => {
    sheet.insertColumn(selectedCell ? selectedCell.colIndex + 1 : sheet.maxCols);
  };

  const removeColumn = () => {
    if (sheet.maxCols > 0 && selectedCell) {
      sheet.removeColumn(selectedCell.colIndex);
    }
  };

  const saveModifications = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await drive.saveProgress(true);
    }
    finally {
      toast({ title: t('table.savedSuccess'), description: t('table.savedSuccessDesc') });
      setIsSaving(false);
    }
  };

  const copyFormat = () => {
    if (!selectedCell) {
      toast({ title: t('table.selectCellFirst'), description: t('table.selectCellFirstDesc') });
      return;
    }
    const format = sheet.values[selectedCell.rowIndex]?.[selectedCell.colIndex]?.formatting;
    if (format) {
      setCopiedFormat(format);
      toast({ title: t('table.formatCopied'), description: t('table.formatCopiedDesc') });
    }
  };

  const pasteFormat = () => {
    if (!selectedCell || !copiedFormat) return;
    sheet.cell(selectedCell.rowIndex, selectedCell.colIndex)?.setFormat({ ...copiedFormat });
  };

  const maxCols = sheet.maxCols;

  const getBorderStyle = (borders?: { top?: { style: string; color: string; width: number }; bottom?: { style: string; color: string; width: number }; left?: { style: string; color: string; width: number }; right?: { style: string; color: string; width: number } }) => {
    if (!borders) return {};
    const borderCss: Record<string, string> = {};
    if (borders.top) borderCss.borderTop = `${borders.top.width}px ${borders.top.style} ${borders.top.color}`;
    if (borders.bottom) borderCss.borderBottom = `${borders.bottom.width}px ${borders.bottom.style} ${borders.bottom.color}`;
    if (borders.left) borderCss.borderLeft = `${borders.left.width}px ${borders.left.style} ${borders.left.color}`;
    if (borders.right) borderCss.borderRight = `${borders.right.width}px ${borders.right.style} ${borders.right.color}`;
    return borderCss;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Toolbar - Mobile Optimized */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 space-y-4 lg:space-y-0">
        {/* Row/Column Actions */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          <Button onClick={addRow} variant="outline" size="sm" className="h-10 text-sm">
            <Plus className="w-4 h-4 mr-1" />
            <span className="sm:inline">{t('table.addRow')}</span>
          </Button>
          <Button
            onClick={removeRow}
            variant="outline"
            size="sm"
            disabled={sheet.values.length <= 1 || !selectedCell}
            className="h-10 text-sm"
          >
            <Minus className="w-4 h-4 mr-1" />
            <span className="sm:inline">{t('table.deleteRow')}</span>
          </Button>
          <Button onClick={addColumn} variant="outline" size="sm" className="h-10 text-sm">
            <Plus className="w-4 h-4 mr-1" />
            <span className="sm:inline">{t('table.addColumn')}</span>
          </Button>
          <Button
            onClick={removeColumn}
            variant="outline"
            size="sm"
            disabled={maxCols <= 1 || !selectedCell}
            className="h-10 text-sm"
          >
            <Minus className="w-4 h-4 mr-1" />
            <span className="sm:inline">{t('table.deleteColumn')}</span>
          </Button>
        </div>

        {/* Save Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:space-x-2">
          <Button
            onClick={saveModifications}
            variant="default"
            size="sm"
            className="bg-green-600 hover:bg-green-700 h-9 text-sm"
            disabled={isSaving}
          >
            <Save className="w-4 h-4 mr-1" />
            <span>{t('table.saveChanges')}</span>
          </Button>
          <Button
            onClick={copyFormat}
            variant="outline"
            size="sm"
            disabled={!selectedCell}
            className="h-10 text-sm"
            title={t('table.copyFormat')}
          >
            <Copy className="w-4 h-4 mr-1" />
            <span className="sm:inline">{t('table.copyFormat')}</span>
          </Button>
          <Button
            onClick={pasteFormat}
            variant="outline"
            size="sm"
            disabled={!selectedCell || !copiedFormat}
            className="h-10 text-sm"
            title={t('table.pasteFormat')}
          >
            <Clipboard className="w-4 h-4 mr-1" />
            <span className="sm:inline">{t('table.pasteFormat')}</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="w-12 px-2 py-2 text-xs font-medium text-gray-500 text-center border-r border-b">
                  #
                </th>
                {Array.from({ length: maxCols }, (_, colIndex) => (
                  <th
                    key={colIndex}
                    className="px-2 py-2 text-xs font-medium text-gray-500 text-center border-r border-b min-w-[120px]"
                  >
                    {String.fromCharCode(65 + (colIndex % 26))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.values.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  <td className="w-12 px-2 py-1 text-xs text-gray-500 text-center border-r bg-gray-50 font-medium">
                    {rowIndex + 1}
                  </td>
                  {Array.from({ length: maxCols }, (_, colIndex) => {
                    const cellCssStyle = sheet.values[rowIndex]?.[colIndex]?.formatting;
                    const borderStyles = getBorderStyle(cellCssStyle?.borders);

                    return (
                      <td key={colIndex} className="border-r border-b p-0">
                        <Input
                          value={row[colIndex]?.value ?? ""}
                          onFocus={() => handleCellFocus(rowIndex, colIndex)}
                          onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                          className={`rounded-none focus:ring-2 focus:ring-blue-500 focus:ring-inset h-8 text-sm ${
                            selectedCell?.rowIndex === rowIndex && selectedCell?.colIndex === colIndex
                              ? "ring-2 ring-blue-500"
                              : ""
                          }`}
                          style={{
                            backgroundColor: cellCssStyle?.backgroundColor,
                            color: cellCssStyle?.textColor,
                            fontWeight: cellCssStyle?.fontWeight,
                            fontStyle: cellCssStyle?.fontStyle,
                            textAlign: cellCssStyle?.textAlign,
                            fontSize: cellCssStyle?.fontSize ? `${cellCssStyle.fontSize}px` : undefined,
                            ...borderStyles
                          }}
                          placeholder=""
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default observer(EditableSheetTable);
