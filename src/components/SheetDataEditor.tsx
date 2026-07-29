import { observer } from 'mobx-react-lite';
import CellEditor from "./CellEditor";
import { editor } from "@/stores";

const SheetDataEditor = () => {
  if (editor.dataRows.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No data rows found in the sheet
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Cell Editor */}
      <CellEditor />
    </div>
  );

};

export default observer(SheetDataEditor);
