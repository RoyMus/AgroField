
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Square} from "lucide-react";
import { useState, useEffect } from "react";

interface VoiceControlsProps {
  isRecording: boolean;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<void>;
}

const VoiceControls = ({ isRecording, onStartRecording, onStopRecording }: VoiceControlsProps) => {
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
        <div className="text-center animate-fade-in">
          <div className="text-gray-500 font-medium">{currentExample}</div>
          {/* <div className="text-gray-500 text-sm">{formatTime(recordingTime)}</div> */}
        </div>
      )}
      
      <div className="text-center text-gray-600 text-sm max-w-xs">
        {isRecording ? 'לחץ על הריבוע כדי להפסיק מצב קולי' : 'לחץ על המיקרופון כדי להתחיל מצב קולי'}
      </div>
    </div>
    </div>
   
  );
};

export default VoiceControls;
