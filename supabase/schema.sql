-- bounceBack — Datenbank-Schema
-- Im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen (Run).

create table if not exists public.habits (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.logs (
  id uuid primary key,
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  on_track boolean not null,
  trigger_tags text[] not null default '{}',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, date)
);

-- Row Level Security: jede Zeile gehört genau einem Account —
-- die öffentliche URL allein gibt nichts preis.
alter table public.habits enable row level security;
alter table public.tags enable row level security;
alter table public.logs enable row level security;

create policy "own habits" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own tags" on public.tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own logs" on public.logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Für den Pull-Sync (updated_at-Cursor)
create index if not exists habits_updated_at_idx on public.habits (updated_at);
create index if not exists tags_updated_at_idx on public.tags (updated_at);
create index if not exists logs_updated_at_idx on public.logs (updated_at);
