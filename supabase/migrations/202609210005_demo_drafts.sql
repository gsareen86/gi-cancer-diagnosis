-- Persist clinician drafts separately from their immutable independent assessment.
alter table phi.encounters add column clinician_draft jsonb;
alter table phi.encounters add column draft_at timestamptz;
alter table phi.encounters add column final_review jsonb;
do $$ declare definition text;begin
 select pg_get_functiondef('private.demo_view(phi.encounters,boolean,boolean)'::regprocedure) into definition;
 definition:=replace(definition,'''independent'',case when p_clinician', '''draft'',case when p_clinician then e.clinician_draft else null end,''draftAt'',case when p_clinician then e.draft_at else null end,''finalReview'',case when p_clinician then e.final_review else null end,''independent'',case when p_clinician');
 execute definition;
 select pg_get_functiondef('api.demo_action(text,uuid,text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'elsif p_action=''independent'' and clinician',E'elsif p_action=''draft'' and clinician and e.consent_at is not null and e.status in(''queued'',''review_needed'') then\n update phi.encounters set clinician_draft=p_payload->''review'',draft_at=now() where id=e.id returning * into e;allowed:=true;result:=private.demo_view(e,true,true);\n elsif p_action=''independent'' and clinician');
 definition:=replace(definition,'''independent'',''reveal'',''release'',''retry''','''draft'',''independent'',''reveal'',''release'',''retry''');
 definition:=replace(definition,'set independent=p_payload->''review'',','set clinician_draft=p_payload->''review'',draft_at=now(),independent=p_payload->''review'',');
 definition:=replace(definition,'set release=jsonb_build_object','set final_review=p_payload->''review'',release=jsonb_build_object');
 -- Coded disagreement and internal correction notes remain clinician-only.
 definition:=replace(definition,',''disagreement'',p_payload->''review''->>''disagreement'',''reason'',p_payload->''review''->>''reason''','');
 definition:=replace(definition,'ai_revealed_at=null,updated_at=now()','ai_revealed_at=null,clinician_draft=null,draft_at=null,updated_at=now()');
 execute definition;
end $$;
notify pgrst,'reload schema';
