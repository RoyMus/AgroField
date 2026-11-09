
import { Button } from "@/components/ui/button";
import { Mic, Square} from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';

interface VoiceControlsProps {
  isRecording: boolean;
  interimTranscript?: string;
  isDraft?: boolean;
  isListening?: boolean;
  lastHeard?: { text: string; at: number } | null;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<void>;
}

const LAST_HEARD_VISIBLE_MS = 4000;

const VoiceControls = ({ isRecording, interimTranscript, isDraft, isListening, lastHeard, onStartRecording, onStopRecording }: VoiceControlsProps) => {
  const { t } = useTranslation();
  const phrases: string[] = t('voice.examples', { returnObjects: true }) as string[];
  const [currentExample, setCurrentExample] = useState(phrases[0]);
  const [showLastHeard, setShowLastHeard] = useState(false);

  // Briefly show what was heard so misrecognitions are visible
  useEffect(() => {
    if (!lastHeard) return;
    setShowLastHeard(true);
    const id = setTimeout(() => setShowLastHeard(false), LAST_HEARD_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [lastHeard]);

  // Reset to first phrase when language changes
  useEffect(() => {
    setCurrentExample(phrases[0]);
  }, [phrases[0]]);

  useEffect(() => {
    if (!isRecording) return;

    const intervalId = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * phrases.length);
      setCurrentExample(phrases[randomIndex]);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [isRecording, phrases]);

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="flex flex-col items-center space-y-4">
        <Button
          onClick={isRecording ? onStopRecording : onStartRecording}
          className={`w-20 h-20 rounded-full transition-all duration-300 transform hover:scale-105 ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 animate-pulse'
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
          size="lg"
        >
          {isRecording ? (
            <Square className="w-8 h-8 text-white" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </Button>

        {isRecording && (
          <div className="flex items-center gap-2 text-sm font-medium">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                isListening ? 'bg-green-500 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className={isListening ? 'text-green-700' : 'text-amber-700'}>
              {isListening ? t('voice.listening') : t('voice.wait')}
            </span>
          </div>
        )}

        {isRecording && !interimTranscript && showLastHeard && lastHeard && (
          <div className="text-center text-gray-600 text-sm max-w-xs" dir="auto">
            {t('voice.heard')}: <span className="font-semibold">{lastHeard.text}</span>
          </div>
        )}

        {isRecording && interimTranscript && (
          <div className="text-center text-gray-400 italic max-w-xs" dir="auto">
            {interimTranscript}…
          </div>
        )}

        {isRecording && isDraft && (
          <div className="text-center text-amber-600 text-sm font-medium max-w-xs">
            {t('voice.draftHint')}
          </div>
        )}

        {isRecording && !interimTranscript && !isDraft && (
          <div className="text-center animate-fade-in">
            <div className="text-gray-500 font-medium">{currentExample}</div>
          </div>
        )}

        <div className="text-center text-gray-600 text-sm max-w-xs">
          {isRecording ? t('voice.stopVoice') : t('voice.startVoice')}
        </div>
      </div>
    </div>
  );
};

export default VoiceControls;
