-- Revoking a capability intentionally makes its row invisible. A private fixed
-- helper performs that write after demo_action has locked and authorised it.
grant create on schema private to gi_demo_worker;
create function private.demo_revoke(p_id uuid,p_withdraw boolean) returns void language plpgsql volatile security definer set search_path='' as $$
begin
 update phi.encounters set cap_expires=now(),consent_at=case when p_withdraw then null else consent_at end,
 status=case when p_withdraw then 'review_needed' else status end,
 ai=case when p_withdraw then null else ai end,ai_version=case when p_withdraw then null else ai_version end where id=p_id;
 if p_withdraw then update phi.demo_jobs set status='cancelled',lease=null where encounter_id=p_id and status in('queued','running');end if;
end $$;
alter function private.demo_revoke(uuid,boolean) owner to gi_demo_worker;
revoke all on function private.demo_revoke(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function private.demo_revoke(uuid,boolean) to gi_demo_executor;
revoke create on schema private from gi_demo_worker;
do $$ declare definition text;begin
 select pg_get_functiondef('api.demo_action(text,uuid,text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'update phi.encounters set cap_expires=now() where id=e.id;', 'perform private.demo_revoke(e.id,false);');
 definition:=replace(definition,E'update phi.encounters set consent_at=null,status=''review_needed'',ai=null,ai_version=null,cap_expires=now() where id=e.id;\n       update phi.demo_jobs set status=''cancelled'',lease=null where encounter_id=e.id and status in(''queued'',''running'');','perform private.demo_revoke(e.id,true);');
 execute definition;
end $$;
notify pgrst,'reload schema';
