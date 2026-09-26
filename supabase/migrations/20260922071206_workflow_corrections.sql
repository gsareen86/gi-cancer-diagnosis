do $$ declare d text;begin
 select pg_get_functiondef('api.patient_start(text)'::regprocedure) into d;
 d:=replace(d,'bucket timestamptz:=date_trunc','entry_bucket timestamptz:=date_trunc');
 d:=replace(d,'values(s.site_id,bucket,1)','values(s.site_id,entry_bucket,1)');execute d;
end $$;
notify pgrst,'reload schema';
