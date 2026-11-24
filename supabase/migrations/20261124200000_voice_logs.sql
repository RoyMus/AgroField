-- TEMPORARY: voice input diagnostics uploaded by the app (src/lib/voice/voiceLogUpload.ts).
-- Drop this table once voice input is stable:  drop table public.voice_logs;
create table if not exists public.voice_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  device_id text,
  page_id text,
  build text,
  user_agent text,
  url text,
  entries jsonb not null
);

create index if not exists voice_logs_created_at_idx on public.voice_logs (created_at desc);

alter table public.voice_logs enable row level security;

-- The app may only add rows (of bounded size); nobody can read them through the API.
drop policy if exists "app can insert voice logs" on public.voice_logs;
create policy "app can insert voice logs" on public.voice_logs
  for insert to anon, authenticated
  with check (
    jsonb_typeof(entries) = 'array'
    and jsonb_array_length(entries) <= 200
    and pg_column_size(entries) < 100000
  );
