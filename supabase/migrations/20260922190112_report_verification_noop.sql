-- Unchanged evidence must not invalidate a clinician's work or enqueue a new assessment.
do $$ declare definition text; old_fragment text; begin
 select pg_get_functiondef('api.demo_action(text,uuid,text,jsonb)'::regprocedure) into definition;
 old_fragment:='elsif p_action=''report_verify'' and staff and e.consent_at is not null and e.status<>''reviewed'' and p_payload->>''sourceVersion''=e.version::text then';
 if position(old_fragment in definition)=0 then raise exception 'Report verification boundary missing';end if;
 definition:=replace(definition,old_fragment,$replacement$elsif p_action='report_verify' and staff and e.consent_at is not null and e.status<>'reviewed' and p_payload->>'sourceVersion'=e.version::text
  and exists(select 1 from phi.demo_reports r where r.id=(p_payload->>'reportId')::uuid and r.encounter_id=e.id and r.deleted_at is null
   and r.extraction_status not in('queued','running') and r.fields=p_payload->'fields') then
  allowed:=true;result:=private.demo_view(e,staff,clinician);
 $replacement$||old_fragment);
 old_fragment:='and extraction_status<>''running'' returning * into doc';
 if position(old_fragment in definition)=0 then raise exception 'Active extraction verification guard missing';end if;
 definition:=replace(definition,old_fragment,'and extraction_status not in(''queued'',''running'') returning * into doc');
 execute definition;
end $$;
notify pgrst,'reload schema';
