-- Bound abandoned report leases, permit targeted processing and serialize consent checks.
do $$ declare definition text; old_fragment text; begin
 select pg_get_functiondef('api.report_worker(text,uuid,uuid,jsonb,text)'::regprocedure) into definition;
 old_fragment:='if p_action=''claim'' then';
 if position(old_fragment in definition)=0 then raise exception 'Report claim boundary missing';end if;
 definition:=replace(definition,old_fragment,$replacement$if p_action='claim' then
  with expired as (
   update phi.demo_reports set extraction_status='failed',extraction_lease=null,
    extraction_error='attempts_exhausted',quality='Automatic extraction could not finish. Staff can inspect the original and add findings.'
   where extraction_status='running' and extraction_until<now() and extraction_attempts>=3
   returning site_id,encounter_id
  ) insert into audit.audit_events(site_id,purpose,action,resource_type,record_ids,outcome,request_id)
   select site_id,'ai_processing','demo_report_worker_expired','encounter',array[encounter_id],'allowed',gen_random_uuid() from expired;
 $replacement$);
 definition:=replace(definition,'where d.deleted_at is null and visit.consent_at is not null','where (p_id is null or d.id=p_id) and d.deleted_at is null and visit.consent_at is not null');
 old_fragment:='select * into r from phi.demo_reports where id=p_id for update;
  select * into e from phi.encounters where id=r.encounter_id;';
 if position(old_fragment in definition)=0 then raise exception 'Report completion lock boundary missing';end if;
 definition:=replace(definition,old_fragment,$replacement$select * into e from phi.encounters where id=(select encounter_id from phi.demo_reports where id=p_id) for update;
  select * into r from phi.demo_reports where id=p_id for update;$replacement$);
 execute definition;
 select pg_get_functiondef('api.demo_action(text,uuid,text,jsonb)'::regprocedure) into definition;
 old_fragment:='fields=p_payload->''fields'',verified_at=now()';
 if position(old_fragment in definition)=0 then raise exception 'Report verification boundary missing';end if;
 definition:=replace(definition,old_fragment,$replacement$fields=p_payload->'fields',verified_at=case when exists(select 1 from jsonb_array_elements(p_payload->'fields') f where f->>'verified'='true' and coalesce(f->>'rejected','false')<>'true') then now() else null end$replacement$);
 execute definition;
end $$;
notify pgrst,'reload schema';
