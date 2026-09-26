-- Public website uses this narrow server-only RPC. No browser receives an admin key.
create role gi_patient_entry nologin noinherit nobypassrls;
grant gi_patient_entry to postgres;
grant usage on schema api,app,phi,private,audit,extensions to gi_patient_entry;
create table app.intake_sites(site_id uuid primary key references app.sites(id),slug text not null unique check(slug ~ '^[a-z0-9-]{3,60}$'),enabled boolean not null default false,data_mode text not null default 'synthetic' check(data_mode in('synthetic','real')));
create table app.intake_limits(site_id uuid not null references app.sites(id),bucket timestamptz not null,starts int not null,primary key(site_id,bucket));
alter table app.intake_sites enable row level security;alter table app.intake_sites force row level security;
alter table app.intake_limits enable row level security;alter table app.intake_limits force row level security;
revoke all on app.intake_sites,app.intake_limits from public,anon,authenticated,service_role;
grant select on app.intake_sites to gi_patient_entry,gi_demo_executor;
grant select,insert,update on app.intake_limits to gi_patient_entry;
create policy intake_site_read on app.intake_sites for select to gi_patient_entry,gi_demo_executor using(true);
create policy intake_limits on app.intake_limits to gi_patient_entry using(true) with check(true);
grant insert,select on phi.patients,phi.encounters to gi_patient_entry;
grant execute on function private.demo_reviewer(uuid),private.demo_validate_encounter(),private.request_uid() to gi_patient_entry;
create policy entry_patient on phi.patients to gi_patient_entry using(site_id=current_setting('gi.entry_site',true)::uuid) with check(site_id=current_setting('gi.entry_site',true)::uuid);
create policy entry_encounter on phi.encounters to gi_patient_entry using(site_id=current_setting('gi.entry_site',true)::uuid) with check(site_id=current_setting('gi.entry_site',true)::uuid);
grant select on app.demo_content to gi_patient_entry;
create policy entry_content on app.demo_content for select to gi_patient_entry using(true);
grant insert on audit.audit_events to gi_patient_entry;
create policy entry_audit on audit.audit_events for insert to gi_patient_entry with check(resource_type='encounter' and action='demo_public_start' and purpose='patient_encounter');

-- Real-data mode is an explicit site setting; legacy fixtures keep their provenance.
alter table phi.patients drop constraint patients_is_synthetic_check;
alter table phi.patients drop constraint patients_synthetic_identifier_check;
alter table phi.patients add constraint patient_identifier_format check(synthetic_identifier ~ '^(SYN-|VISIT-)[A-Za-z0-9-]+$');
alter table phi.patients alter column year_of_birth drop not null;
alter table phi.encounters drop constraint encounters_synthetic_check;

grant create on schema api to gi_patient_entry;
create function api.patient_start(p_slug text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare s app.intake_sites;reviewer uuid;pat uuid:=gen_random_uuid();eid uuid:=gen_random_uuid();token text;bucket timestamptz:=date_trunc('hour',now());used int; begin
 select * into s from app.intake_sites where slug=p_slug and enabled;
 if s.site_id is null then return jsonb_build_object('ok',false,'error','clinic_unavailable');end if;
 reviewer:=private.demo_reviewer(s.site_id);
 if reviewer is null then return jsonb_build_object('ok',false,'error','clinic_unavailable');end if;
 -- Atomic per-clinic cap cannot be bypassed by spoofing a browser IP header.
 insert into app.intake_limits(site_id,bucket,starts) values(s.site_id,bucket,1) on conflict(site_id,bucket) do update set starts=app.intake_limits.starts+1 returning starts into used;
 if used>120 then return jsonb_build_object('ok',false,'error','try_later');end if;
 perform set_config('gi.entry_site',s.site_id::text,true);
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into phi.patients(id,site_id,synthetic_identifier,display_name,year_of_birth,is_synthetic) values(pat,s.site_id,(case when s.data_mode='synthetic' then 'SYN-' else 'VISIT-' end)||pat::text,'New visit',null,s.data_mode='synthetic');
 insert into phi.encounters(id,site_id,patient_id,assigned_to,synthetic,cap_hash,cap_expires) values(eid,s.site_id,pat,reviewer,s.data_mode='synthetic',encode(extensions.digest(token,'sha256'),'hex'),now()+interval '2 hours');
 insert into audit.audit_events(site_id,purpose,action,resource_type,record_ids,outcome,request_id) values(s.site_id,'patient_encounter','demo_public_start','encounter',array[eid],'allowed',gen_random_uuid());
 return jsonb_build_object('ok',true,'data',jsonb_build_object('id',eid,'token',token));
end $$;
alter function api.patient_start(text) owner to gi_patient_entry;
revoke all on function api.patient_start(text) from public,anon,authenticated;
grant execute on function api.patient_start(text) to service_role;
revoke create on schema api from gi_patient_entry;

do $$ declare d text;begin
 select pg_get_functiondef('api.demo_action(text,uuid,text,jsonb)'::regprocedure) into d;
 d:=replace(d,'insert into phi.encounters(site_id,patient_id,assigned_to) values(pat.site_id,pat.id,private.demo_reviewer(pat.site_id))','insert into phi.encounters(site_id,patient_id,assigned_to,synthetic) values(pat.site_id,pat.id,private.demo_reviewer(pat.site_id),pat.is_synthetic)');
 d:=replace(d,'p_payload->>''noticeVersion''=''synthetic-demo-notice-v1''','p_payload->>''noticeVersion'' in(''synthetic-demo-notice-v1'',''gi-privacy-2026-09-22'')');execute d;
 select pg_get_functiondef('private.demo_job_snapshot()'::regprocedure) into d;
 d:=replace(d,'''intake'',e.intake,','''synthetic'',e.synthetic,''intake'',e.intake,');execute d;
 select pg_get_functiondef('api.report_worker(text,uuid,uuid,jsonb,text)'::regprocedure) into d;
 d:=replace(d,'''mime'',r.mime)', '''mime'',r.mime,''synthetic'',(select x.synthetic from phi.encounters x where x.id=r.encounter_id))');execute d;
end $$;
notify pgrst,'reload schema';
