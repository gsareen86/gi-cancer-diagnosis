-- Record the revised automatic-report/demo notice. Historical notice values are retained.
do $$ declare d text; boundary text;begin
 select pg_get_functiondef('api.demo_action(text,uuid,text,jsonb)'::regprocedure) into d;
 boundary:='p_payload->>''noticeVersion'' in(''synthetic-demo-notice-v1'',''gi-privacy-2026-09-22'')';
 if position(boundary in d)=0 then raise exception 'Consent version boundary missing';end if;
 d:=replace(d,boundary,'p_payload->>''noticeVersion'' in(''synthetic-demo-notice-v1'',''gi-privacy-2026-09-22'',''gi-privacy-2026-09-26'')');
 execute d;
end $$;
notify pgrst,'reload schema';
