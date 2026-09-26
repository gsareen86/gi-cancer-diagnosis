-- Processing metadata contains counts/codes only; reports remain source proposals until staff verification.
do $$ declare definition text; old_fragment text; begin
 select pg_get_functiondef('private.demo_view(phi.encounters,boolean,boolean)'::regprocedure) into definition;
 old_fragment:='''extractionStatus'',r.extraction_status)';
 if position(old_fragment in definition)=0 then raise exception 'Report status projection missing';end if;
 definition:=replace(definition,old_fragment,$replacement$'extractionStatus',r.extraction_status,'extractionError',r.extraction_error,'extractionAttempts',r.extraction_attempts,'extractionUntil',r.extraction_until,'extractionProgress',jsonb_build_object('pagesDone',r.extraction_metadata->'pagesDone','totalPages',r.extraction_metadata->'totalPages'))$replacement$);
 execute definition;

 select pg_get_functiondef('api.demo_action(text,uuid,text,jsonb)'::regprocedure) into definition;
 old_fragment:='elsif p_action=''report_get'' then';
 if position(old_fragment in definition)=0 then raise exception 'Report action boundary missing';end if;
 definition:=replace(definition,old_fragment,$replacement$elsif p_action='report_retry' and staff and e.consent_at is not null and e.released_at is null and e.status<>'reviewed' then
  update phi.demo_reports set extraction_status='queued',extraction_lease=null,extraction_until=null,
   extraction_error=null,extraction_attempts=0,extraction_metadata=null,quality='Waiting for automatic extraction.'
  where id=(p_payload->>'reportId')::uuid and encounter_id=e.id and deleted_at is null
   and verified_at is null and fields='[]'::jsonb
   and (extraction_status='failed' or (extraction_status='running' and extraction_until<now()))
  returning * into doc;
  if doc.id is not null then allowed:=true;result:=private.demo_view(e,staff,clinician);end if;
 elsif p_action='report_get' then$replacement$);
 old_fragment:='''report_get'',''draft''';
 if position(old_fragment in definition)=0 then raise exception 'Report audit action boundary missing';end if;
 definition:=replace(definition,old_fragment,'''report_get'',''report_remove'',''report_retry'',''message'',''review_partial'',''draft''');
 execute definition;

 select pg_get_functiondef('api.report_worker(text,uuid,uuid,jsonb,text)'::regprocedure) into definition;
 old_fragment:='if p_action=''heartbeat'' then update phi.demo_reports set extraction_until=now()+interval ''90 seconds'' where id=r.id;allowed:=true;';
 if position(old_fragment in definition)=0 then raise exception 'Report heartbeat boundary missing';end if;
 definition:=replace(definition,old_fragment,$replacement$if p_action='heartbeat' then
    update phi.demo_reports set extraction_until=now()+interval '90 seconds',
     extraction_metadata=case when coalesce(p_result->>'pagesDone','') ~ '^[0-9]{1,2}$'
      and coalesce(p_result->>'totalPages','') ~ '^([1-9]|[12][0-9]|30)$'
      and (p_result->>'pagesDone')::int <= (p_result->>'totalPages')::int
      then coalesce(extraction_metadata,'{}'::jsonb)||jsonb_build_object('pagesDone',(p_result->>'pagesDone')::int,'totalPages',(p_result->>'totalPages')::int)
      else extraction_metadata end
     where id=r.id;allowed:=true;$replacement$);
 old_fragment:='''output_truncated'',''report_findings_limit''';
 if position(old_fragment in definition)=0 then raise exception 'Report failure code boundary missing';end if;
 definition:=replace(definition,old_fragment,'''output_truncated'',''report_findings_limit'',''provider_rate_limited'',''provider_refused'',''provider_residency_unverified'',''invalid_output''');
 execute definition;
end $$;
notify pgrst,'reload schema';
