-- A tiny "client portal": support requests, plus an activity log that records WHO did WHAT.
-- Idempotent: safe to run twice.

create table if not exists public.support_requests (
  id         bigint generated always as identity primary key,
  title      text not null,
  status     text not null default 'open' check (status in ('open', 'in_progress', 'done')),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       uuid,          -- who (the signed-in user's id; null if no one was signed in)
  actor_email text,          -- who, in words
  action      text not null, -- INSERT / UPDATE / DELETE
  request_id  bigint,
  detail      jsonb
);

alter table public.support_requests enable row level security;
alter table public.activity_log enable row level security;

-- Signed-in people can read, add and change requests.
drop policy if exists "requests read" on public.support_requests;
create policy "requests read" on public.support_requests for select to authenticated using (true);
drop policy if exists "requests insert" on public.support_requests;
create policy "requests insert" on public.support_requests for insert to authenticated with check (true);
drop policy if exists "requests update" on public.support_requests;
create policy "requests update" on public.support_requests for update to authenticated using (true) with check (true);
drop policy if exists "requests delete" on public.support_requests;
create policy "requests delete" on public.support_requests for delete to authenticated using (true);

-- The log: people can READ it. There is no insert/update/delete policy, so the API can't write or edit it.
drop policy if exists "log read" on public.activity_log;
create policy "log read" on public.activity_log for select to authenticated using (true);
revoke insert, update, delete on public.activity_log from anon, authenticated;

-- Stamp "who and when" on the row itself, so a client can't claim to be someone else.
create or replace function public.stamp_request() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;

-- Write the log. SECURITY DEFINER so it can write even though the caller can't.
create or replace function public.log_request_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activity_log (actor, actor_email, action, request_id, detail)
  values (
    auth.uid(),
    auth.jwt() ->> 'email',
    tg_op,
    coalesce(new.id, old.id),
    case tg_op
      when 'INSERT' then jsonb_build_object('title', new.title, 'status', new.status)
      when 'UPDATE' then jsonb_build_object('from', old.status, 'to', new.status)
      else jsonb_build_object('title', old.title)
    end
  );
  return coalesce(new, old);
end $$;
revoke execute on function public.log_request_change() from public, anon, authenticated;
revoke execute on function public.stamp_request() from public, anon, authenticated;

drop trigger if exists stamp_request on public.support_requests;
create trigger stamp_request before insert or update on public.support_requests
  for each row execute function public.stamp_request();
drop trigger if exists log_request_change on public.support_requests;
create trigger log_request_change after insert or update or delete on public.support_requests
  for each row execute function public.log_request_change();
