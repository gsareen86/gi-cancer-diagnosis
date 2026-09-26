-- Supabase's managed auth schema does not delegate USAGE to custom roles.
-- Keep patient/audit readers on non-owner RLS roles. Only these fixed, private,
-- no-argument Auth helpers use the migration owner. They return current-request
-- identity or its eligible session creation time, never arbitrary users/records.
create function private.request_uid() returns uuid
language sql stable security definer set search_path='' as $$ select auth.uid() $$;

create or replace function private.session_id() returns uuid
language sql stable security definer set search_path='' as $$
 select case when auth.jwt()->>'session_id' ~ '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$'
 then (auth.jwt()->>'session_id')::uuid end
$$;

create function private.managed_auth_session() returns table(created_at timestamptz)
language sql stable security definer set search_path='' as $$
 select s.created_at from auth.sessions s join auth.users u on u.id=s.user_id
 where s.id=private.session_id() and s.user_id=auth.uid() and auth.jwt()->>'aal'='aal2'
 and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
$$;

revoke all on function private.request_uid(),private.managed_auth_session(),private.session_id() from public,anon,authenticated,service_role;
grant usage on schema private to gi_audit_writer;
grant execute on function private.request_uid() to gi_api_executor,gi_policy_reader,gi_audit_writer;
grant execute on function private.managed_auth_session() to gi_policy_reader;
grant execute on function private.session_id() to gi_api_executor,gi_policy_reader;

create or replace function private.identity_ok() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.staff_accounts a cross join private.managed_auth_session() s
 where a.user_id=private.request_uid() and a.active and s.created_at>a.revoked_before)
$$;
create or replace function private.auth_session_started() returns table(created_at timestamptz)
language sql stable security definer set search_path='' as $$
 select s.created_at from private.managed_auth_session() s where private.identity_ok()
$$;

-- Preserve the existing function owners, grants and signatures while routing
-- current-UID checks through the fixed helper instead of the inaccessible schema.
do $$ declare r record; begin
 for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in('private','api') and p.proname not in('request_uid','managed_auth_session')
 and p.prosrc like '%auth.uid()%'
 loop execute replace(pg_get_functiondef(r.oid),'auth.uid()','private.request_uid()'); end loop;
end $$;

alter policy executor_sessions on app.staff_sessions
 using(user_id=private.request_uid()) with check(user_id=private.request_uid() and private.identity_ok());
alter policy executor_memberships on app.site_memberships
 using(user_id=private.request_uid() or private.has_role(site_id,array['site_admin']));
alter policy writer_audit on audit.audit_events
 with check(actor_user_id=private.request_uid()
 and action in('list_patients','get_patient','list_audit_events','list_site_memberships','my_memberships')
 and purpose in('direct_care','intake_support','audit_review','site_administration','own_memberships','invalid')
 and resource_type in('patient','audit','membership')
 and (actor_role is null or actor_role in('clinician','coordinator','site_admin')));

revoke select(id,user_id,created_at) on auth.sessions from gi_policy_reader;
revoke select(id,banned_until,deleted_at) on auth.users from gi_policy_reader;
notify pgrst,'reload schema';
