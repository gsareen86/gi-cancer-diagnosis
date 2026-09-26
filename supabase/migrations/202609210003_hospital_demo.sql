-- Synthetic-only vertical slice. Browser roles receive RPC execution, never tables.
create role gi_demo_executor nologin noinherit nobypassrls;
create role gi_demo_worker nologin noinherit nobypassrls;
grant gi_demo_executor,gi_demo_worker to postgres;
grant usage on schema api,private,phi,app,audit,extensions to gi_demo_executor,gi_demo_worker;
grant create on schema api,private to gi_demo_executor,gi_demo_worker;
grant create on schema private to gi_policy_reader;
grant execute on function private.request_uid(),private.session_ok(),private.has_role(uuid,text[]) to gi_demo_executor;

create table phi.encounters(
 id uuid primary key default gen_random_uuid(),site_id uuid not null references app.sites(id),patient_id uuid not null references phi.patients(id),
 assigned_to uuid not null references app.staff_accounts(user_id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 synthetic boolean not null default true check(synthetic),status text not null default 'awaiting_consent' check(status in('awaiting_consent','intake','queued','review_needed','reviewed')),
 consent_at timestamptz,notice_version text,cap_hash text,cap_expires timestamptz,
 version int not null default 0,intake jsonb not null default '{}',independent jsonb,independent_at timestamptz,ai_revealed_at timestamptz,
 ai jsonb,ai_version int,ai_created_at timestamptz,release jsonb,released_at timestamptz,reviewer_id uuid,
 content_version text not null default 'demo-draft-2026-09-21'
);
create index on phi.encounters(site_id,updated_at desc);
create index on phi.encounters(patient_id,created_at desc);
create table phi.encounter_versions(id uuid primary key default gen_random_uuid(),encounter_id uuid not null references phi.encounters(id),site_id uuid not null,version int not null,intake jsonb not null,actor uuid,created_at timestamptz not null default now(),unique(encounter_id,version));
create table phi.demo_reports(id uuid primary key default gen_random_uuid(),encounter_id uuid not null references phi.encounters(id),site_id uuid not null,name text not null,mime text not null,body text not null,fields jsonb not null default '[]',quality text not null,created_at timestamptz not null default now(),verified_at timestamptz,verifier text,check(length(body)<=7500000),check(jsonb_array_length(fields)<=100));
create table phi.demo_jobs(id uuid primary key default gen_random_uuid(),encounter_id uuid not null references phi.encounters(id),site_id uuid not null,source_version int not null,status text not null default 'queued' check(status in('queued','running','completed','failed','cancelled')),attempts int not null default 0,lease uuid,lease_until timestamptz,available_at timestamptz not null default now(),created_at timestamptz not null default now(),error_code text,result jsonb,unique(encounter_id,source_version));

create function private.demo_access(p_site uuid,p_hash text,p_expires timestamptz) returns boolean language sql volatile set search_path='' as $$
 select (private.session_ok() and private.has_role(p_site,array['clinician','coordinator'])) or
 (p_expires>clock_timestamp() and length(current_setting('gi.demo_token',true))=64 and p_hash=encode(extensions.digest(current_setting('gi.demo_token',true),'sha256'),'hex'))
$$;
grant execute on function private.demo_access(uuid,text,timestamptz) to gi_demo_executor;
create function private.demo_reviewer(p_site uuid) returns uuid language sql stable security definer set search_path='' as $$
 select m.user_id from app.site_memberships m join app.staff_accounts a on a.user_id=m.user_id where m.site_id=p_site and m.role='clinician' and m.active and a.active order by m.user_id limit 1
$$;
alter function private.demo_reviewer(uuid) owner to gi_policy_reader;
grant execute on function private.demo_reviewer(uuid) to gi_demo_executor;
grant select on phi.patients to gi_demo_executor;
create policy demo_patient_lookup on phi.patients for select to gi_demo_executor using(private.session_ok() and private.has_role(site_id,array['clinician','coordinator']));
grant select,insert,update on phi.encounters,phi.demo_reports,phi.demo_jobs to gi_demo_executor;
grant select,insert on phi.encounter_versions to gi_demo_executor;
grant select,update on phi.encounters,phi.demo_jobs to gi_demo_worker;
grant select on phi.demo_reports to gi_demo_worker;
do $$ declare t text; begin foreach t in array array['encounters','encounter_versions','demo_reports','demo_jobs'] loop
 execute format('alter table phi.%I enable row level security',t);
 execute format('alter table phi.%I force row level security',t);
 execute format('revoke all on phi.%I from public,anon,authenticated,service_role',t);
 end loop; end $$;
create policy demo_encounters on phi.encounters to gi_demo_executor using(private.demo_access(site_id,cap_hash,cap_expires)) with check(private.demo_access(site_id,cap_hash,cap_expires));
create policy demo_versions on phi.encounter_versions to gi_demo_executor using(exists(select 1 from phi.encounters e where e.id=encounter_id and e.site_id=encounter_versions.site_id)) with check(exists(select 1 from phi.encounters e where e.id=encounter_id and e.site_id=encounter_versions.site_id));
create policy demo_reports on phi.demo_reports to gi_demo_executor using(exists(select 1 from phi.encounters e where e.id=encounter_id and e.site_id=demo_reports.site_id)) with check(exists(select 1 from phi.encounters e where e.id=encounter_id and e.site_id=demo_reports.site_id));
create policy demo_jobs on phi.demo_jobs to gi_demo_executor using(exists(select 1 from phi.encounters e where e.id=encounter_id and e.site_id=demo_jobs.site_id)) with check(exists(select 1 from phi.encounters e where e.id=encounter_id and e.site_id=demo_jobs.site_id));
create policy worker_encounters on phi.encounters to gi_demo_worker using(true) with check(true);
create policy worker_jobs on phi.demo_jobs to gi_demo_worker using(true) with check(true);
create policy worker_reports on phi.demo_reports for select to gi_demo_worker using(true);
create trigger versions_no_change before update or delete or truncate on phi.encounter_versions for each statement execute function private.no_audit_mutation();

-- A separate append-only insert policy supports patient/worker actors without changing the foundation writer.
grant insert on audit.audit_events to gi_demo_executor,gi_demo_worker;
create policy demo_audit_insert on audit.audit_events for insert to gi_demo_executor,gi_demo_worker with check(resource_type='encounter' and action like 'demo_%' and purpose in('direct_care','intake_support','patient_encounter','ai_processing'));

create function private.demo_view(e phi.encounters,p_staff boolean,p_clinician boolean) returns jsonb language sql volatile set search_path='' as $$
 select jsonb_build_object('id',e.id,'siteId',e.site_id,'patientId',e.patient_id,'assignedTo',e.assigned_to,'status',e.status,'version',e.version,'consentAt',e.consent_at,'contentVersion',e.content_version,'intake',e.intake,'createdAt',e.created_at,'updatedAt',e.updated_at,
 'reports',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'mime',r.mime,'fields',r.fields,'quality',r.quality,'createdAt',r.created_at,'verifiedAt',r.verified_at,'verifier',r.verifier) order by r.created_at) from phi.demo_reports r where r.encounter_id=e.id),'[]'),
 'job',(select jsonb_build_object('id',j.id,'status',j.status,'attempts',j.attempts,'errorCode',j.error_code) from phi.demo_jobs j where j.encounter_id=e.id and j.source_version=e.version),
 'ai',case when (not p_staff or (p_clinician and e.ai_revealed_at is not null)) and e.ai_version=e.version then e.ai else null end,
 'aiCreatedAt',e.ai_created_at,'aiAvailable',e.ai_version=e.version and e.ai is not null,'aiRevealedAt',case when p_clinician then e.ai_revealed_at else null end,
 'independent',case when p_clinician then e.independent else null end,'independentAt',case when p_clinician then e.independent_at else null end,
 'release',e.release,'releasedAt',e.released_at,'canReview',p_clinician)
$$;
grant execute on function private.demo_view(phi.encounters,boolean,boolean) to gi_demo_executor;

create function api.demo_action(p_action text,p_id uuid default null,p_token text default null,p_payload jsonb default '{}') returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare e phi.encounters; pat phi.patients; allowed boolean:=false; staff boolean:=false; clinician boolean:=false; result jsonb; rid uuid:=gen_random_uuid(); token text; doc phi.demo_reports; requested_version int; role_name text; event_site uuid; ids uuid[]:='{}'; err text:='unavailable';
begin
 perform set_config('gi.demo_token',coalesce(p_token,''),true);
 staff:=private.session_ok();
 if octet_length(p_payload::text)>8000000 then p_action:='invalid'; end if;
 if p_action='create' and staff then
   select * into pat from phi.patients where id=p_id;
   if pat.id is not null and private.demo_reviewer(pat.site_id) is not null then
     insert into phi.encounters(site_id,patient_id,assigned_to) values(pat.site_id,pat.id,private.demo_reviewer(pat.site_id)) returning * into e;
     allowed:=true; result:=jsonb_build_object('id',e.id);
   end if;
 elsif p_action='queue' and staff then
   event_site:=p_id;
   if private.has_role(p_id,array['clinician','coordinator']) then
     allowed:=true;
     select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'patientId',t.patient_id,'name',coalesce(t.intake->>'name','Awaiting intake'),'age',t.intake->'age','status',t.status,'updatedAt',t.updated_at,'intake',t.intake,'aiAvailable',t.ai_version=t.version and t.ai is not null,'assignedTo',t.assigned_to) order by t.updated_at desc),'[]') into result from (select * from phi.encounters where site_id=p_id order by updated_at desc limit 100) t;
     select coalesce(array_agg((v->>'id')::uuid),'{}') into ids from jsonb_array_elements(result) v;
   end if;
 else
   if p_action='for_patient' and staff then select * into e from phi.encounters where patient_id=p_id order by created_at desc limit 1;
   else select * into e from phi.encounters where id=p_id for update; end if;
   if e.id is not null then
     clinician:=staff and private.has_role(e.site_id,array['clinician']);
     staff:=staff and private.has_role(e.site_id,array['clinician','coordinator']);
     if p_action in('get','for_patient') then allowed:=true; result:=private.demo_view(e,staff,clinician);
     elsif p_action='handoff' and staff and e.status<>'reviewed' then
       token:=encode(extensions.gen_random_bytes(32),'hex');
       update phi.encounters set cap_hash=encode(extensions.digest(token,'sha256'),'hex'),cap_expires=now()+interval '2 hours' where id=e.id;
       allowed:=true;result:=jsonb_build_object('id',e.id,'token',token);
     elsif p_action='consent' and not staff and p_payload->>'noticeVersion'='synthetic-demo-notice-v1' and p_payload->>'accepted'='true' and e.status='awaiting_consent' then
       update phi.encounters set consent_at=now(),notice_version=p_payload->>'noticeVersion',status='intake',updated_at=now() where id=e.id returning * into e;
       allowed:=true;result:=private.demo_view(e,false,false);
     elsif p_action='reset' and not staff then
       -- RLS permits the authenticated capability for the write; expire after the statement through a staff-independent policy below.
       update phi.encounters set cap_expires=now() where id=e.id; allowed:=true;result:='{}';
     elsif p_action='withdraw' and not staff then
       update phi.encounters set consent_at=null,status='review_needed',ai=null,ai_version=null,cap_expires=now() where id=e.id;
       update phi.demo_jobs set status='cancelled',lease=null where encounter_id=e.id and status in('queued','running');allowed:=true;result:='{}';
     elsif p_action='save' and not staff and e.consent_at is not null and e.status in('intake','review_needed') then
       requested_version:=(p_payload->>'version')::int;
       if requested_version=e.version and jsonb_typeof(p_payload->'intake')='object' and octet_length((p_payload->'intake')::text)<60000 then
         update phi.encounters set intake=p_payload->'intake',version=version+1,updated_at=now(),ai=null,ai_version=null,independent=null,independent_at=null,ai_revealed_at=null where id=e.id returning * into e;
         insert into phi.encounter_versions(encounter_id,site_id,version,intake,actor) values(e.id,e.site_id,e.version,e.intake,private.request_uid());
         allowed:=true;result:=private.demo_view(e,false,false);
       else err:='version_conflict';end if;
     elsif p_action='submit' and not staff and e.consent_at is not null and e.intake<>'{}'::jsonb and e.status in('intake','review_needed') then
       insert into phi.demo_jobs(encounter_id,site_id,source_version) values(e.id,e.site_id,e.version) on conflict(encounter_id,source_version) do nothing;
       update phi.encounters set status='queued',updated_at=now() where id=e.id returning * into e;
       allowed:=true;result:=private.demo_view(e,false,false);
     elsif p_action='reopen' and (staff or e.consent_at is not null) and e.status in('queued','review_needed') then
       update phi.demo_jobs set status='cancelled',lease=null where encounter_id=e.id and status in('queued','running');
       update phi.encounters set status='intake',version=version+1,ai=null,ai_version=null,independent=null,independent_at=null,ai_revealed_at=null,updated_at=now() where id=e.id returning * into e;
       allowed:=true;result:=private.demo_view(e,staff,clinician);
     elsif p_action='report_add' and e.consent_at is not null and e.status='intake' and not staff then
       if p_payload->>'mime' in('application/pdf','image/png','image/jpeg') and length(p_payload->>'body') between 16 and 7500000 and jsonb_typeof(p_payload->'fields')='array' and jsonb_array_length(p_payload->'fields')<=100 and (select count(*) from phi.demo_reports where encounter_id=e.id)<5 then
         insert into phi.demo_reports(encounter_id,site_id,name,mime,body,fields,quality) values(e.id,e.site_id,left(p_payload->>'name',120),p_payload->>'mime',p_payload->>'body',p_payload->'fields',left(p_payload->>'quality',200)) returning * into doc;
         update phi.encounters set version=version+1,updated_at=now() where id=e.id returning * into e;
         allowed:=true;result:=private.demo_view(e,false,false);
       end if;
     elsif p_action='report_verify' and e.consent_at is not null and e.status='intake' and not staff then
       if jsonb_typeof(p_payload->'fields')='array' and jsonb_array_length(p_payload->'fields')<=100 then
         update phi.demo_reports set fields=p_payload->'fields',verified_at=now(),verifier=coalesce(e.intake->>'suppliedBy','patient') where id=(p_payload->>'reportId')::uuid and encounter_id=e.id returning * into doc;
         if doc.id is not null then update phi.encounters set version=version+1,updated_at=now() where id=e.id returning * into e;allowed:=true;result:=private.demo_view(e,false,false);end if;
       end if;
     elsif p_action='report_get' then
       select * into doc from phi.demo_reports where id=(p_payload->>'reportId')::uuid and encounter_id=e.id;
       if doc.id is not null then allowed:=true;result:=jsonb_build_object('body',doc.body,'mime',doc.mime,'name',doc.name);end if;
     elsif p_action='independent' and clinician and e.consent_at is not null and e.status in('queued','review_needed') and e.independent_at is null then
       update phi.encounters set independent=p_payload->'review',independent_at=now(),reviewer_id=private.request_uid(),updated_at=now() where id=e.id returning * into e;
       allowed:=true;result:=private.demo_view(e,true,true);
     elsif p_action='reveal' and clinician and e.independent_at is not null then
       update phi.encounters set ai_revealed_at=coalesce(ai_revealed_at,now()) where id=e.id returning * into e;allowed:=true;result:=private.demo_view(e,true,true);
     elsif p_action='release' and clinician and e.independent_at is not null and e.consent_at is not null and e.status in('queued','review_needed') then
       update phi.encounters set release=jsonb_build_object('impression',p_payload->'review'->>'impression','specialty',p_payload->'review'->>'specialty','urgency',p_payload->'review'->>'urgency','plan',p_payload->'review'->>'plan','disagreement',p_payload->'review'->>'disagreement','reason',p_payload->'review'->>'reason','sourceVersion',e.version,'author','Demo clinician','synthetic',true),released_at=now(),reviewer_id=private.request_uid(),status='reviewed',updated_at=now() where id=e.id returning * into e;
       allowed:=true;result:=private.demo_view(e,true,true);
     elsif p_action='retry' and clinician and e.consent_at is not null and e.status<>'reviewed' then
       update phi.demo_jobs set status='queued',attempts=0,available_at=now(),lease=null,error_code=null where encounter_id=e.id and source_version=e.version and status='failed';
       allowed:=true;result:=private.demo_view(e,true,true);
     end if;
   end if;
 end if;
 if e.id is not null then event_site:=e.site_id;ids:=array[e.id];end if;
 role_name:=case when staff and private.has_role(event_site,array['clinician']) then 'clinician' when staff then 'coordinator' else null end;
 insert into audit.audit_events(actor_user_id,actor_role,site_id,purpose,action,resource_type,record_ids,outcome,request_id) values(private.request_uid(),role_name,event_site,case when staff then case when role_name='clinician' then 'direct_care' else 'intake_support' end else 'patient_encounter' end,'demo_'||case when p_action in('create','queue','get','for_patient','handoff','consent','reset','withdraw','save','submit','reopen','report_add','report_verify','report_get','independent','reveal','release','retry') then p_action else 'invalid' end,'encounter',case when allowed then ids else '{}'::uuid[] end,case when allowed then 'allowed' else 'denied_or_not_found' end,rid);
 return jsonb_build_object('ok',allowed,'data',case when allowed then result else null end,'error',case when allowed then null else err end,'requestId',rid);
end $$;
alter function api.demo_action(text,uuid,text,jsonb) owner to gi_demo_executor;
grant execute on function api.demo_action(text,uuid,text,jsonb) to anon,authenticated;

-- Reset/withdraw must be able to invalidate their own capability without making the new row fail WITH CHECK.
alter policy demo_encounters on phi.encounters with check((private.session_ok() and private.has_role(site_id,array['clinician','coordinator'])) or (length(current_setting('gi.demo_token',true))=64 and cap_hash=encode(extensions.digest(current_setting('gi.demo_token',true),'sha256'),'hex')));

create function api.demo_worker(p_action text,p_id uuid default null,p_lease uuid default null,p_result jsonb default null,p_error text default null) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare j phi.demo_jobs;e phi.encounters;result jsonb;allowed boolean:=false;rid uuid:=gen_random_uuid();begin
 if p_action='claim' then
   select * into j from phi.demo_jobs where (status='queued' and available_at<=now()) or (status='running' and lease_until<now()) order by created_at for update skip locked limit 1;
   if j.id is null then return jsonb_build_object('ok',true,'data',null);end if;
   select * into e from phi.encounters where id=j.encounter_id for update;
   if e.consent_at is null or e.version<>j.source_version or j.attempts>=3 then
     update phi.demo_jobs set status=case when j.attempts>=3 then 'failed' else 'cancelled' end,error_code='stale_or_expired',lease=null where id=j.id;
   else
     update phi.demo_jobs set status='running',attempts=attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '90 seconds' where id=j.id returning * into j;
     result:=jsonb_build_object('id',j.id,'lease',j.lease,'encounterId',e.id,'version',e.version,'intake',e.intake,'contentVersion',e.content_version,'reports',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'fields',r.fields)) from phi.demo_reports r where r.encounter_id=e.id),'[]'));allowed:=true;
   end if;
 else
   select * into j from phi.demo_jobs where id=p_id for update;
   if j.id is not null then select * into e from phi.encounters where id=j.encounter_id for update;end if;
   if j.status='running' and j.lease=p_lease and j.lease_until>now() and e.consent_at is not null and e.version=j.source_version then
     if p_action='heartbeat' then update phi.demo_jobs set lease_until=now()+interval '90 seconds' where id=j.id;allowed:=true;
     elsif p_action='complete' and jsonb_typeof(p_result)='object' and octet_length(p_result::text)<50000 then
       update phi.demo_jobs set status='completed',result=p_result,lease=null where id=j.id;
       update phi.encounters set ai=p_result,ai_version=j.source_version,ai_created_at=now(),status=case when status='reviewed' then status else 'review_needed' end,updated_at=now() where id=e.id;allowed:=true;
     elsif p_action='fail' then
       update phi.demo_jobs set status='failed',error_code=case when p_error in('model_unavailable','context_limit','invalid_output','unsupported_evidence','output_boundary','extraction_required','timeout') then p_error else 'analysis_unavailable' end,lease=null where id=j.id;
       update phi.encounters set status=case when status='reviewed' then status else 'review_needed' end where id=e.id;allowed:=true;
     end if;
   end if;
 end if;
 insert into audit.audit_events(actor_role,site_id,purpose,action,resource_type,record_ids,outcome,request_id) values(null,e.site_id,'ai_processing','demo_worker_'||case when p_action in('claim','heartbeat','complete','fail') then p_action else 'invalid' end,'encounter',case when e.id is not null then array[e.id] else '{}'::uuid[] end,case when allowed then 'allowed' else 'denied_or_not_found' end,rid);
 return jsonb_build_object('ok',allowed,'data',result,'requestId',rid);
end $$;
alter function api.demo_worker(text,uuid,uuid,jsonb,text) owner to gi_demo_worker;
grant usage on schema api to service_role;
grant execute on function api.demo_worker(text,uuid,uuid,jsonb,text) to service_role;
revoke all on function api.demo_worker(text,uuid,uuid,jsonb,text) from public,anon,authenticated;
revoke execute on function private.demo_access(uuid,text,timestamptz),private.demo_reviewer(uuid),private.demo_view(phi.encounters,boolean,boolean) from public,anon,authenticated,service_role;
revoke create on schema api,private from gi_demo_executor,gi_demo_worker;
revoke create on schema private from gi_policy_reader;
notify pgrst,'reload schema';
