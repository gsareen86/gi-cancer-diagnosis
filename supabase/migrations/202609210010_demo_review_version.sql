-- Clinical review writes must identify the facts actually shown to the reviewer.
do $$ declare definition text; begin
 select pg_get_functiondef('api.demo_action(text,uuid,text,jsonb)'::regprocedure) into definition;
 if position('elsif p_action=''draft'' and clinician' in definition)=0 then raise exception 'Expected draft boundary missing';end if;
 definition:=replace(definition,'elsif p_action=''draft'' and clinician','elsif p_action=''draft'' and p_payload->>''sourceVersion''=e.version::text and clinician');
 definition:=replace(definition,'elsif p_action=''independent'' and clinician','elsif p_action=''independent'' and p_payload->>''sourceVersion''=e.version::text and clinician');
 definition:=replace(definition,'elsif p_action=''release'' and clinician','elsif p_action=''release'' and p_payload->>''sourceVersion''=e.version::text and clinician');
 execute definition;
end $$;
notify pgrst,'reload schema';
