import { useEffect, useReducer, useState } from 'react';
import {
  clearVoiceLog, getVoiceLog, isVoiceDebugEnabled, setVoiceDebugEnabled, subscribeVoiceLog, voiceDeviceInfo,
} from '@/lib/voice/debugLog';

/** On-screen voice log; renders nothing unless enabled (5 taps on the voice hint). */
const VoiceDebugPanel = () => {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [copied, setCopied] = useState(false);
  useEffect(() => subscribeVoiceLog(rerender), []);
  if (!isVoiceDebugEnabled()) return null;

  const lines = [...voiceDeviceInfo(), ...getVoiceLog()];
  const copy = async () => {
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for browsers without clipboard access
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div dir="ltr" className="w-full rounded-md bg-black p-2 text-left font-mono text-[10px] leading-tight text-green-300">
      <div className="mb-1 flex gap-3 text-white">
        <span className="flex-1 font-bold">Voice log</span>
        <button type="button" className="underline" onClick={copy}>{copied ? 'copied' : 'copy'}</button>
        <button type="button" className="underline" onClick={clearVoiceLog}>clear</button>
        <button type="button" className="underline" onClick={() => setVoiceDebugEnabled(false)}>close</button>
      </div>
      <div className="max-h-72 overflow-y-auto whitespace-pre-wrap break-all">
        {lines.map((line, i) => <div key={i}>{line}</div>)}
      </div>
    </div>
  );
};

export default VoiceDebugPanel;
