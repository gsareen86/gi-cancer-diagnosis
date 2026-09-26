-- Durable model extraction, staff-owned verification, and source-version safety.
alter table phi.demo_reports add column extraction_status text not null default 'queued' check(extraction_status in('queued','running','completed','failed','cancelled'));
alter table phi.demo_reports add column extraction_lease uuid;
alter table phi.demo_reports add column extraction_until timestamptz;
alter table phi.demo_reports add column extraction_attempts int not null default 0;
alter table phi.demo_reports add column extraction_error text;
alter table phi.demo_reports add column extraction_metadata jsonb;
alter table phi.demo_reports add column deleted_at timestamptz;
update phi.demo_reports set extraction_status='completed' where fields<>'[]'::jsonb;
create table phi.report_revisions(id uuid primary key default gen_random_uuid(),report_id uuid not null references phi.demo_reports(id),encounter_id uuid not null,site_id uuid not null,previous_fields jsonb not null,fields jsonb not null,actor uuid,created_at timestamptz not null default now());
alter table phi.report_revisions enable row level security;
alter table phi.report_revisions force row level security;
revoke all on phi.report_revisions from public,anon,authenticated,service_role;
grant insert on phi.report_revisions to gi_demo_executor,gi_demo_worker;
create policy revision_insert on phi.report_revisions for insert to gi_demo_executor,gi_demo_worker with check(exists(select 1 from phi.demo_reports r where r.id=report_id and r.site_id=report_revisions.site_id));
create trigger report_revisions_immutable before update or delete or truncate on phi.report_revisions for each statement execute function private.no_audit_mutation();
create function private.report_revision() returns trigger language plpgsql set search_path='' as $$ begin
 if tg_op='INSERT' then new.fields:='[]';new.verified_at:=null;new.verifier:=null;
 elsif new.fields is distinct from old.fields then
   insert into phi.report_revisions(report_id,encounter_id,site_id,previous_fields,fields,actor) values(new.id,new.encounter_id,new.site_id,old.fields,new.fields,private.request_uid());
 end if;return new;
end $$;
revoke all on function private.report_revision() from public,anon,authenticated,service_role;
grant execute on function private.report_revision(),private.request_uid() to gi_demo_worker,gi_demo_executor;
create trigger report_revision before insert or update on phi.demo_reports for each row execute function private.report_revision();
grant update on phi.demo_reports to gi_demo_worker;
create policy report_worker_update on phi.demo_reports for update to gi_demo_worker using(true) with check(true);

do $$ declare d text;old_fragment text; begin
 select pg_get_functiondef('private.demo_view(phi.encounters,boolean,boolean)'::regprocedure) into d;
 d:=replace(d,'''verifier'',r.verifier)', '''verifier'',r.verifier,''extractionStatus'',r.extraction_status)');
 d:=replace(d,'where r.encounter_id=e.id','where r.encounter_id=e.id and r.deleted_at is null');
 d:=replace(d,'''aiCreatedAt'',e.ai_created_at', '''aiUrgency'',case when e.ai_version=e.version then e.ai->>''urgency'' else null end,''aiCreatedAt'',e.ai_created_at');execute d;
 select pg_get_functiondef('private.demo_job_snapshot()'::regprocedure) into d;
 d:=replace(d,'where r.encounter_id=e.id','where r.encounter_id=e.id and r.deleted_at is null');execute d;
 select pg_get_functiondef('private.demo_validate_encounter()'::regprocedure) into d;
 d:=replace(d,'''Female'',''Male'',''Other''','''Female'',''Male'',''Intersex'',''Other''');execute d;
 select pg_get_functiondef('api.demo_action(text,uuid,text,jsonb)'::regprocedure) into d;
 d:=replace(d,'''assignedTo'',t.assigned_to,','''assignedTo'',t.assigned_to,''createdAt'',t.created_at,''reportCount'',(select count(*) from phi.demo_reports r where r.encounter_id=t.id and r.deleted_at is null),''unverifiedReports'',(select count(*) from phi.demo_reports r where r.encounter_id=t.id and r.deleted_at is null and r.verified_at is null),''aiUrgency'',case when t.ai_version=t.version then t.ai->>''urgency'' else null end,');
 old_fragment:='elsif p_action=''report_verify'' and e.consent_at is not null and e.status=''intake'' and not staff then';
 if position(old_fragment in d)=0 then raise exception 'Report verification boundary not found';end if;
 d:=replace(d,old_fragment,'elsif p_action=''report_verify'' and staff and e.consent_at is not null and e.status<>''reviewed'' and p_payload->>''sourceVersion''=e.version::text then');
 d:=replace(d,'verifier=coalesce(e.intake->>''suppliedBy'',''patient'')','verifier=private.request_uid()::text');
 d:=replace(d,'where id=(p_payload->>''reportId'')::uuid and encounter_id=e.id returning * into doc','where id=(p_payload->>''reportId'')::uuid and encounter_id=e.id and deleted_at is null and extraction_status<>''running'' returning * into doc');
 old_fragment:='if doc.id is not null then update phi.encounters set version=version+1,updated_at=now() where id=e.id returning * into e;allowed:=true;result:=private.demo_view(e,false,false);end if;';
 if position(old_fragment in d)=0 then raise exception 'Report source update boundary not found';end if;
 d:=replace(d,old_fragment,$replacement$if doc.id is not null then
  update phi.demo_jobs set status='cancelled',lease=null where encounter_id=e.id and status in('queued','running');
  update phi.encounters set version=version+1,updated_at=now(),ai=null,ai_version=null,independent=null,independent_at=null,ai_revealed_at=null,clinician_draft=null,final_review=null where id=e.id returning * into e;
  if e.status in('queued','review_needed') then insert into phi.demo_jobs(encounter_id,site_id,source_version) values(e.id,e.site_id,e.version);end if;
  allowed:=true;result:=private.demo_view(e,staff,clinician);
 end if;$replacement$);
 d:=replace(d,'elsif p_action=''report_get'' then',$replacement$elsif p_action='report_remove' and not staff and e.status='intake' and e.consent_at is not null then
  update phi.demo_reports set deleted_at=now(),extraction_status='cancelled',extraction_lease=null where id=(p_payload->>'reportId')::uuid and encounter_id=e.id and deleted_at is null returning * into doc;
  if doc.id is not null then update phi.encounters set version=version+1,updated_at=now() where id=e.id returning * into e;allowed:=true;result:=private.demo_view(e,false,false);end if;
 elsif p_action='report_get' then$replacement$);
 d:=replace(d,'where id=(p_payload->>''reportId'')::uuid and encounter_id=e.id;', 'where id=(p_payload->>''reportId'')::uuid and encounter_id=e.id and deleted_at is null;');
 d:=replace(d,'(select count(*) from phi.demo_reports where encounter_id=e.id)<5','(select count(*) from phi.demo_reports where encounter_id=e.id and deleted_at is null)<5');
 d:=replace(d,'''author'',''Demo clinician'',''synthetic'',true','''author'',''Treating clinician'',''investigations'',coalesce(p_payload->''review''->''investigations'',''[]''::jsonb),''followUp'',p_payload->''review''->>''followUp'',''urgencyReason'',p_payload->''review''->>''urgencyReason''');
 d:=replace(d,'''report_get'',''message''','''report_get'',''report_remove'',''message''');execute d;
end $$;

grant create on schema api to gi_demo_worker;
create function api.report_worker(p_action text,p_id uuid default null,p_lease uuid default null,p_result jsonb default null,p_error text default null) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r phi.demo_reports;e phi.encounters;result jsonb;allowed boolean:=false; begin
 if p_action='claim' then
  select d.* into r from phi.demo_reports d join phi.encounters e on e.id=d.encounter_id where d.deleted_at is null and e.consent_at is not null and e.released_at is null and (d.extraction_status='queued' or (d.extraction_status='running' and d.extraction_until<now())) and d.extraction_attempts<3 order by d.created_at for update of d skip locked limit 1;
  if r.id is null then return jsonb_build_object('ok',true,'data',null);end if;
  update phi.demo_reports set extraction_status='running',extraction_attempts=extraction_attempts+1,extraction_lease=gen_random_uuid(),extraction_until=now()+interval '90 seconds' where id=r.id returning * into r;
  allowed:=true;result:=jsonb_build_object('id',r.id,'lease',r.extraction_lease,'body',r.body,'mime',r.mime);
 else
  select * into r from phi.demo_reports where id=p_id for update;
  select * into e from phi.encounters where id=r.encounter_id;
  if r.extraction_status='running' and r.extraction_lease=p_lease and r.extraction_until>now() and r.deleted_at is null and e.consent_at is not null and e.released_at is null then
   if p_action='heartbeat' then update phi.demo_reports set extraction_until=now()+interval '90 seconds' where id=r.id;allowed:=true;
   elsif p_action='complete' and jsonb_typeof(p_result->'fields')='array' and jsonb_array_length(p_result->'fields')<=100 then
    update phi.demo_reports set fields=coalesce((select jsonb_agg(f||'{"verified":false}'::jsonb) from jsonb_array_elements(p_result->'fields') f),'[]'),quality=left(p_result->>'quality',200),extraction_status='completed',extraction_lease=null,extraction_metadata=p_result-'fields'-'quality' where id=r.id;allowed:=true;
   elsif p_action='fail' then
    update phi.demo_reports set extraction_status='failed',extraction_lease=null,extraction_error=case when p_error in('vision_unavailable','context_limit','model_unavailable','provider_not_configured','provider_auth_failed','output_truncated','report_findings_limit') then p_error else 'extraction_unavailable' end,quality='Automatic extraction could not finish. Staff can inspect the original and add findings.' where id=r.id;allowed:=true;
   end if;
  end if;
 end if;
 insert into audit.audit_events(site_id,purpose,action,resource_type,record_ids,outcome,request_id) values(r.site_id,'ai_processing','demo_report_worker_'||case when p_action in('claim','heartbeat','complete','fail') then p_action else 'invalid' end,'encounter',case when r.encounter_id is null then '{}'::uuid[] else array[r.encounter_id] end,case when allowed then 'allowed' else 'denied_or_not_found' end,gen_random_uuid());
 return jsonb_build_object('ok',allowed,'data',result);
end $$;
alter function api.report_worker(text,uuid,uuid,jsonb,text) owner to gi_demo_worker;
revoke all on function api.report_worker(text,uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function api.report_worker(text,uuid,uuid,jsonb,text) to service_role;
revoke create on schema api from gi_demo_worker;
notify pgrst,'reload schema';
