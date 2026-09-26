-- Encounter-scoped clarification, partial-review handoff and bounded transient retries.
alter table phi.encounters add column messages jsonb not null default '[]' check(jsonb_array_length(messages)<=50);
do $$ declare definition text; begin
 select pg_get_functiondef('private.demo_view(phi.encounters,boolean,boolean)'::regprocedure) into definition;
 definition:=replace(definition,'''canReview'',p_clinician)', '''canReview'',p_clinician,''messages'',e.messages,''preparedFixture'',e.notice_version=''synthetic-fixture-v1'')');
 execute definition;
 select pg_get_functiondef('api.demo_action(text,uuid,text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'''assignedTo'',t.assigned_to)', '''assignedTo'',t.assigned_to,''preparedFixture'',t.notice_version=''synthetic-fixture-v1'')');
 if position('elsif p_action=''handoff''' in definition)=0 then raise exception 'Expected action boundary missing';end if;
 definition:=replace(definition,'elsif p_action=''handoff''',E'elsif p_action=''message'' and e.consent_at is not null and e.status<>''reviewed'' and (clinician or not staff) then
       if length(trim(p_payload->>''text'')) between 1 and 1500 and jsonb_array_length(e.messages)<50 then
         update phi.encounters set messages=messages||jsonb_build_array(jsonb_build_object(''id'',gen_random_uuid(),''author'',case when clinician then ''clinician'' else ''patient / caregiver'' end,''text'',trim(p_payload->>''text''),''createdAt'',now())),updated_at=now() where id=e.id returning * into e;
         allowed:=true;result:=private.demo_view(e,staff,clinician);
       end if;
     elsif p_action=''review_partial'' and clinician and e.consent_at is not null and e.status=''intake'' and e.intake<>''{}''::jsonb then
       update phi.encounters set status=''review_needed'',updated_at=now() where id=e.id returning * into e;
       allowed:=true;result:=private.demo_view(e,true,true);
     elsif p_action=''handoff''');
 definition:=replace(definition,'''report_get'',''independent''', '''report_get'',''message'',''review_partial'',''independent''');
 definition:=replace(definition,'e.status in(''intake'',''review_needed'')','e.status=''intake''');
 execute definition;
 select pg_get_functiondef('api.demo_worker(text,uuid,uuid,jsonb,text)'::regprocedure) into definition;
 definition:=replace(definition,'set status=''failed'',error_code=case when p_error', 'set status=case when p_error in(''model_unavailable'',''timeout'') and attempts<3 then ''queued'' else ''failed'' end,available_at=now()+make_interval(secs=>least(300,15*power(2,attempts)::int)),error_code=case when p_error');
 execute definition;
end $$;
notify pgrst,'reload schema';
