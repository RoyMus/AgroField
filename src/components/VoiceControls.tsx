
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";

interface VoiceControlsProps {
  isRecording: boolean;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<void>;
}

const VoiceControls = ({ isRecording, onStartRecording, onStopRecording }: VoiceControlsProps) => {
  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isRecording && (
            <span className="text-red-600 flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
              Recording...
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={onStartRecording}
            disabled={isRecording}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Mic className="h-4 w-4" />
            Start Recording
          </Button>
          <Button
            onClick={onStopRecording}
            disabled={!isRecording}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <MicOff className="h-4 w-4" />
            Stop Recording
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VoiceControls;
