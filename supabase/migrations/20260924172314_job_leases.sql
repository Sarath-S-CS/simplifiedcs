-- Atomic leases for the scheduled feed/refresh Edge Functions.
--
-- Before this, each job decided whether to run by reading the newest
-- fetched_at/attempted_at row and comparing its age - a read-then-act check
-- that two overlapping invocations could both pass, doing (and, for
-- fetch-case-studies, paying for) the work twice. A lease row updated with a
-- single INSERT ... ON CONFLICT DO UPDATE ... WHERE is atomic: when two
-- callers race, one takes the row lock and the other re-evaluates the WHERE
-- clause against the updated row and gets nothing back.
--
-- Only the Edge Functions (service_role) may touch this; the API roles get
-- no table grants and no EXECUTE on the functions.

create table public.job_leases (
  job text primary key,
  holder uuid,
  lease_expires_at timestamptz not null default 'epoch',
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_status text check (last_status in ('ok', 'error'))
);

alter table public.job_leases enable row level security;
revoke all on table public.job_leases from anon, authenticated;

-- Returns true only for the single caller that acquired the lease.
--   p_lease_seconds          how long the holder may run before the lease
--                            is considered abandoned (crash safety)
--   p_min_since_start        minimum seconds since the last attempt started
--                            (cost guard for paid jobs; 0 to disable)
--   p_min_since_success      minimum seconds since the last successful run
--                            (cadence guard for free daily feeds; 0 to disable)
create or replace function public.try_acquire_job_lease(
  p_job text,
  p_holder uuid,
  p_lease_seconds integer,
  p_min_since_start integer default 0,
  p_min_since_success integer default 0
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  acquired boolean;
begin
  if p_lease_seconds is null or p_lease_seconds <= 0 then
    raise exception 'p_lease_seconds must be positive';
  end if;

  insert into public.job_leases as l (job, holder, lease_expires_at, last_started_at)
  values (p_job, p_holder, now() + make_interval(secs => p_lease_seconds), now())
  on conflict (job) do update
    set holder = excluded.holder,
        lease_expires_at = excluded.lease_expires_at,
        last_started_at = excluded.last_started_at
    where l.lease_expires_at <= now()
      and (p_min_since_start <= 0 or l.last_started_at is null
           or l.last_started_at <= now() - make_interval(secs => p_min_since_start))
      and (p_min_since_success <= 0 or l.last_status is distinct from 'ok' or l.last_finished_at is null
           or l.last_finished_at <= now() - make_interval(secs => p_min_since_success))
  returning true into acquired;

  return coalesce(acquired, false);
end;
$$;

-- Ends the caller's own lease (no effect if another holder has since taken
-- over an expired lease).
create or replace function public.release_job_lease(
  p_job text,
  p_holder uuid,
  p_status text
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  released boolean;
begin
  update public.job_leases
     set lease_expires_at = now(),
         last_finished_at = now(),
         last_status = p_status
   where job = p_job and holder = p_holder
  returning true into released;
  return coalesce(released, false);
end;
$$;

revoke execute on function public.try_acquire_job_lease(text, uuid, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.release_job_lease(text, uuid, text) from public, anon, authenticated;
grant execute on function public.try_acquire_job_lease(text, uuid, integer, integer, integer) to service_role;
grant execute on function public.release_job_lease(text, uuid, text) to service_role;

-- Rollback:
--   drop function public.release_job_lease(text, uuid, text);
--   drop function public.try_acquire_job_lease(text, uuid, integer, integer, integer);
--   drop table public.job_leases;
