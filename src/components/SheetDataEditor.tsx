import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRecording, VoiceResult } from "@/hooks/useVoiceRecording";
import { parseNumber } from "@/lib/voice/hebrewNumbers";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { getData } from "@/hooks/getData";
import ProgressStats from "./ProgressStats";
import CellEditor from "./CellEditor";
import SaveToNewSheetDialog from "./SaveToNewSheetDialog";
import { ModifiedSheet,getValue,setValue,setFormat } from "@/types/cellTypes";
import { set } from "date-fns";
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import { useLang } from '@/contexts/LanguageContext';

interface SheetDataEditorProps {
  sheetData: ModifiedSheet;
  onSaveProgress?: (saveFunc: () => void) => void;
  onSaveToNewSheet?: (saveFunc: () => void) => void;
  handleSaveProgress: (bulkSave?: boolean) => void;
  copiedFileId: string;
  onFetchSheetData?: (fetchFunc: () => void) => void;
}

function convertSecondsToTimeFormat(totalSeconds: number): string {
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

// Detects the appropriate format type for a value being written to the sheet.
// Returns 'text' for strings that must NOT be parsed by Google Sheets (e.g. "00:30"),
// 'percent' for percentage strings (e.g. "50%"), or null to let the sheet's existing
// number format apply (with 0.00 as the fallback default).
function detectValueType(value: string): 'text' | 'percent' | 'number' | null{
  if (!value || value.trim() === '') return null;
  const v = value.trim();
  // Time-like strings (MM:SS or HH:MM:SS) — must stay as text or they become fractions
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(v)) return 'text';
  // Percentage strings
  if (/^-?\d+(\.\d+)?%$/.test(v)) return 'percent';
  // Pure numbers — no explicit type, use the sheet's existing format or default 0.00
  if (!isNaN(Number(v))) return 'number';
  // Everything else (actual text)
  return 'text';
}
const SheetDataEditor = ({ sheetData, onSaveProgress, onSaveToNewSheet,handleSaveProgress, copiedFileId, onFetchSheetData }: SheetDataEditorProps) => {
  const { t } = useTranslation();
  const { speechLang, numberWords, commands, ttsLangPrefix, locale, timeZone } = useLang();

  const voiceConfig = useMemo(() => ({
    speechLang,
    numberWords,
    decimalWord: commands.decimal,
    commands: {
      skip: commands.skip,
      back: commands.back,
      delete: commands.delete,
      save: commands.save,
      stop: commands.stop,
      exactOnly: commands.exactOnly,
    },
  }), [speechLang, numberWords, commands]);

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
  for (let i = 4; i < headers.length; i++) {
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
  const { isRecording, startRecording, stopRecording, pause: pauseRecording, resume: resumeRecording, error: recordingError, interim, isListening, lastHeard, onResult } = useVoiceRecording(voiceConfig);
  const dataRows = sheetData.values.slice(0, commentIndex);
  // Latest values for use inside timers / TTS callbacks.
  const currentValueRef = useRef(currentValue);
  currentValueRef.current = currentValue;
  const positionRef = useRef({ row: currentRowIndex, col: currentColumnIndex });
  positionRef.current = { row: currentRowIndex, col: currentColumnIndex };
  // Dictated free text waits here until silence or "שמור".
  const [isDraft, setIsDraftState] = useState(false);
  const isDraftRef = useRef(false);
  const setIsDraft = (value: boolean) => {
    isDraftRef.current = value;
    setIsDraftState(value);
  };
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitDraftRef = useRef<() => void>(() => {});
  const{
    isTemplate,
    plant,
    grower,
    place,
    faucetConductivity,
  } = getData(false, null, null, null, null, null);

  const hasInitialized = useRef(false);

  const getDataForHeader = (colIndex: number, extractedData: any, idsRowIndex: number) => {
    const idFromIdsRow = getValue(sheetData.values[idsRowIndex][colIndex]);

    if (idFromIdsRow === 'השקייה' || idFromIdsRow === 'השקיה') {
      if (extractedData.waterDuration !== undefined && extractedData.waterDuration !== null) {
        if (extractedData.waterDosageMode !== null && extractedData.waterDosageMode !== undefined) {
          if (extractedData.waterDosageMode == 0)
          {
            return convertSecondsToTimeFormat(extractedData.waterDuration);
          }
          else
            return (extractedData.waterDuration).toString();
        }
        else
        {
          return (extractedData.waterDuration / 60).toString();
        }
      }
    } else if (idFromIdsRow === 'ספיקה') {
      if (extractedData?.NominalFlow !== undefined && extractedData.NominalFlow !== null) {
        let nominalFlow = parseFloat(extractedData.NominalFlow);
        return (nominalFlow < 100) ? nominalFlow.toString() : (nominalFlow / 1000.0).toString();
      }
    } else if (idFromIdsRow === 'דשן') {
      if (extractedData.fertQuant !== undefined && extractedData.fertQuant !== null) {
        let fertQuant = parseFloat(extractedData.fertQuant);
        return (fertQuant < 100) ? fertQuant.toString() : (fertQuant / 1000.0).toString();
      }
    } else if (idFromIdsRow === 'מים') {
      if (extractedData.waterQuantity !== undefined && extractedData.waterQuantity !== null) {
        let waterQuant = parseFloat(extractedData.waterQuantity);
        return (waterQuant < 100) ? waterQuant.toString() : (waterQuant / 1000.0).toString();
      }
    } else if (idFromIdsRow === 'תכנית' || idFromIdsRow === 'תוכנית') {
      if (extractedData.fertProgram !== undefined && extractedData.fertProgram !== null) {
        return extractedData.fertProgram.toString();
      }
    }
    else if(idFromIdsRow === 'מחזור בימים' || idFromIdsRow === 'מרווח בימים')
    {
      if (extractedData.daysinterval !== undefined && extractedData.daysinterval !== null) {
        return extractedData.daysinterval.toString();
      }
    }
    else if(idFromIdsRow === 'השקיה ביום' || idFromIdsRow === 'השקיה ליום' || idFromIdsRow === 'השקיות ביום' || idFromIdsRow === 'מחזורים')
    {
      if (extractedData.hourlyCyclesPerDay !== undefined && extractedData.hourlyCyclesPerDay !== null) {
        return extractedData.hourlyCyclesPerDay.toString();
      }
    }
    else
    {
      const fertMatch = idFromIdsRow.match(/^דשן\s?(\d+)$/);
      if (fertMatch) {
        const index = parseInt(fertMatch[1], 10) - 1;

        if (
          extractedData.fertQuantities &&
          extractedData.fertQuantities.length > index
        ) {
          const fertQuant = parseFloat(extractedData.fertQuantities[index]);
          if(extractedData.fertLocalModes !== null && extractedData.fertLocalModes !== undefined && extractedData.fertLocalModes.length > index && extractedData.fertLocalModes[index] == 3 || extractedData.fertLocalModes[index] == 6)
          {
            if(!isNaN(fertQuant)) {
              return convertSecondsToTimeFormat(fertQuant);
            }
          }
          else
          {
            if (!isNaN(fertQuant)) {
              return fertQuant < 100
                ? fertQuant.toString()
                : (fertQuant / 1000).toString();
            }
          }
        }
    }
}

    return null;
  };

  const fetchSheetData = useCallback(async () => {
    const sheetName = sheetData?.sheetName;
    if (!sheetName) return;
    sheetData.values[2][2] = setValue(sheetData.values[2][2], t('fetch.dataCollected') + new Date().toLocaleTimeString(locale, {
      timeZone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    }));
    sheetData.values[2][2] = setFormat(sheetData.values[2][2], { ...sheetData.values[2][2].formatting, backgroundColor: '#ffff00ff' });
    sheetData.values[2][3] = setValue(sheetData.values[2][3], new Date().toLocaleDateString(locale, { timeZone }));
    sheetData.values[2][3] = setFormat(sheetData.values[2][3], { ...sheetData.values[2][3].formatting, backgroundColor: '#ffff00ff' });
    const externalIDValue = getValue(sheetData.values[2][1]);
    const [prefix, key, externalIDString] = externalIDValue.split(':');

    try {
      const headerRow = sheetData.values[found_headers_row_index] || [];

      let programIdColumnIndex = -1;
      for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
        if ((getValue(headerRow[colIndex])?.includes('סידורי') || getValue(headerRow[colIndex])?.includes('זיהוי') || getValue(headerRow[colIndex])?.includes('מזהה') || getValue(headerRow[colIndex])?.includes('מספר')) && (getValue(headerRow[colIndex])?.includes('מגוף') || getValue(headerRow[colIndex])?.includes('תכנית') || getValue(headerRow[colIndex])?.includes('תוכנית'))) {
          programIdColumnIndex = colIndex;
          break;
        }
      }

      let valveIdColumnIndex = -1;
      for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
        if ((getValue(headerRow[colIndex])?.includes('סידורי') || getValue(headerRow[colIndex])?.includes('זיהוי') || getValue(headerRow[colIndex])?.includes('מזהה') || getValue(headerRow[colIndex])?.includes('מספר')) && getValue(headerRow[colIndex])?.includes('ברז')) {
          valveIdColumnIndex = colIndex;
          break;
        }
      }

      let bakarIdColumnIndex = -1;
      for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
        if ((getValue(headerRow[colIndex])?.includes('סידורי') || getValue(headerRow[colIndex])?.includes('זיהוי') || getValue(headerRow[colIndex])?.includes('מזהה') || getValue(headerRow[colIndex])?.includes('מספר')) && getValue(headerRow[colIndex])?.includes('בקר')) {
          bakarIdColumnIndex = colIndex;
          break;
        }
      }

      if (programIdColumnIndex === -1) {
        toast({
          title: t('fetch.errorTitle'),
          description: t('fetch.noIdColumn'),
        });
        return;
      }

      let idsRowIndex = -1;
      for (let rowIdx = 0; rowIdx < sheetData.values.length; rowIdx++) {
        if (getValue(sheetData.values[rowIdx][0])?.includes('נתונים') && (getValue(sheetData.values[rowIdx][0])?.includes('לשליפה') || getValue(sheetData.values[rowIdx][0])?.includes('שליפה') || getValue(sheetData.values[rowIdx][0])?.includes('לשלוף')) || getValue(sheetData.values[rowIdx][0])?.includes('שליפת')) {
          idsRowIndex = rowIdx;
          break;
        }
      }

      if (idsRowIndex === -1) {
        toast({
          title: t('fetch.errorTitle'),
          description: t('fetch.noDataRow'),
        });
        return;
      }
      const programIDs = new Array<number>();
      const valveIDs = new Array<number>();
      const externalIDs = new Array<number>();
      for (let rowIndex = headersRowIndex; rowIndex < dataRows.length - 2; rowIndex++) {
        const programIDValue = getValue(sheetData.values[rowIndex][programIdColumnIndex]);
        let externalIDValue = -1;
        if (bakarIdColumnIndex === -1)
        {
          externalIDValue = parseInt(externalIDString);
        }
        else
        {
          externalIDValue = parseInt(getValue(sheetData.values[rowIndex][bakarIdColumnIndex]));
        }
        let valveIDValue = 0;
        if(prefix === 'talgil')
        {
          valveIDValue = valveIdColumnIndex !== -1 && getValue(sheetData.values[rowIndex][valveIdColumnIndex]) != "" ? parseInt(getValue(sheetData.values[rowIndex][valveIdColumnIndex])): 0;
        }
        else
        {
          valveIDValue = valveIdColumnIndex !== -1 && getValue(sheetData.values[rowIndex][valveIdColumnIndex]) != "" ? parseInt(getValue(sheetData.values[rowIndex][valveIdColumnIndex])) - 1 : 0;
        }
        const programID = parseInt(programIDValue);
        if (isNaN(programID)) {
          continue;
        }
        programIDs.push(programID);
        valveIDs.push(valveIDValue);
        externalIDs.push(externalIDValue);
      }
      const { data, error } = await supabase.functions.invoke('fetch-data-from-api', {
          body: {
            platform: prefix,
            externalIDs:externalIDs,
            programIDs:programIDs,
            APIKey: key,
            valveIDs:valveIDs,
          },
        });
      if (error instanceof FunctionsHttpError) {
          const body = await error.context.json();
          const message = body?.error || error.message;
          toast({
            title: message,
            description: ""
          });
          return;
      }
      const extractedDataArray = JSON.parse(data);
      let dataIndex = 0;
      const rowErrors: string[] = [];
      for (let rowIndex = headersRowIndex; rowIndex < dataRows.length - 2; rowIndex++) {
          if(dataIndex >= extractedDataArray.length) {
            break;
          }
          if(getValue(sheetData.values[rowIndex][programIdColumnIndex]) == "")
          {
            continue;
          }
          const extractedData = extractedDataArray[dataIndex++];
          if (extractedData.error) {
            const programId = getValue(sheetData.values[rowIndex][programIdColumnIndex]);
            rowErrors.push(`שורה ${rowIndex + 1} (תכנית ${programId}): ${extractedData.error}`);
            continue;
          }
          for (let colIndex = 4; colIndex < minColIndex - 1; colIndex++) {
            const dataToInsert = getDataForHeader(colIndex, extractedData, idsRowIndex);
            if (dataToInsert !== null) {
              sheetData.values[rowIndex][colIndex] = setValue(sheetData.values[rowIndex][colIndex], dataToInsert);
              const detectedType = detectValueType(dataToInsert);
              const newFormatting: any = { ...sheetData.values[rowIndex][colIndex].formatting, backgroundColor: '#ffff00ff' };
              if (detectedType) newFormatting.type = detectedType;
              else delete newFormatting.type;
              sheetData.values[rowIndex][colIndex] = setFormat(sheetData.values[rowIndex][colIndex], newFormatting);
            }
        }
      }
      handleSaveProgress(true);
      if (rowErrors.length > 0) {
        toast({
          title: t('fetch.partialData'),
          description: rowErrors.join('\n'),
          variant: "destructive",
          duration: 10000,
        });
      } else {
        toast({
          title: t('fetch.successTitle'),
          description: "",
        });
      }
    } catch (error) {
      toast({
        title: t('fetch.errorFetching'),
        description: "",
      });
      console.error("Error fetching data from API:", error);
    }
  }, [sheetData, headersRowIndex, dataRows.length, handleSaveProgress, toast, found_headers_row_index, minColIndex, maxColIndex, t, locale, timeZone]);

  // Initialize template data and reset position when sheet changes
  useEffect(() => {
    const sheetName = sheetData?.sheetName;
    if (!sheetName) return;

    // Reset position to initial state when sheet changes, skipping hidden rows and columns
    let startRow = headersRowIndex;
    while (hiddenRowSet.has(startRow) && startRow < dataRows.length - 3) startRow++;
    setCurrentRowIndex(startRow);
    const hiddenSet = new Set(sheetData.hiddenColumns ?? []);
    let startCol = minColIndex;
    while (hiddenSet.has(startCol) && startCol <= maxColIndex) startCol++;
    setCurrentColumnIndex(startCol);

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
      sheetData.values[faucetRowIndex][faucetIndex + 1] = setValue(sheetData.values[faucetRowIndex][faucetIndex + 1], `${faucetConductivity}`);
    }

    if (isTemplate) {
      sheetData.values[topBarRowIndex][topBarIndex] = setValue(sheetData.values[topBarRowIndex][topBarIndex], `${place} - ${plant} - ${grower}`);
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
      sheetData.values[dataRows.length - 1][i] = setValue(sheetData.values[dataRows.length - 1][i], `${sum.toFixed(2)}`);
      const wantedResult = getValue(sheetData.values[dataRows.length - 2][i])?.split('-');
      let isBetween = false;
      if(wantedResult && wantedResult.length > 1)
        isBetween = sum > parseFloat(wantedResult[0]) && sum < parseFloat(wantedResult[1]);
      else if (wantedResult && wantedResult.length === 1)
        isBetween = sum < parseFloat(wantedResult[0]);
      sheetData.values[dataRows.length - 1][i] = setFormat(sheetData.values[dataRows.length - 1][i], { ...sheetData.values[dataRows.length - 1][i].formatting, backgroundColor: isBetween ? '#00ff15ff' : '#ff0000ff' });
    }
  };

  const DRAFT_SILENCE_MS = 3000;

  const clearDraftTimer = () => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = null;
  };

  const startDraftTimer = () => {
    clearDraftTimer();
    draftTimerRef.current = setTimeout(() => commitDraftRef.current(), DRAFT_SILENCE_MS);
  };

  const discardDraft = () => {
    clearDraftTimer();
    setIsDraft(false);
  };

  useEffect(() => {
    // Moving to another cell drops any pending dictation
    discardDraft();
    speak(getValue(headers[currentColumnIndex]), () => {
      setCurrentValue("");
    });
  }, [currentRowIndex, currentColumnIndex]);

  useEffect(() => () => clearDraftTimer(), []);

  // Keep waiting while the user is still talking
  useEffect(() => {
    if (interim && draftTimerRef.current) startDraftTimer();
  }, [interim]);

  const setValueNow = (value: string) => {
    currentValueRef.current = value;
    setCurrentValue(value);
  };

  /** Reads the value back, then records it if the user is still on the same cell. */
  const commitVoiceValue = (value: string) => {
    discardDraft();
    const trimmed = value.trim();
    if (!trimmed) return;
    setValueNow(trimmed);
    const { row, col } = positionRef.current;
    speak(trimmed, () => {
      if (positionRef.current.row === row && positionRef.current.col === col) {
        recordCurrentValue(trimmed);
      }
    });
  };

  // Always use the latest render's closure when the silence timer fires
  commitDraftRef.current = () => commitVoiceValue(currentValueRef.current);

  const appendToDraft = (text: string) => {
    const base = isDraftRef.current ? currentValueRef.current : "";
    setValueNow(base ? `${base} ${text}` : text);
    setIsDraft(true);
    startDraftTimer();
  };

  const handleVoiceResult = (result: VoiceResult) => {
    if (result.kind === 'command') {
      switch (result.command) {
        case 'skip':
          discardDraft();
          skipCurrentValue();
          setValueNow("");
          break;
        case 'back':
          discardDraft();
          moveToPreviousCell();
          setValueNow("");
          break;
        case 'delete':
          // Act immediately, and confirm out loud
          if (isDraftRef.current) {
            discardDraft();
            setValueNow("");
          } else {
            resetCurrentCell();
          }
          speak(t('voice.deleting'));
          break;
        case 'stop':
          // Keep any dictated text in the input (unsaved) so it can be saved by hand
          clearDraftTimer();
          setIsDraft(false);
          stopVoiceRecording();
          speak(t('voice.stopping'));
          break;
        case 'save': {
          let value: string;
          if (isDraftRef.current) {
            value = [currentValueRef.current, result.rest].filter(Boolean).join(' ');
          } else if (result.rest) {
            // e.g. "שבע שמור"
            value = parseNumber(result.rest, speechLang, numberWords, commands.decimal) ?? result.rest;
          } else {
            value = currentValueRef.current;
          }
          if (value.trim()) commitVoiceValue(value);
          break;
        }
      }
      return;
    }

    if (result.kind === 'number' && !isDraftRef.current) {
      // A plain number is saved right away
      commitVoiceValue(result.value);
      return;
    }

    // Free text (or a number spoken in the middle of dictation) accumulates
    appendToDraft(result.kind === 'number' ? result.value : result.text);
  };

  onResult(handleVoiceResult);

  const handleInputChange = (value: string) => {
    // Typing takes over from any pending dictation
    discardDraft();
    setCurrentValue(value);
  };

  const handleChangeToNewRow = (value: number) => {
    setCurrentRowIndex(value);
    setCurrentColumnIndex(minColIndex);
  };

  const saveModifications = useCallback(() => {
    toast({
      title: t('editor.progressSaved'),
      description: t('editor.progressSavedDesc'),
    });
  }, [toast, t]);

  const handleOpenSheet = async () => {
    calcAverages();
    handleSaveProgress();
    if (copiedFileId) {
      window.location.href = `https://docs.google.com/spreadsheets/d/${copiedFileId}/edit`;
    }
  };

  const recordCurrentValue = async (value) => {
    sheetData.values[currentRowIndex][currentColumnIndex] = setValue(sheetData.values[currentRowIndex][currentColumnIndex], value);
    handleSaveProgress();
    toast({
      title: t('editor.valueRecorded'),
      description: t('editor.valueRecordedDesc', { header: getValue(headers[currentColumnIndex]) }),
    });
    setCurrentValue("");
    moveToNextCell();
  };

  function unlockSpeechIOS() {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance('');
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
  }

  const startVoiceRecording = async () => {
    if (!isRecording) {
      console.log('Starting voice recording...');
      unlockSpeechIOS();
      await startRecording();
      toast({
        title: t('editor.recordingStarted'),
        description: t('editor.recordingStartedDesc'),
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
  const activeSpeechRef = useRef<((runCallback: boolean) => void) | null>(null);
  const speakingUtterancesRef = useRef(new Set<SpeechSynthesisUtterance>());

  useEffect(() => {
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      setVoices(allVoices);
    };

    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }, []);

  const speak = (text: string, onEndCallback?: () => void) => {
    if (!("speechSynthesis" in window)) {
      if (onEndCallback) onEndCallback();
      return;
    }

    // Settle the previous utterance (its end/error events are not always delivered)
    activeSpeechRef.current?.(false);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    // Always declare the language so the engine never falls back to its default (English) voice
    utterance.lang = speechLang;

    // Read the voice list fresh (the cached state may still be empty on first use).
    // Android reports Hebrew with the legacy code "iw".
    const available = window.speechSynthesis.getVoices();
    const voiceList = available.length ? available : voices;
    const prefixes = ttsLangPrefix === 'he' ? ['he', 'iw'] : [ttsLangPrefix];
    const normalizedLang = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();
    const targetVoice =
      voiceList.find((v) => normalizedLang(v) === speechLang.toLowerCase()) ??
      voiceList.find((v) => prefixes.some((p) => normalizedLang(v).startsWith(p)));
    if (targetVoice) {
      utterance.voice = targetVoice;
    }

    // Browsers sometimes never fire onend/onerror, which used to leave the mic
    // paused and the value unsaved. finish() runs exactly once, from whichever
    // comes first: end, error, a replacement utterance, or the safety timeout.
    let finished = false;
    const finish = (runCallback: boolean) => {
      if (finished) return;
      finished = true;
      clearTimeout(safetyTimer);
      if (activeSpeechRef.current === finish) activeSpeechRef.current = null;
      speakingUtterancesRef.current.delete(utterance);
      resumeRecording();
      if (runCallback && onEndCallback) onEndCallback();
    };
    // Generous upper bound on speaking time, so the mic never reopens mid-speech
    const safetyTimer = setTimeout(() => finish(true), 4000 + text.length * 150);
    activeSpeechRef.current = finish;
    // Holding a reference stops Chrome from garbage-collecting the utterance
    // (a known cause of onend never firing)
    speakingUtterancesRef.current.add(utterance);

    // Stop listening while speaking so the read-back isn't captured as input
    utterance.onstart = () => {
      if (!finished) pauseRecording();
    };

    utterance.onend = () => finish(true);

    utterance.onerror = (event) => {
      // "interrupted"/"canceled" means another utterance replaced this one
      // (e.g. the cell changed); otherwise TTS failed and we still proceed.
      finish(event.error !== 'interrupted' && event.error !== 'canceled');
    };

    window.speechSynthesis.speak(utterance);
  };


  const skipCurrentValue = () => {
    moveToNextCell();
  };

  const hiddenColSet = useMemo(
    () => new Set(sheetData.hiddenColumns ?? []),
    [sheetData.hiddenColumns]
  );

  const hiddenRowSet = useMemo(
    () => new Set(sheetData.hiddenRows ?? []),
    [sheetData.hiddenRows]
  );

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
        return;
      }
    } while (
      sheetData.values[nextRow]?.[nextCol]?.original?.startsWith('=') ||
      hiddenColSet.has(nextCol) ||
      hiddenRowSet.has(nextRow)
    );

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
        return;
      }
    } while (
      sheetData.values[prevRow]?.[prevCol]?.original?.startsWith('=') ||
      hiddenColSet.has(prevCol) ||
      hiddenRowSet.has(prevRow)
    );

    if (currentRowIndex !== prevRow) {
      setRowChangeCounter(rowChangeCounter + 1);
    }
    setCurrentRowIndex(prevRow);
    setCurrentColumnIndex(prevCol);
  };

  const resetCurrentCell = () => {
    setCurrentValue("");
    sheetData.values[currentRowIndex][currentColumnIndex] = setValue(sheetData.values[currentRowIndex][currentColumnIndex], null);
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
  }, [onSaveProgress, onSaveToNewSheet, onFetchSheetData, sheetData]);

  return (
    <div className="space-y-6">
      {/* Current Cell Editor */}
      <CellEditor
        currentRowIndex={currentRowIndex}
        currentColumnIndex={currentColumnIndex}
        rowChangeCounter={rowChangeCounter}
        headers={headers}
        dataRows={dataRows}
        hiddenRows={sheetData.hiddenRows}
        headersRowIndex={headersRowIndex}
        currentValue={currentValue}
        isRecording={isRecording}
        interimTranscript={interim}
        isDraft={isDraft}
        isListening={isListening}
        lastHeard={lastHeard}
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
