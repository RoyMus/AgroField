
import { Button } from "@/components/ui/button";
import { Mic, Square} from "lucide-react";
import { useState, useEffect } from "react";
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { editor, voice } from "@/stores";

const VoiceControls = () => {
  const { t } = useTranslation();
  const phrases: string[] = t('voice.examples', { returnObjects: true }) as string[];
  const [currentExample, setCurrentExample] = useState(phrases[0]);

  // Reset to first phrase when language changes
  useEffect(() => {
    setCurrentExample(phrases[0]);
  }, [phrases[0]]);

  useEffect(() => {
    if (!voice.isRecording) return;

    const intervalId = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * phrases.length);
      setCurrentExample(phrases[randomIndex]);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [voice.isRecording, phrases]);

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="flex flex-col items-center space-y-4">
        <Button
          onClick={() => voice.isRecording ? editor.stopRecording() : editor.startRecording()}
          className={`w-20 h-20 rounded-full transition-all duration-300 transform hover:scale-105 ${
            voice.isRecording
              ? 'bg-red-500 hover:bg-red-600 animate-pulse'
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
          size="lg"
        >
          {voice.isRecording ? (
            <Square className="w-8 h-8 text-white" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </Button>

        {voice.isRecording && (
          <div className="text-center animate-fade-in">
            <div className="text-gray-500 font-medium">{currentExample}</div>
          </div>
        )}

        <div className="text-center text-gray-600 text-sm max-w-xs">
          {voice.isRecording ? t('voice.stopVoice') : t('voice.startVoice')}
        </div>
      </div>
    </div>
  );
};

export default observer(VoiceControls);
