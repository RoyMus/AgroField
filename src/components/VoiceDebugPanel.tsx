import { useEffect, useState } from 'react';
import { subscribeVoiceLog, getVoiceLog, voiceDebugEnabled } from '@/lib/voice/debugLog';

/** Fixed panel listing speech-engine events; only rendered with ?voicedebug. */
const VoiceDebugPanel = () => {
  const [enabled] = useState(voiceDebugEnabled);
  const [entries, setEntries] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => (enabled ? subscribeVoiceLog(setEntries) : undefined), [enabled]);
  if (!enabled) return null;

  const header = [
    navigator.userAgent,
    `lang=${navigator.language} standalone=${String((navigator as { standalone?: boolean }).standalone ?? false)}`,
    `SpeechRecognition=${'SpeechRecognition' in window} webkit=${'webkitSpeechRecognition' in window}`,
  ];

  const copy = () => {
    navigator.clipboard?.writeText([...header, ...getVoiceLog()].join('\n')).catch(() => {});
  };

  return (
    <div dir="ltr" className="fixed bottom-2 left-2 right-2 z-50 rounded-md bg-black/85 p-2 text-[10px] leading-tight text-green-300 font-mono">
      <div className="flex gap-2 mb-1">
        <span className="font-bold text-white flex-1">Voice debug</span>
        <button className="underline text-white" onClick={copy}>copy</button>
        <button className="underline text-white" onClick={() => setCollapsed(c => !c)}>{collapsed ? 'show' : 'hide'}</button>
      </div>
      {!collapsed && (
        <div className="max-h-56 overflow-y-auto whitespace-pre-wrap break-all">
          {header.map(h => <div key={h} className="text-gray-300">{h}</div>)}
          {entries.length === 0 && <div>(no events yet — tap the mic)</div>}
          {entries.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}
    </div>
  );
};

export default VoiceDebugPanel;
