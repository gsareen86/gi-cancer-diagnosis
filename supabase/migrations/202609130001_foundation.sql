-- Synthetic foundation. Execute only through the project-verifying migration runner.
-- The migration runner wraps this file and its ledger entry in a single transaction.
do $$ begin
  if exists(select 1 from pg_namespace where nspname in ('app','phi','audit','private','api')) then
    raise exception 'Application schemas already exist; review drift before migrating';
  end if;
end $$;
create role gi_api_executor nologin noinherit nobypassrls;
create role gi_policy_reader nologin noinherit nobypassrls;
create role gi_audit_writer nologin noinherit nobypassrls;
create role gi_metadata_reader nologin noinherit nobypassrls;
grant gi_api_executor,gi_policy_reader,gi_audit_writer,gi_metadata_reader to postgres;
create schema app; create schema phi; create schema audit; create schema private; create schema api;
revoke all on schema app,phi,audit,private,api from public,anon,authenticated,service_role;
-- Required only while assigning function ownership; removed before commit.
grant create on schema private,api to gi_api_executor,gi_policy_reader,gi_audit_writer,gi_metadata_reader;
alter default privileges revoke execute on functions from public;
grant usage on schema api to anon,authenticated;
grant usage on schema app,phi,audit,private,auth to gi_api_executor;
grant usage on schema app,private,auth to gi_policy_reader;
grant usage on schema audit,auth to gi_audit_writer;
grant usage on schema app to gi_metadata_reader;

create table app.settings (
  singleton boolean primary key default true check(singleton),
  project_ref text not null default 'unconfigured', environment text not null default 'demo' check(environment in ('demo','test')),
  schema_version int not null default 1, idle_seconds int not null default 900 check(idle_seconds between 300 and 1800),
  absolute_seconds int not null default 28800 check(absolute_seconds between 3600 and 43200)
);
insert into app.settings default values;
create table app.sites(id uuid primary key default gen_random_uuid(),name text not null);
create table app.staff_accounts(user_id uuid primary key,synthetic_key text unique check(synthetic_key like 'SYN-%'),active boolean not null default true,revoked_before timestamptz not null default '-infinity');
create table app.site_memberships(user_id uuid not null references app.staff_accounts(user_id),site_id uuid not null references app.sites(id),role text not null check(role in('clinician','coordinator','site_admin')),active boolean not null default true,primary key(user_id,site_id,role));
create table app.staff_sessions(session_id uuid primary key,user_id uuid not null references app.staff_accounts(user_id),activated_at timestamptz not null default now(),last_activity_at timestamptz not null default now(),expires_at timestamptz not null,revoked_at timestamptz);
create table app.role_purposes(role text not null,purpose text not null,primary key(role,purpose));
insert into app.role_purposes values('clinician','direct_care'),('coordinator','intake_support'),('site_admin','site_administration'),('site_admin','audit_review');
create table phi.patients(id uuid primary key default gen_random_uuid(),site_id uuid not null references app.sites(id),synthetic_identifier text unique not null check(synthetic_identifier like 'SYN-%'),display_name text not null,year_of_birth int not null,is_synthetic boolean not null check(is_synthetic));
create table audit.audit_events(id uuid primary key default gen_random_uuid(),occurred_at timestamptz not null default clock_timestamp(),actor_user_id uuid,actor_role text,site_id uuid,purpose text not null,action text not null,resource_type text not null,record_ids uuid[] not null default '{}',outcome text not null check(outcome in('allowed','denied_or_not_found')),request_id uuid not null unique);
create table audit.operator_events(id uuid primary key default gen_random_uuid(),occurred_at timestamptz not null default clock_timestamp(),operator_id text not null,reason_code text not null,action text not null,target_user_id uuid,request_id uuid not null,outcome text not null check(outcome in('intent','completed','failed')),site_id uuid,record_ids uuid[] not null default '{}',resource_type text not null default 'staff');
create index on app.site_memberships(site_id,user_id) where active;
create index on app.staff_sessions(user_id);
create index on phi.patients(site_id,synthetic_identifier);
create index on audit.audit_events(site_id,occurred_at desc);

do $$ declare r record; begin
 for r in select schemaname,tablename from pg_tables where schemaname in ('app','phi','audit') loop
   execute format('alter table %I.%I enable row level security',r.schemaname,r.tablename);
   execute format('alter table %I.%I force row level security',r.schemaname,r.tablename);
 end loop;
end $$;
revoke all on all tables in schema app,phi,audit from public,anon,authenticated,service_role;
grant select on app.settings,app.sites,app.site_memberships,app.staff_accounts,app.staff_sessions,app.role_purposes to gi_policy_reader;
grant select(id,user_id,created_at) on auth.sessions to gi_policy_reader;
grant select(id,banned_until,deleted_at) on auth.users to gi_policy_reader;
grant select(project_ref,environment,schema_version) on app.settings to gi_metadata_reader;
create policy metadata on app.settings for select to gi_metadata_reader using(true);
do $$ declare n text; begin foreach n in array array['settings','sites','site_memberships','staff_accounts','staff_sessions','role_purposes'] loop
 execute format('create policy policy_reader on app.%I for select to gi_policy_reader using(true)',n);
end loop; end $$;

create function private.session_id() returns uuid language sql stable set search_path='' as $$
 select case when auth.jwt()->>'session_id' ~ '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$' then (auth.jwt()->>'session_id')::uuid end
$$;
create function private.identity_ok() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal'='aal2' and exists(
 select 1 from app.staff_accounts a join auth.users u on u.id=a.user_id
 join auth.sessions s on s.user_id=a.user_id
 where a.user_id=auth.uid() and a.active and s.id=private.session_id()
 and s.created_at>a.revoked_before and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
 ),false)
$$;
alter function private.identity_ok() owner to gi_policy_reader;
create function private.session_ok() returns boolean language sql volatile security definer set search_path='' as $$
 select private.identity_ok() and exists(select 1 from app.staff_sessions s cross join app.settings c
 where s.session_id=private.session_id() and s.user_id=auth.uid() and s.revoked_at is null
 and s.expires_at>clock_timestamp() and s.last_activity_at+make_interval(secs=>c.idle_seconds)>clock_timestamp())
$$;
alter function private.session_ok() owner to gi_policy_reader;
create function private.has_role(p_site uuid,p_roles text[]) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.site_memberships m where m.user_id=auth.uid() and m.site_id=p_site and m.active and m.role=any(p_roles))
$$;
alter function private.has_role(uuid,text[]) owner to gi_policy_reader;
grant execute on function private.session_id() to gi_policy_reader,gi_api_executor;
grant execute on function private.identity_ok(),private.session_ok(),private.has_role(uuid,text[]) to gi_policy_reader,gi_api_executor;

grant select on app.sites,app.site_memberships,app.settings,app.staff_sessions,app.role_purposes to gi_api_executor;
grant insert,update on app.staff_sessions to gi_api_executor;
grant select on phi.patients,audit.audit_events to gi_api_executor;
grant insert on audit.audit_events to gi_audit_writer;
create policy executor_settings on app.settings for select to gi_api_executor using(private.identity_ok());
create policy executor_purposes on app.role_purposes for select to gi_api_executor using(private.identity_ok());
create policy executor_sessions on app.staff_sessions to gi_api_executor using(user_id=auth.uid()) with check(user_id=auth.uid() and private.identity_ok());
create policy executor_sites on app.sites for select to gi_api_executor using(private.has_role(id,array['clinician','coordinator','site_admin']));
create policy executor_memberships on app.site_memberships for select to gi_api_executor using(user_id=auth.uid() or private.has_role(site_id,array['site_admin']));
create policy executor_patients on phi.patients for select to gi_api_executor using(private.has_role(site_id,array['clinician','coordinator']));
create policy executor_audit on audit.audit_events for select to gi_api_executor using(private.has_role(site_id,array['site_admin']));
create policy writer_audit on audit.audit_events for insert to gi_audit_writer with check(actor_user_id=auth.uid() and action in('list_patients','get_patient','list_audit_events','list_site_memberships','my_memberships') and purpose in('direct_care','intake_support','audit_review','site_administration','own_memberships','invalid') and resource_type in('patient','audit','membership') and (actor_role is null or actor_role in('clinician','coordinator','site_admin')));
do $$ declare r record; begin
 for r in select * from (values('phi','patients'),('audit','audit_events'),('app','sites'),('app','site_memberships')) as t(s,n) loop
 execute format('create policy current_session on %I.%I as restrictive for select to gi_api_executor using((select private.session_ok()))',r.s,r.n);
 end loop;
end $$;
create function private.no_audit_mutation() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Audit history is append-only'; end $$;
create trigger audit_no_change before update or delete on audit.audit_events for each statement execute function private.no_audit_mutation();
create trigger audit_no_truncate before truncate on audit.audit_events for each statement execute function private.no_audit_mutation();
create trigger operator_no_change before update or delete on audit.operator_events for each statement execute function private.no_audit_mutation();
create trigger operator_no_truncate before truncate on audit.operator_events for each statement execute function private.no_audit_mutation();
create function private.record_access(p_role text,p_site uuid,p_purpose text,p_action text,p_type text,p_ids uuid[],p_outcome text,p_request uuid) returns void language sql volatile security definer set search_path='' as $$
 insert into audit.audit_events(actor_user_id,actor_role,site_id,purpose,action,resource_type,record_ids,outcome,request_id)
 values(auth.uid(),p_role,p_site,p_purpose,p_action,p_type,p_ids,p_outcome,p_request)
$$;
alter function private.record_access(text,uuid,text,text,text,uuid[],text,uuid) owner to gi_audit_writer;
grant execute on function private.record_access(text,uuid,text,text,text,uuid[],text,uuid) to gi_api_executor;

create function api.environment() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('project_ref',project_ref,'environment',environment,'schema_version',schema_version) from app.settings
$$;
alter function api.environment() owner to gi_metadata_reader;
grant execute on function api.environment() to anon,authenticated;
create function api.session_status() returns jsonb language sql volatile security definer set search_path='' as $$
 select case when private.session_ok() then
 (select jsonb_build_object('ok',true,'data',jsonb_build_object('idleExpiresAt',s.last_activity_at+make_interval(secs=>c.idle_seconds),'absoluteExpiresAt',s.expires_at)) from app.staff_sessions s cross join app.settings c where s.session_id=private.session_id() and s.user_id=auth.uid())
 else jsonb_build_object('ok',false,'error',jsonb_build_object('code','session_unavailable'),'data',null) end
$$;
create function api.begin_staff_session() returns jsonb language plpgsql volatile security definer set search_path='' as $$
 declare started timestamptz; ttl int; idle int;
 begin
 if not private.identity_ok() then return jsonb_build_object('ok',false,'data',null,'error',jsonb_build_object('code','session_unavailable')); end if;
 if exists(select 1 from app.staff_sessions where session_id=private.session_id()) then return api.session_status(); end if;
 select c.absolute_seconds,c.idle_seconds into ttl,idle from app.settings c;
 select created_at into started from private.auth_session_started();
 if started is null or started+make_interval(secs=>idle)<=clock_timestamp() then return jsonb_build_object('ok',false,'data',null,'error',jsonb_build_object('code','fresh_signin_required')); end if;
 insert into app.staff_sessions(session_id,user_id,expires_at) values(private.session_id(),auth.uid(),started+make_interval(secs=>ttl)) on conflict do nothing;
 return api.session_status();
 end
$$;
-- The helper returns only this verified identity's current session creation time.
create function private.auth_session_started() returns table(created_at timestamptz) language sql stable security definer set search_path='' as $$
 select s.created_at from auth.sessions s where s.id=private.session_id() and s.user_id=auth.uid() and private.identity_ok()
$$;
alter function private.auth_session_started() owner to gi_policy_reader;
grant execute on function private.auth_session_started() to gi_api_executor;
create function api.touch_staff_session() returns jsonb language plpgsql volatile security definer set search_path='' as $$
 begin
 perform 1 from app.staff_sessions where session_id=private.session_id() and user_id=auth.uid() for update;
 if not private.session_ok() then return api.session_status(); end if;
 update app.staff_sessions set last_activity_at=clock_timestamp() where session_id=private.session_id() and user_id=auth.uid();
 return api.session_status();
 end
$$;
create function api.end_staff_session() returns jsonb language plpgsql volatile security definer set search_path='' as $$
 begin
 update app.staff_sessions set revoked_at=coalesce(revoked_at,now()) where session_id=private.session_id() and user_id=auth.uid();
 return jsonb_build_object('ok',true);
 end
$$;

create function private.read_operation(p_op text,p_site uuid,p_purpose text,p_id uuid,p_limit int,p_offset int,p_from timestamptz,p_to timestamptz) returns jsonb language plpgsql volatile set search_path='' as $$
 declare permitted boolean:=false; effective_role text; result jsonb:='[]'; ids uuid[]:='{}'; request uuid:=gen_random_uuid(); event_site uuid; event_type text;
 begin
 if p_op not in('list_patients','get_patient','list_audit_events','list_site_memberships','my_memberships') then raise exception 'Unknown operation'; end if;
 event_type:=case when p_op in('list_patients','get_patient') then 'patient' when p_op='list_audit_events' then 'audit' else 'membership' end;
 if private.session_ok() and p_limit between 1 and 100 and p_offset between 0 and 100000 then
 if p_op='my_memberships' then permitted:=true;
 elsif p_op in('list_patients','get_patient') then
   if p_purpose='direct_care' and private.has_role(p_site,array['clinician']) then permitted:=true;effective_role:='clinician';
   elsif p_purpose='intake_support' and private.has_role(p_site,array['coordinator']) then permitted:=true;effective_role:='coordinator'; end if;
 elsif p_op='list_audit_events' and p_purpose='audit_review' and private.has_role(p_site,array['site_admin']) and p_from<=p_to and p_to-p_from<=interval '90 days' then permitted:=true;effective_role:='site_admin';
 elsif p_op='list_site_memberships' and p_purpose='site_administration' and private.has_role(p_site,array['site_admin']) then permitted:=true;effective_role:='site_admin';
 end if;end if;
 if private.has_role(p_site,array['clinician','coordinator','site_admin']) then event_site:=p_site; end if;
 if permitted then
 if p_op='my_memberships' then
   select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from(select m.site_id,s.name as site_name,m.role from app.site_memberships m join app.sites s on s.id=m.site_id where m.user_id=auth.uid() and m.active order by s.name,m.role) t;
   select coalesce(array_agg(distinct (v->>'site_id')::uuid),'{}') into ids from jsonb_array_elements(result) v;
 elsif p_op in('list_patients','get_patient') then
   select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from(select id,synthetic_identifier,display_name,year_of_birth from phi.patients where site_id=p_site and (p_op='list_patients' or id=p_id) order by synthetic_identifier limit p_limit offset p_offset) t;
   select coalesce(array_agg((v->>'id')::uuid),'{}') into ids from jsonb_array_elements(result) v;
   if p_op='get_patient' and result='[]'::jsonb then permitted:=false;end if;
 elsif p_op='list_audit_events' then
   select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from(select * from audit.audit_events where site_id=p_site and occurred_at>=p_from and occurred_at<=p_to order by occurred_at desc,id limit p_limit offset p_offset) t;
   select coalesce(array_agg((v->>'id')::uuid),'{}') into ids from jsonb_array_elements(result) v;
 elsif p_op='list_site_memberships' then
   select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from(select user_id,role,active from app.site_memberships where site_id=p_site order by user_id,role limit p_limit offset p_offset) t;
   select coalesce(array_agg(distinct (v->>'user_id')::uuid),'{}') into ids from jsonb_array_elements(result) v;
 end if;end if;
 perform private.record_access(effective_role,event_site,case when p_purpose in('direct_care','intake_support','audit_review','site_administration','own_memberships') then p_purpose else 'invalid' end,p_op,event_type,case when permitted then ids else '{}'::uuid[] end,case when permitted then 'allowed' else 'denied_or_not_found' end,request);
 return jsonb_build_object('ok',permitted,'data',case when permitted then result else null end,'error',case when permitted then null else jsonb_build_object('code','unavailable') end,'requestId',request);
 end
$$;
grant execute on function private.read_operation(text,uuid,text,uuid,int,int,timestamptz,timestamptz) to gi_api_executor;
create function api.my_memberships() returns jsonb language sql volatile security definer set search_path='' as $$ select private.read_operation('my_memberships',null,'own_memberships',null,100,0,null,null) $$;
create function api.list_patients(p_site uuid,p_purpose text default null,p_limit int default 50,p_offset int default 0) returns jsonb language sql volatile security definer set search_path='' as $$ select private.read_operation('list_patients',p_site,p_purpose,null,p_limit,p_offset,null,null) $$;
create function api.get_patient(p_site uuid,p_purpose text default null,p_id uuid default null) returns jsonb language sql volatile security definer set search_path='' as $$ select private.read_operation('get_patient',p_site,p_purpose,p_id,1,0,null,null) $$;
create function api.list_site_memberships(p_site uuid,p_purpose text default 'site_administration',p_limit int default 50,p_offset int default 0) returns jsonb language sql volatile security definer set search_path='' as $$ select private.read_operation('list_site_memberships',p_site,p_purpose,null,p_limit,p_offset,null,null) $$;
create function api.list_audit_events(p_site uuid,p_from timestamptz,p_to timestamptz,p_purpose text default 'audit_review',p_limit int default 50,p_offset int default 0) returns jsonb language sql volatile security definer set search_path='' as $$ select private.read_operation('list_audit_events',p_site,p_purpose,null,p_limit,p_offset,p_from,p_to) $$;

do $$ declare r record; begin
 for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api' and p.proname<>'environment' loop
   execute format('alter function %s owner to gi_api_executor',r.signature);
   execute format('grant execute on function %s to authenticated,gi_api_executor',r.signature);
 end loop;
end $$;
grant usage on schema api to gi_api_executor,gi_metadata_reader;
revoke create on schema private,api from gi_api_executor,gi_policy_reader,gi_audit_writer,gi_metadata_reader;
revoke execute on all functions in schema private from public,anon,authenticated,service_role;
revoke all on all tables in schema app,phi,audit from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
