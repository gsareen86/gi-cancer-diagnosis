-- Automatic report evidence. Existing history, consent, RLS and urgency triggers remain.
-- All worker mutations lock encounter -> report/job, matching clinician actions.
alter table phi.encounters add column draft_source_version int;
update phi.encounters set draft_source_version=version where clinician_draft is not null;
grant insert on phi.demo_jobs to gi_demo_worker;

create function private.report_fields_valid(items jsonb) returns boolean language sql immutable set search_path='' as $$
 select case when jsonb_typeof(items)='array' then jsonb_array_length(items)<=100
  and (select count(*)=count(distinct f->>'id') from jsonb_array_elements(items) f)
  and not exists(select 1 from jsonb_array_elements(items) f where
   jsonb_typeof(f) is distinct from 'object'
   or jsonb_typeof(f->'id') is distinct from 'string' or length(coalesce(f->>'id','')) not between 1 and 100
   or jsonb_typeof(f->'label') is distinct from 'string' or length(coalesce(f->>'label','')) not between 1 and 120
   or jsonb_typeof(f->'value') is distinct from 'string' or length(coalesce(f->>'value','')) not between 1 and 500
   or jsonb_typeof(f->'unit') is distinct from 'string' or length(coalesce(f->>'unit',''))>30
   or jsonb_typeof(f->'date') is distinct from 'string' or length(coalesce(f->>'date',''))>30
   or jsonb_typeof(f->'sourceText') is distinct from 'string' or length(coalesce(f->>'sourceText','')) not between 1 and 2000
   or not(case when jsonb_typeof(f->'page')='number' then (f->>'page')::numeric between 1 and 30 and (f->>'page')::numeric=trunc((f->>'page')::numeric) else false end)
   or coalesce(f->>'confidence','') not in('text-extracted','vision-extracted','manual-transcription')
   or jsonb_typeof(f->'verified') is distinct from 'boolean'
   or (f ? 'rejected' and jsonb_typeof(f->'rejected') is distinct from 'boolean')
   or (f ? 'referenceRange' and (jsonb_typeof(f->'referenceRange') is distinct from 'string' or length(f->>'referenceRange')>200))
   or (f ? 'reportType' and (jsonb_typeof(f->'reportType') is distinct from 'string' or f->>'reportType' not in('blood-test','urine-test','stool-test','ultrasound','ct','mri','x-ray','endoscopy','pathology','other','unknown')))
  ) else false end;
$$;
revoke all on function private.report_fields_valid(jsonb) from public,anon,authenticated,service_role;
grant execute on function private.report_fields_valid(jsonb) to gi_demo_worker,gi_demo_executor;

create or replace function private.demo_job_snapshot() returns trigger language plpgsql set search_path='' as $$
declare e phi.encounters;begin
 if tg_op='UPDATE' then
  if new.snapshot is distinct from old.snapshot or new.source_version<>old.source_version or new.encounter_id<>old.encounter_id or new.site_id<>old.site_id then raise exception 'Job source is immutable';end if;
 else
  select * into e from phi.encounters where id=new.encounter_id and site_id=new.site_id;
  if e.consent_at is null or new.source_version<>e.version then raise exception 'Consented current source required';end if;
  new.snapshot:=jsonb_build_object('synthetic',e.synthetic,'intake',e.intake,'version',new.source_version,'contentVersion',e.content_version,'reports',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'mime',r.mime,'fields',r.fields,'extractionStatus',r.extraction_status,'extractionMetadata',r.extraction_metadata) order by r.created_at,r.id) from phi.demo_reports r where r.encounter_id=e.id and r.deleted_at is null),'[]'));
 end if;return new;
end $$;

create function private.report_evidence_changed(p_encounter uuid) returns void language plpgsql set search_path='' as $$
declare e phi.encounters; enqueue boolean;begin
 select * into e from phi.encounters where id=p_encounter for update;
 -- Intake submission freezes current reports under this same lock. Do not conflict with
 -- an actively edited questionnaire just because extraction finished in the background.
 if e.consent_at is null or e.released_at is not null or e.status not in('queued','review_needed') then return;end if;
 -- Explicit partial-intake review has no assessment job and must remain human-only.
 enqueue:=exists(select 1 from phi.demo_jobs where encounter_id=e.id);
 update phi.demo_jobs set status='cancelled',lease=null where encounter_id=e.id and status in('queued','running');
 update phi.encounters set version=version+1,updated_at=now(),ai=null,ai_version=null,ai_created_at=null,
  clinician_draft=coalesce(clinician_draft,independent),
  draft_source_version=case when clinician_draft is not null then coalesce(draft_source_version,version) when independent is not null then version else null end,
  independent=null,independent_at=null,ai_revealed_at=null,final_review=null
 where id=e.id returning * into e;
 if enqueue then insert into phi.demo_jobs(encounter_id,site_id,source_version) values(e.id,e.site_id,e.version);end if;
end $$;
revoke all on function private.report_evidence_changed(uuid) from public,anon,authenticated,service_role;
grant execute on function private.report_evidence_changed(uuid) to gi_demo_worker,gi_demo_executor;

-- A changed or newly added staff field is manual, never relabelled as machine extraction.
create function private.corrected_report_fields(previous jsonb,supplied jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(case when exists(select 1 from jsonb_array_elements(previous) old where old->>'id'=item->>'id' and old-'verified'-'rejected'=item-'verified'-'rejected') then item else item||'{"confidence":"manual-transcription"}'::jsonb end order by ordinal),'[]'::jsonb)
 from jsonb_array_elements(supplied) with ordinality as fields(item,ordinal);
$$;
revoke all on function private.corrected_report_fields(jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.corrected_report_fields(jsonb,jsonb) to gi_demo_executor;

-- Guard each patch; never silently apply to an unexpected earlier definition.
do $$ declare d text; old_fragment text;begin
 select pg_get_functiondef('private.demo_view(phi.encounters,boolean,boolean)'::regprocedure) into d;
 old_fragment:='''canReview'',p_clinician';
 if position(old_fragment in d)=0 then raise exception 'Encounter projection boundary missing';end if;
 d:=replace(d,old_fragment,'''canReview'',p_clinician,''draftSourceVersion'',e.draft_source_version,''synthetic'',e.synthetic,''aiPromptVersion'',e.ai->>''promptVersion''');execute d;
 select pg_get_functiondef('api.demo_action(text,uuid,text,jsonb)'::regprocedure) into d;
 old_fragment:='''aiUrgency'',case when t.ai_version=t.version then t.ai->>''urgency'' else null end,';
 if position(old_fragment in d)=0 then raise exception 'Queue AI provenance boundary missing';end if;
 d:=replace(d,old_fragment,'''aiPromptVersion'',t.ai->>''promptVersion'','||old_fragment);
 old_fragment:='elsif p_action=''report_verify'' and staff and e.consent_at is not null and e.status<>''reviewed'' and p_payload->>''sourceVersion''=e.version::text';
 if position(old_fragment in d)=0 then raise exception 'Report field validation boundary missing';end if;
 d:=replace(d,old_fragment,old_fragment||' and private.report_fields_valid(p_payload->''fields'')');
 old_fragment:='clinician_draft=p_payload->''review''';
 if position(old_fragment in d)=0 then raise exception 'Draft source boundary missing';end if;
 d:=replace(d,old_fragment,'clinician_draft=p_payload->''review'',draft_source_version=e.version');
 old_fragment:='fields=p_payload->''fields'',verified_at=';
 if position(old_fragment in d)=0 then raise exception 'Report correction boundary missing';end if;
 d:=replace(d,old_fragment,'fields=private.corrected_report_fields(fields,p_payload->''fields''),verified_at=');
 old_fragment:=$old$update phi.demo_jobs set status='cancelled',lease=null where encounter_id=e.id and status in('queued','running');
  update phi.encounters set version=version+1,updated_at=now(),ai=null,ai_version=null,independent=null,independent_at=null,ai_revealed_at=null,clinician_draft=null,final_review=null where id=e.id returning * into e;
  if e.status in('queued','review_needed') then insert into phi.demo_jobs(encounter_id,site_id,source_version) values(e.id,e.site_id,e.version);end if;$old$;
 if position(old_fragment in d)=0 then raise exception 'Report correction source invalidation boundary missing';end if;
 d:=replace(d,old_fragment,$new$if e.status='intake' then
   update phi.encounters set version=version+1,updated_at=now() where id=e.id;
  else perform private.report_evidence_changed(e.id);end if;
  select * into e from phi.encounters where id=e.id;$new$);
 old_fragment:='elsif p_action=''retry'' and clinician';
 if position(old_fragment in d)=0 then raise exception 'AI refresh boundary missing';end if;
 d:=replace(d,old_fragment,$replace$elsif p_action='refresh_ai' and clinician and e.consent_at is not null and e.released_at is null and e.status in('queued','review_needed') and p_payload->>'sourceVersion'=e.version::text then
  perform private.report_evidence_changed(e.id);
  select * into e from phi.encounters where id=e.id;
  allowed:=true;result:=private.demo_view(e,staff,clinician);
 $replace$||old_fragment);
 old_fragment:='''release'',''retry''';
 if position(old_fragment in d)=0 then raise exception 'AI refresh audit boundary missing';end if;
 d:=replace(d,old_fragment,'''release'',''refresh_ai'',''retry''');execute d;
end $$;

create or replace function api.report_worker(p_action text,p_id uuid default null,p_lease uuid default null,p_result jsonb default null,p_error text default null) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r phi.demo_reports;e phi.encounters;expired record;result jsonb;allowed boolean:=false;begin
 if p_action='claim' then
  -- Reap exhausted leases even for a targeted claim, with consistent locking.
  for expired in select d.id,visit.id as encounter_id from phi.demo_reports d join phi.encounters visit on visit.id=d.encounter_id
   where d.extraction_status='running' and d.extraction_until<now() and d.extraction_attempts>=3
   order by d.created_at for update of visit skip locked limit 20 loop
   update phi.demo_reports set extraction_status='failed',extraction_lease=null,extraction_error='attempts_exhausted',quality='Processing could not finish. Report findings remain unavailable.' where id=expired.id;
   perform private.report_evidence_changed(expired.encounter_id);
   insert into audit.audit_events(site_id,purpose,action,resource_type,record_ids,outcome,request_id)
    select site_id,'ai_processing','demo_report_worker_expired','encounter',array[id],'allowed',gen_random_uuid() from phi.encounters where id=expired.encounter_id;
  end loop;
  select visit.* into e from phi.encounters visit join phi.demo_reports d on d.encounter_id=visit.id
   where (p_id is null or d.id=p_id) and d.deleted_at is null and visit.consent_at is not null and visit.released_at is null
    and (d.extraction_status='queued' or (d.extraction_status='running' and d.extraction_until<now())) and d.extraction_attempts<3
   order by d.created_at,d.id for update of visit skip locked limit 1;
  if e.id is null then return jsonb_build_object('ok',true,'data',null);end if;
  select * into r from phi.demo_reports d where d.encounter_id=e.id and (p_id is null or d.id=p_id) and d.deleted_at is null
   and (d.extraction_status='queued' or (d.extraction_status='running' and d.extraction_until<now())) and d.extraction_attempts<3
   order by d.created_at,d.id for update limit 1;
  update phi.demo_reports set extraction_status='running',extraction_attempts=extraction_attempts+1,extraction_lease=gen_random_uuid(),extraction_until=now()+interval '90 seconds' where id=r.id returning * into r;
  allowed:=true;result:=jsonb_build_object('id',r.id,'lease',r.extraction_lease,'body',r.body,'mime',r.mime,'synthetic',e.synthetic);
 else
  select * into e from phi.encounters where id=(select encounter_id from phi.demo_reports where id=p_id) for update;
  select * into r from phi.demo_reports where id=p_id for update;
  if r.extraction_status='running' and r.extraction_lease=p_lease and r.extraction_until>now() and r.deleted_at is null and e.consent_at is not null and e.released_at is null then
   if p_action='heartbeat' then
    update phi.demo_reports set extraction_until=now()+interval '90 seconds',extraction_metadata=case when coalesce(p_result->>'pagesDone','') ~ '^[0-9]{1,2}$' and coalesce(p_result->>'totalPages','') ~ '^([1-9]|[12][0-9]|30)$' and (p_result->>'pagesDone')::int<=(p_result->>'totalPages')::int then coalesce(extraction_metadata,'{}'::jsonb)||jsonb_build_object('pagesDone',(p_result->>'pagesDone')::int,'totalPages',(p_result->>'totalPages')::int) else extraction_metadata end where id=r.id;allowed:=true;
   elsif p_action='complete' and private.report_fields_valid(p_result->'fields')
    and jsonb_typeof(p_result->'quality')='string' and length(p_result->>'quality') between 1 and 200
    and not exists(select 1 from jsonb_array_elements(p_result->'fields') f where coalesce(f->>'confidence','') not in('text-extracted','vision-extracted') or coalesce(f->>'sourceText','')='' or coalesce(f->>'value','')='') then
    update phi.demo_reports set fields=coalesce((select jsonb_agg(f||'{"verified":false,"rejected":false}'::jsonb) from jsonb_array_elements(p_result->'fields') f),'[]'),quality=left(p_result->>'quality',200),extraction_status='completed',extraction_lease=null,extraction_error=null,extraction_metadata=p_result-'fields'-'quality' where id=r.id;
    perform private.report_evidence_changed(e.id);allowed:=true;
   elsif p_action='fail' then
    update phi.demo_reports set extraction_status='failed',extraction_lease=null,extraction_error=case when p_error in('vision_unavailable','context_limit','model_unavailable','provider_not_configured','provider_auth_failed','output_truncated','report_findings_limit','provider_rate_limited','provider_refused','provider_residency_unverified','invalid_output') then p_error else 'extraction_unavailable' end,quality='Automatic extraction could not finish. Findings remain unavailable; clinical review can continue.' where id=r.id;
    perform private.report_evidence_changed(e.id);allowed:=true;
   end if;
  end if;
 end if;
 insert into audit.audit_events(site_id,purpose,action,resource_type,record_ids,outcome,request_id) values(r.site_id,'ai_processing','demo_report_worker_'||case when p_action in('claim','heartbeat','complete','fail') then p_action else 'invalid' end,'encounter',case when r.encounter_id is null then '{}'::uuid[] else array[r.encounter_id] end,case when allowed then 'allowed' else 'denied_or_not_found' end,gen_random_uuid());
 return jsonb_build_object('ok',allowed,'data',result);
end $$;
alter function api.report_worker(text,uuid,uuid,jsonb,text) owner to gi_demo_worker;
revoke all on function api.report_worker(text,uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function api.report_worker(text,uuid,uuid,jsonb,text) to service_role;

create or replace function api.demo_worker(p_action text,p_id uuid default null,p_lease uuid default null,p_result jsonb default null,p_error text default null) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare j phi.demo_jobs;e phi.encounters;job_id uuid;result jsonb;allowed boolean:=false;rid uuid:=gen_random_uuid();begin
 if p_action='claim' then
  select jobs.id into job_id from phi.demo_jobs jobs join phi.encounters visit on visit.id=jobs.encounter_id
   where ((jobs.status='queued' and jobs.available_at<=now()) or (jobs.status='running' and jobs.lease_until<now()))
    and (p_id is null or jobs.id=p_id)
    and not exists(select 1 from phi.demo_reports r where r.encounter_id=visit.id and r.deleted_at is null and r.extraction_status in('queued','running'))
   order by jobs.created_at,jobs.id for update of visit skip locked limit 1;
  if job_id is null then return jsonb_build_object('ok',true,'data',null);end if;
  select * into j from phi.demo_jobs where id=job_id for update;
  select * into e from phi.encounters where id=j.encounter_id;
  if e.consent_at is null or e.version<>j.source_version or e.released_at is not null or j.attempts>=3 then
   update phi.demo_jobs set status=case when j.attempts>=3 then 'failed' else 'cancelled' end,error_code='stale_or_expired',lease=null where id=j.id;
  else
   update phi.demo_jobs set status='running',attempts=attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '90 seconds' where id=j.id returning * into j;
   result:=j.snapshot||jsonb_build_object('id',j.id,'lease',j.lease,'encounterId',e.id);allowed:=true;
  end if;
 else
  select * into e from phi.encounters where id=(select encounter_id from phi.demo_jobs where id=p_id) for update;
  select * into j from phi.demo_jobs where id=p_id for update;
  if j.status='running' and j.lease=p_lease and j.lease_until>now() and e.consent_at is not null and e.version=j.source_version and e.released_at is null
   and not exists(select 1 from phi.demo_reports r where r.encounter_id=e.id and r.deleted_at is null and r.extraction_status in('queued','running')) then
   if p_action='heartbeat' then update phi.demo_jobs set lease_until=now()+interval '90 seconds' where id=j.id;allowed:=true;
   elsif p_action='complete' and jsonb_typeof(p_result)='object' and octet_length(p_result::text)<500000 then
    update phi.demo_jobs set status='completed',result=p_result,lease=null where id=j.id;
    update phi.encounters set ai=p_result,ai_version=j.source_version,ai_created_at=now(),status='review_needed',updated_at=now() where id=e.id;allowed:=true;
   elsif p_action='fail' then
    update phi.demo_jobs set status=case when p_error in('model_unavailable','timeout','provider_rate_limited') and attempts<3 then 'queued' else 'failed' end,
     available_at=now()+make_interval(secs=>least(300,15*power(2,attempts)::int)),
     error_code=case when p_error in('model_unavailable','context_limit','invalid_output','unsupported_evidence','output_boundary','extraction_required','timeout','model_identity_mismatch','provider_auth_failed','provider_rate_limited','provider_not_configured','provider_residency_unverified','provider_refused','output_truncated','content_version_unavailable','vision_unavailable') then p_error else 'analysis_unavailable' end,lease=null where id=j.id;
    update phi.encounters set status='review_needed' where id=e.id;allowed:=true;
   end if;
  end if;
 end if;
 insert into audit.audit_events(actor_role,site_id,purpose,action,resource_type,record_ids,outcome,request_id) values(null,e.site_id,'ai_processing','demo_worker_'||case when p_action in('claim','heartbeat','complete','fail') then p_action else 'invalid' end,'encounter',case when e.id is not null then array[e.id] else '{}'::uuid[] end,case when allowed then 'allowed' else 'denied_or_not_found' end,rid);
 return jsonb_build_object('ok',allowed,'data',result,'requestId',rid);
end $$;
alter function api.demo_worker(text,uuid,uuid,jsonb,text) owner to gi_demo_worker;
revoke all on function api.demo_worker(text,uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function api.demo_worker(text,uuid,uuid,jsonb,text) to service_role;
notify pgrst,'reload schema';
