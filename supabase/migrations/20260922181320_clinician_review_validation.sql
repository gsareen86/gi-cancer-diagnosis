-- Short clinical terms are valid. Preserve all consent, role, source-version and urgency guards.
do $$
declare definition text; target text; replacement text; field text; document text;
begin
  select pg_get_functiondef('private.demo_validate_encounter()'::regprocedure) into definition;
  foreach document in array array['independent','release'] loop
    foreach field in array array['impression','plan'] loop
      target := format('length(coalesce(new.%s->>''%s'',''''))<5',document,field);
      replacement := format('(coalesce(new.%s->>''%s'','''') !~ ''[^[:space:]]'')',document,field);
      if position(target in definition)=0 then raise exception 'Expected assessment validation boundary missing'; end if;
      definition := replace(definition,target,replacement);
    end loop;
  end loop;
  execute definition;
end $$;
