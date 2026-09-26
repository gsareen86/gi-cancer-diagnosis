-- Operators/tests may claim a specific queued job; the normal worker omits p_id.
do $$ declare definition text;begin
 select pg_get_functiondef('api.demo_worker(text,uuid,uuid,jsonb,text)'::regprocedure) into definition;
 definition:=replace(definition,'where (status=''queued'' and available_at<=now()) or (status=''running'' and lease_until<now()) order by created_at','where ((status=''queued'' and available_at<=now()) or (status=''running'' and lease_until<now())) and (p_id is null or id=p_id) order by created_at');
 execute definition;
end $$;
notify pgrst,'reload schema';
