-- Freeze actual input evidence at enqueue, so later verification cannot rewrite
-- the sources of an older AI assessment.
alter table phi.demo_jobs add column snapshot jsonb not null default '{}';
update phi.demo_jobs j set snapshot=jsonb_build_object('intake',e.intake,'version',j.source_version,'contentVersion',e.content_version,'reports',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'fields',r.fields)) from phi.demo_reports r where r.encounter_id=e.id),'[]')) from phi.encounters e where e.id=j.encounter_id;
create function private.demo_job_snapshot() returns trigger language plpgsql set search_path='' as $$
declare e phi.encounters;begin
 if tg_op='UPDATE' then
  if new.snapshot is distinct from old.snapshot or new.source_version<>old.source_version or new.encounter_id<>old.encounter_id or new.site_id<>old.site_id then raise exception 'Job source is immutable';end if;
 else
  select * into e from phi.encounters where id=new.encounter_id and site_id=new.site_id;
  if e.consent_at is null or new.source_version<>e.version then raise exception 'Consented current source required';end if;
  new.snapshot:=jsonb_build_object('intake',e.intake,'version',new.source_version,'contentVersion',e.content_version,'reports',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'fields',r.fields)) from phi.demo_reports r where r.encounter_id=e.id),'[]'));
 end if;
 return new;
end $$;
revoke all on function private.demo_job_snapshot() from public,anon,authenticated,service_role;
grant execute on function private.demo_job_snapshot() to gi_demo_executor,gi_demo_worker;
create trigger job_snapshot before insert or update on phi.demo_jobs for each row execute function private.demo_job_snapshot();
do $$ declare definition text;begin
 select pg_get_functiondef('api.demo_worker(text,uuid,uuid,jsonb,text)'::regprocedure) into definition;
 definition:=replace(definition,'e.consent_at is null or e.version<>j.source_version or j.attempts>=3','e.consent_at is null or e.version<>j.source_version or e.released_at is not null or j.attempts>=3');
 definition:=replace(definition,E'result:=jsonb_build_object(''id'',j.id,''lease'',j.lease,''encounterId'',e.id,''version'',e.version,''intake'',e.intake,''contentVersion'',e.content_version,''reports'',coalesce((select jsonb_agg(jsonb_build_object(''id'',r.id,''fields'',r.fields)) from phi.demo_reports r where r.encounter_id=e.id),''[]''));',E'result:=j.snapshot||jsonb_build_object(''id'',j.id,''lease'',j.lease,''encounterId'',e.id);');
 definition:=replace(definition,'e.consent_at is not null and e.version=j.source_version then','e.consent_at is not null and e.version=j.source_version and e.released_at is null then');
 execute definition;
 select pg_get_functiondef('api.demo_action(text,uuid,text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,E'allowed:=true;result:=private.demo_view(e,true,true);\n     elsif p_action=''retry''',E'update phi.demo_jobs set status=''cancelled'',lease=null where encounter_id=e.id and status in(''queued'',''running'');\n       allowed:=true;result:=private.demo_view(e,true,true);\n     elsif p_action=''retry''');
 execute definition;
end $$;
notify pgrst,'reload schema';
