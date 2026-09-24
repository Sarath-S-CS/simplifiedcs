create table public.case_studies (
  id bigint generated always as identity primary key,
  external_id text not null unique,
  year text not null,
  title text not null,
  href text not null,
  source_name text not null,
  summary_what text not null,
  summary_how text not null,
  summary_impact text not null,
  summary_lesson text not null,
  summary_safeguard text not null,
  incident_date date,
  priority_score numeric not null default 0,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.case_studies enable row level security;

create policy "Public read access"
  on public.case_studies
  for select
  to anon, authenticated
  using (true);
