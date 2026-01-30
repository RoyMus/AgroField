import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { getData } from "@/hooks/getData";
import ProgressStats from "./ProgressStats";
import CellEditor from "./CellEditor";
import SaveToNewSheetDialog from "./SaveToNewSheetDialog";
import { ModifiedSheet,getValue } from "@/types/cellTypes";
import { set } from "date-fns";


interface SheetDataEditorProps {
  sheetData: ModifiedSheet;
  onSaveProgress?: (saveFunc: () => void) => void;
  onSaveToNewSheet?: (saveFunc: () => void) => void;
  handleSaveProgress: () => void;
  copiedFileId: string;
  onFetchSheetData?: (fetchFunc: () => void) => void;
}

const SheetDataEditor = ({ sheetData, onSaveProgress, onSaveToNewSheet,handleSaveProgress, copiedFileId, onFetchSheetData }: SheetDataEditorProps) => {
  for (let i = 0; i < sheetData.values.length; i++) {
    if (sheetData.values[i][0] != null && getValue(sheetData.values[i][0]).trim() != "")
    {
      var found_headers_row_index = i;
      break;
    }
  }
  for (let i = found_headers_row_index + 1; i < sheetData.values.length; i++) {
    var found_comment_index = true;
    for (let j = 0; j < sheetData.values[i].length; j++)
    {
      if (sheetData.values[i][j] != null && getValue(sheetData.values[i][j]).trim() != "")
      {
        found_comment_index = false;
        break;
      }
    }
    if (found_comment_index)
    {
      var commentIndex = i;
      break;
    }
  }
  

  const headersRowIndex = found_headers_row_index + 1;
  const headers = sheetData.values[headersRowIndex -1] || [];
  const [rowChangeCounter, setRowChangeCounter] = useState(0);
  const [updateCounter, setUpdateCounter] = useState(0);
  
  var AlreadySetFirst = false;
  for (let i = 0; i < headers.length; i++) {
    if (getValue(headers[i]) == "")
    {
      if (!AlreadySetFirst)
      {
        var firstIndex = i + 1;
        AlreadySetFirst = true;
      }
      else
      {
        var lastindex = i - 1;
        break;
      }
    }
  }
  
  const minColIndex = firstIndex;
  const maxColIndex = lastindex;
  const [currentRowIndex, setCurrentRowIndex] = useState(headersRowIndex);
  const [currentColumnIndex, setCurrentColumnIndex] = useState(minColIndex);
  const [currentCount, setCurrentCount] = useState(1);
  const [currentValue, setCurrentValue] = useState<string>("");
  const { toast } = useToast();
  const { isRecording, startRecording, stopRecording, error: recordingError, onWordRecognized } = useVoiceRecording();
  const dataRows = sheetData.values.slice(0, commentIndex);
  var isSpeakingState = false;
  const{
    isTemplate,
    plant,
    grower,
    place,
    faucetConductivity,
  } = getData(false, null, null, null, null, null);
  
  const hasInitialized = useRef(false);
  
  const getDataForHeader = (colIndex: number, extractedData: any, extractedData2?: any) => {
    const idFromAboveRow = getValue(sheetData.values[found_headers_row_index - 1][colIndex]);

    if (idFromAboveRow === 'id1') {
      if (extractedData.waterDuration !== undefined) {
        return (extractedData.waterDuration / 60).toString();
      }
    } else if (idFromAboveRow === 'id2') {
      if (extractedData.daysinterval !== undefined && extractedData.hourlyCyclesPerDay !== undefined) {
        return (extractedData.daysinterval * extractedData.hourlyCyclesPerDay).toString();
      }
    } else if (idFromAboveRow === 'id3') { // ספיקה בפועל
      if (extractedData2?.NominalFlow !== undefined) {
        return extractedData2.NominalFlow.toString();
      }
    } else if (idFromAboveRow === 'id4') {
      if (extractedData.fertQuant !== undefined) {
        return extractedData.fertQuant.toString();
      }
    } else if (idFromAboveRow === 'id5') {
      if (extractedData.waterQuantity !== undefined) {
        return extractedData.waterQuantity.toString();
      }
    } else if (idFromAboveRow === 'id6') {
      if (extractedData.fertProgram !== undefined) {
        return extractedData.fertProgram.toString();
      }
    }

    return null;
  };

  const fetchSheetData = useCallback(async () => {
    const sheetName = sheetData?.sheetName;
    if (!sheetName) return;
    sheetData.values[2][2].modified = 'נתונים נאספו: ' + new Date().toLocaleTimeString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    sheetData.values[2][2].formatting = { ...sheetData.values[2][2].formatting, backgroundColor: '#ffff00ff' };
    sheetData.values[2][3].modified = new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
    sheetData.values[2][3].formatting = { ...sheetData.values[2][3].formatting, backgroundColor: '#ffff00ff' };
    const externalIDValue = getValue(sheetData.values[2][1]);
    const prefix = externalIDValue.split(':')[0];
    const externalIDString = externalIDValue.split(':')[1];
    const externalID = parseInt(externalIDString);

    
    try {
      const headerRow = sheetData.values[found_headers_row_index] || [];
      if (prefix === 'gsi-galcon' && !isNaN(externalID)) {
        for (let rowIndex = headersRowIndex; rowIndex < dataRows.length - 3; rowIndex++) {

          const programIDValue = getValue(sheetData.values[rowIndex][2]);
          const programID = parseInt(programIDValue);

          if (isNaN(programID)) {
            continue;
          }

          const url = `https://gsi.galcon-smart.com/api/api/External/${externalID}/${programID}/ProgramSettings?Key=1wtDCaf98RtKVP1y7XAfRWzJM`;

          const response = await fetch(url);
          const data = await response.json();

          let extractedData2: any = null;

          if (data.Result && data.Body) {
            const extractedData = {
              daysinterval: data.Body.CyclicDayProgram?.DaysInterval,
              hourlyCyclesPerDay: data.Body.HourlyCycle?.HourlyCyclesPerDay,
              waterDuration: data.Body.ValveInProgram?.[0]?.WaterDuration,
              valveID: data.Body.ValveInProgram?.[0]?.ValveID,
              fertQuant: data.Body.ValveInProgram?.[0]?.FertQuant,
              waterQuantity: data.Body.ValveInProgram?.[0]?.WaterQuantity,
              fertProgram: data.Body.ValveInProgram?.[0]?.FertProgram,
            };

            if (extractedData.valveID !== undefined) {
              const url2 = `https://gsi.galcon-smart.com/api/api/External/${externalID}/${extractedData.valveID}/ValveSettings?Key=1wtDCaf98RtKVP1y7XAfRWzJM`;

              const response2 = await fetch(url2);
              const data2 = await response2.json();

              if (data2.Result && data2.Body) {
                extractedData2 = {
                  NominalFlow: data2.Body.SetupNominalFlow,
                };
              }
            }

            for (let colIndex = 4; colIndex < minColIndex - 1; colIndex++) {
              const headerText = getValue(headerRow[colIndex]);
              const dataToInsert = getDataForHeader(colIndex, extractedData, extractedData2);

              if (dataToInsert !== null) {
                sheetData.values[rowIndex][colIndex].modified = dataToInsert;
                sheetData.values[rowIndex][colIndex].formatting = { ...sheetData.values[rowIndex][colIndex].formatting, backgroundColor: '#ffff00ff' };
              }
            }
          }
        }
      } else {
        toast({
          title: "API לא זוהתה פלטפורמת",
          description: ""
        });
        return;
      }
      handleSaveProgress();
      toast({
        title: "נתונים נאספו בהצלחה",
        description: "",
      });
    } catch (error) {
      toast({
        title: "שגיאה באסיפת נתונים",
        description: "",
      });
    }
  }, [sheetData, headersRowIndex, dataRows.length, handleSaveProgress, toast, found_headers_row_index, minColIndex, maxColIndex]);
  
  // Initialize template data and reset position when sheet changes
  useEffect(() => {
    const sheetName = sheetData?.sheetName;
    if (!sheetName) return;

    // Reset position to initial state when sheet changes
    setCurrentRowIndex(headersRowIndex);
    setCurrentColumnIndex(minColIndex);

    if (hasInitialized.current) return;

    const topBarRowIndex = 0;
    const faucetRowIndex = 1;
    const topBarRow = sheetData.values[topBarRowIndex];
    const faucetRow = sheetData.values[faucetRowIndex];
    let topBarIndex = 0;
    let faucetIndex = 0;
    
    for (let i = 0; i < topBarRow.length; i++) {
      if (getValue(topBarRow[i]) != "") {
        topBarIndex = i;
        break;
      }
    }
    for (let i = 0; i < faucetRow.length; i++) {
      if (getValue(faucetRow[i]) != "") {
        faucetIndex = i;
        break;
      }
    }
    if(faucetConductivity != "")
    {
      sheetData.values[faucetRowIndex][faucetIndex + 1].modified = `${faucetConductivity}`;
    }
        
    if (isTemplate) {
      sheetData.values[topBarRowIndex][topBarIndex].modified = `${place} - ${plant} - ${grower}`;
    }

    hasInitialized.current = true;
    handleSaveProgress();
  }, [sheetData?.sheetName]);

  const calcAverages = () =>
  {
    for (let i = minColIndex; i <= maxColIndex; i++)
    {
      let sum = 0;
      let temp = 0;
      let counter = 0;
      for (let j = headersRowIndex; j <= dataRows.length - 3 ; j++)
      {
        temp = parseFloat(getValue(sheetData.values[j][i]));
        if (!Number.isNaN(temp))
        {
          counter++;
          sum += temp;
        }
      }
      if (counter == 0)
      {
        continue;
      }
      sum /= counter;
      sheetData.values[dataRows.length - 1][i].modified = `${sum.toFixed(2)}`;
      sheetData.values[dataRows.length - 1][i].saved = false;
      const wantedResult = getValue(sheetData.values[dataRows.length - 2][i])?.split('-');
      let isBetween = false;
      if(wantedResult && wantedResult.length > 1)
        isBetween = sum > parseFloat(wantedResult[0]) && sum < parseFloat(wantedResult[1]);
      else if (wantedResult && wantedResult.length === 1)
        isBetween = sum < parseFloat(wantedResult[0]);
      sheetData.values[dataRows.length - 1][i].formatting.backgroundColor = isBetween ? '#00ff15ff' : '#ff0000ff';
    }
  };

  useEffect(() => {
    // Only set current cell value when position changes
    speak(getValue(headers[currentColumnIndex]),true, () => {
      setCurrentValue("");
    });
  }, [currentRowIndex, currentColumnIndex]);

  onWordRecognized((word: string) => {
      handleInputChange(word,true);
  });

  const handleInputChange = (value: string,from_voice?: boolean) => {
    console.log('Recognized word:', value);
    if (value.includes("דלג") || value.includes("הבא")|| value.includes("אבא") || value.includes("דלק") || value.includes("דלת")) {
      skipCurrentValue();
      setCurrentValue("");
    }
    else if (value.includes("חזור") || value.includes("אחורה")) {
      moveToPreviousCell();
      setCurrentValue("");
    }
    else if(value.includes("מחק"))
    {
      resetCurrentCell();
    }
    else if (value.includes("שמור")) {
      if(currentValue) {
        recordCurrentValue(currentValue);
        setCurrentValue("");
      }
    }
    else {
      setCurrentValue(value);
      if(from_voice)
      {
        const rowIndex = currentRowIndex;
        const colIndex = currentColumnIndex;
        speak(value, false, () => {
          if (currentRowIndex === rowIndex && currentColumnIndex === colIndex) {
            recordCurrentValue(value);
            setCurrentValue("");
          }
        });
      }
    }
    
  };

  const handleChangeToNewRow = (value: number) => {
    setCurrentRowIndex(value);
    setCurrentColumnIndex(minColIndex);
  };

  const saveModifications = useCallback(() => {
    // The context handles saving to localStorage, so this is just for the toast.
    toast({
      title: "Progress Saved",
      description: `Saved modifications`,
    });``
    
  }, [toast]);

  const handleOpenSheet = async () => {
    calcAverages();
    handleSaveProgress();
    if (copiedFileId) {
      window.location.href = `https://docs.google.com/spreadsheets/d/${copiedFileId}/edit`;
    }
  };

  const recordCurrentValue = async (value) => {
    // Save the current value
    sheetData.values[currentRowIndex][currentColumnIndex].modified = value;
    sheetData.values[currentRowIndex][currentColumnIndex].saved = false;
    handleSaveProgress();
    toast({
      title: "Value Recorded",
      description: `Recorded value for ${getValue(headers[currentColumnIndex])}`,
    });
    
    moveToNextCell();
  };

  function unlockSpeechIOS() {
  if (!window.speechSynthesis) return;

    const utterance = new SpeechSynthesisUtterance('');
    utterance.volume = 0; // silent
    window.speechSynthesis.speak(utterance);
  }
  const startVoiceRecording = async () => {
    if (!isRecording) {
      console.log('Starting voice recording...');
      unlockSpeechIOS();
      await startRecording();
      toast({
        title: "Recording Started",
        description: "Speak now... Click Stop to finish.",
      });
    }
  };

  const stopVoiceRecording = async () => {
    if (isRecording) {
      console.log('Stopping voice recording...');
      await stopRecording();
    }
  };
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      setVoices(allVoices);
    };

    // Chrome fires voiceschanged async
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }, []);

  const speak = async (text, activateMic: boolean, onEndCallback?) => {
    if (!("speechSynthesis" in window)) {
      if (onEndCallback) onEndCallback();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    // Try to find a Hebrew voice
    const hebrewVoice = voices.find((v) => v.lang.startsWith("he"));
    if (!hebrewVoice) {
      if (onEndCallback) onEndCallback();
      return;
    }
    utterance.voice = hebrewVoice;

    utterance.onstart = () => {
      if (isRecording || activateMic) {
        stopRecording();
        isSpeakingState = true;
      }
    };

    utterance.onend = () => {
      if (isSpeakingState && activateMic) {
        startRecording();
      }
      isSpeakingState = false;

      if (onEndCallback) {
        onEndCallback();
      }
    };

    window.speechSynthesis.speak(utterance);
  };


  const skipCurrentValue = () => {
    moveToNextCell();
  };

  const moveToNextCell = () => {
    let nextRow = currentRowIndex;
    let nextCol = currentColumnIndex;

    do {
      if (nextCol < maxColIndex) {
        nextCol++;
      } else if (nextRow < dataRows.length - 3) {
        nextRow++;
        nextCol = minColIndex;
      } else {
        // End of editable area
        return;
      }
    } while (sheetData.values[nextRow]?.[nextCol]?.original?.startsWith('='));

    if (currentRowIndex !== nextRow) {
      calcAverages();
      setRowChangeCounter(rowChangeCounter + 1);
    }
    setCurrentRowIndex(nextRow);
    setCurrentColumnIndex(nextCol);
    setCurrentCount(currentCount + 1);
  };

  const moveToPreviousCell = () => {
    let prevRow = currentRowIndex;
    let prevCol = currentColumnIndex;

    do {
      if (prevCol > minColIndex) {
        prevCol--;
      } else if (prevRow > headersRowIndex) {
        prevRow--;
        prevCol = maxColIndex;
      } else {
        // Start of editable area
        return;
      }
    } while (sheetData.values[prevRow]?.[prevCol]?.original?.startsWith('='));

    if (currentRowIndex !== prevRow) {
      setRowChangeCounter(rowChangeCounter + 1);
    }
    setCurrentRowIndex(prevRow);
    setCurrentColumnIndex(prevCol);
  };

  const resetCurrentCell = () => {
    setCurrentValue("");
    // Remove from modified data if it exists
    sheetData.values[currentRowIndex][currentColumnIndex].modified = null;
    handleSaveProgress();
    setUpdateCounter(prev => prev + 1);
  };

  if (dataRows.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No data rows found in the sheet
      </div>
    );
  }

  const isLastCell = currentRowIndex === dataRows.length - 1 && currentColumnIndex === headers.length - 1;
  const isFirstCell = currentRowIndex === 0 && currentColumnIndex === 0;

  useEffect(() => {
    if (onSaveProgress) {
      onSaveProgress(saveModifications);
    }
    if (onSaveToNewSheet) {
      onSaveToNewSheet(handleOpenSheet);
    }
    if (onFetchSheetData) {
      onFetchSheetData(fetchSheetData);
    }
  }, [onSaveProgress, onSaveToNewSheet, onFetchSheetData]);

  const [formattedDate] = useState(() => new Date().toLocaleDateString());
  return (
    <div className="space-y-6">
      {/* Current Cell Editor */}
      <CellEditor
        currentRowIndex={currentRowIndex}
        currentColumnIndex={currentColumnIndex}
        rowChangeCounter={rowChangeCounter}
        headers={headers}
        dataRows={dataRows}
        headersRowIndex={headersRowIndex}
        currentValue={currentValue}
        isRecording={isRecording}
        onInputChange={handleInputChange}
        onChangeToRow={handleChangeToNewRow}
        onStartRecording={startVoiceRecording}
        onStopRecording={stopVoiceRecording}
        onResetCell={resetCurrentCell}
        onSaveProgress={saveModifications}
        onSaveToNewSheet={handleOpenSheet}
        onMovePrevious={moveToPreviousCell}
        onSkipCurrent={skipCurrentValue}
        onRecordValue={() => recordCurrentValue(currentValue)}
        isFirstCell={isFirstCell}
        isLastCell={isLastCell}
      />
    </div>
  );
  
};

export default SheetDataEditor;
