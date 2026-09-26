create table phi.assessment_history(id uuid primary key default gen_random_uuid(),encounter_id uuid not null references phi.encounters(id),site_id uuid not null,source_version int not null,kind text not null check(kind in('independent','release')),assessment jsonb not null,author uuid,created_at timestamptz not null default now());
create table phi.ai_evaluations(id uuid primary key default gen_random_uuid(),encounter_id uuid not null references phi.encounters(id),site_id uuid not null,source_version int not null,ai_created_at timestamptz not null,clinician_at timestamptz not null,reviewer uuid not null,prior_exposure text,feedback jsonb not null,created_at timestamptz not null default now());
alter table phi.assessment_history enable row level security;alter table phi.assessment_history force row level security;
alter table phi.ai_evaluations enable row level security;alter table phi.ai_evaluations force row level security;
revoke all on phi.assessment_history,phi.ai_evaluations from public,anon,authenticated,service_role;
grant insert on phi.assessment_history to gi_demo_executor,gi_demo_worker;
grant insert on phi.ai_evaluations to gi_demo_executor;
create policy history_insert on phi.assessment_history for insert to gi_demo_executor,gi_demo_worker with check(exists(select 1 from phi.encounters e where e.id=encounter_id and e.site_id=assessment_history.site_id));
create policy evaluation_insert on phi.ai_evaluations for insert to gi_demo_executor with check(private.session_ok() and private.has_role(site_id,array['clinician']) and reviewer=private.request_uid());
create trigger history_immutable before update or delete or truncate on phi.assessment_history for each statement execute function private.no_audit_mutation();
create trigger evaluation_immutable before update or delete or truncate on phi.ai_evaluations for each statement execute function private.no_audit_mutation();
create function private.assessment_history() returns trigger language plpgsql set search_path='' as $$ begin
 if new.independent is distinct from old.independent and new.independent is not null then insert into phi.assessment_history(encounter_id,site_id,source_version,kind,assessment,author) values(new.id,new.site_id,new.version,'independent',new.independent,new.reviewer_id);end if;
 if new.release is distinct from old.release and new.release is not null then insert into phi.assessment_history(encounter_id,site_id,source_version,kind,assessment,author) values(new.id,new.site_id,new.version,'release',new.release,new.reviewer_id);end if;return new;
end $$;
revoke all on function private.assessment_history() from public,anon,authenticated,service_role;
grant execute on function private.assessment_history() to gi_demo_executor,gi_demo_worker;
create trigger assessment_history after update on phi.encounters for each row execute function private.assessment_history();
do $$ declare d text;begin
 select pg_get_functiondef('api.demo_action(text,uuid,text,jsonb)'::regprocedure) into d;
 d:=replace(d,'elsif p_action=''reveal'' and clinician',$replacement$elsif p_action='feedback' and clinician and e.independent_at is not null and e.ai_revealed_at is not null and e.ai is not null and e.ai_version=e.version and p_payload->>'sourceVersion'=e.version::text then
  if p_payload->>'overall' in('Accept','Needs changes','Disagree','Unable to assess') and jsonb_typeof(p_payload->'dimensions')='object' and octet_length(p_payload::text)<10000 then
   insert into phi.ai_evaluations(encounter_id,site_id,source_version,ai_created_at,clinician_at,reviewer,prior_exposure,feedback) values(e.id,e.site_id,e.version,e.ai_created_at,e.independent_at,private.request_uid(),e.independent->>'priorExposure',p_payload);
   allowed:=true;result:=private.demo_view(e,true,true);
  end if;
 elsif p_action='reveal' and clinician$replacement$);
 d:=replace(d,'''draft'',''independent'',''reveal''','''draft'',''independent'',''feedback'',''reveal''');execute d;
 -- Preserve precise generic failure codes. Never store provider response bodies.
 select pg_get_functiondef('api.demo_worker(text,uuid,uuid,jsonb,text)'::regprocedure) into d;
 d:=replace(d,'''extraction_required'',''timeout''','''extraction_required'',''timeout'',''model_identity_mismatch'',''provider_auth_failed'',''provider_rate_limited'',''provider_not_configured'',''provider_residency_unverified'',''provider_refused'',''output_truncated'',''content_version_unavailable'',''vision_unavailable''');execute d;
end $$;
notify pgrst,'reload schema';
