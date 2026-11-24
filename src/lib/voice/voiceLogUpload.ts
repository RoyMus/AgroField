/**
 * Uploads the voice diagnostics log to the Supabase table `voice_logs`
 * (see supabase/migrations/*_voice_logs.sql), a batch every few seconds.
 *
 * TEMPORARY: remove once voice input is stable.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { restorePendingVoiceLog, takePendingVoiceLog, voiceLog } from './debugLog';

const UPLOAD_INTERVAL_MS = 5000;
const MAX_BATCH = 200;

const randomId = () => Math.random().toString(36).slice(2, 10);

const deviceId = (() => {
  try {
    let id = localStorage.getItem('voiceDeviceId');
    if (!id) { id = randomId(); localStorage.setItem('voiceDeviceId', id); }
    return id;
  } catch { return randomId(); }
})();
const pageId = randomId();

// The table isn't in the generated types; use an untyped client for it.
const db = supabase as unknown as SupabaseClient;

let started = false;
let uploading = false;
let failures = 0;

const upload = async () => {
  if (uploading) return;
  const batch = takePendingVoiceLog();
  if (batch.length === 0) return;
  uploading = true;
  try {
    for (let i = 0; i < batch.length; i += MAX_BATCH) {
      const { error } = await db.from('voice_logs').insert({
        device_id: deviceId,
        page_id: pageId,
        build: typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev',
        user_agent: navigator.userAgent.slice(0, 300),
        url: window.location.pathname.slice(0, 200),
        entries: batch.slice(i, i + MAX_BATCH),
      });
      if (error) throw error;
    }
    failures = 0;
  } catch (e) {
    failures++;
    // Keep the entries for the next try, but don't retry forever if the
    // table doesn't exist.
    if (failures <= 3) restorePendingVoiceLog(batch);
    if (failures === 1) voiceLog(`log upload failed: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
  } finally {
    uploading = false;
  }
};

/** Starts periodic uploads (idempotent), and logs uncaught errors too. */
export const startVoiceLogUpload = () => {
  if (started) return;
  started = true;
  voiceLog(`page loaded, device ${deviceId}, build ${typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'}`);
  window.addEventListener('error', e => voiceLog(`JS error: ${e.message} @ ${e.filename?.split('/').pop()}:${e.lineno}`));
  window.addEventListener('unhandledrejection', e => {
    const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
    voiceLog(`unhandled rejection: ${reason.slice(0, 300)}`);
  });
  setInterval(upload, UPLOAD_INTERVAL_MS);
  // Send what we have when the page is hidden (app switched, tab closed).
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') upload(); });
};
