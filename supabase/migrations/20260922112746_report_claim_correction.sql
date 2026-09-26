do $$ declare definition text;begin
 select pg_get_functiondef('api.report_worker(text,uuid,uuid,jsonb,text)'::regprocedure) into definition;
 definition:=replace(definition,'join phi.encounters e on e.id=d.encounter_id where d.deleted_at is null and e.consent_at is not null and e.released_at is null','join phi.encounters visit on visit.id=d.encounter_id where d.deleted_at is null and visit.consent_at is not null and visit.released_at is null');
 execute definition;
end $$;
notify pgrst,'reload schema';
