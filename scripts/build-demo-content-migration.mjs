// Run once before applying this migration. Later content revisions require a new migration.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const target='supabase/migrations/202609210004_demo_content_contract.sql';
if(existsSync(target))throw new Error('Do not rewrite an existing migration');
const content=JSON.parse(readFileSync('src/lib/demo/content.json','utf8'));
const sql=`
create table app.demo_content(version text primary key,document jsonb not null);
alter table app.demo_content enable row level security;
alter table app.demo_content force row level security;
insert into app.demo_content values('${content.version}',$content$${JSON.stringify(content)}$content$);
revoke all on app.demo_content from public,anon,authenticated,service_role;
grant select on app.demo_content to gi_demo_executor,gi_demo_worker;
create policy demo_content_read on app.demo_content for select to gi_demo_executor,gi_demo_worker using(true);
create function private.demo_validate_encounter() returns trigger language plpgsql set search_path='' as $$
declare doc jsonb;q jsonb; r jsonb;term jsonb; a record;floor int:=0;matched boolean; val jsonb; begin
 select document into doc from app.demo_content where version=new.content_version;
 if doc is null then raise exception 'Unknown content version';end if;
 if new.intake<>'{}'::jsonb then
   if new.consent_at is null and new.intake is distinct from old.intake then raise exception 'Consent required';end if;
   if jsonb_typeof(new.intake->'answers')<>'object' or new.intake->>'suppliedBy' not in('patient','caregiver') or new.intake->>'enteredBy' not in('patient','coordinator') or new.intake->>'sex' not in('Female','Male','Other','Prefer not to answer') or not coalesce((new.intake->>'age')::int between 18 and 110,false) or length(new.intake->>'name')>80 then raise exception 'Invalid intake';end if;
   for a in select * from jsonb_each_text(new.intake->'answers') loop
     select v into q from jsonb_array_elements(doc->'questions') v where v->>'id'=a.key;
     if q is null or length(a.value)>2000 or (q->>'kind'='choice' and a.value<>'' and not (q->'options' ? a.value)) then raise exception 'Invalid answer';end if;
   end loop;
   for r in select * from jsonb_array_elements(doc->'rules') loop
     matched:=true;
     for term in select * from jsonb_array_elements(r->'all') loop
       if not coalesce(term->'values' ? (new.intake->'answers'->>(term->>'field')),false) then matched:=false;end if;
     end loop;
     if matched then floor:=greatest(floor,case r->>'urgency' when 'immediate' then 2 when 'prompt' then 1 else 0 end);end if;
   end loop;
 end if;
 foreach val in array array[new.independent,new.release,new.ai] loop
   if val is not null then
     if val->>'urgency' is null or val->>'urgency' not in('review','prompt','immediate') or (case val->>'urgency' when 'immediate' then 2 when 'prompt' then 1 else 0 end)<floor then raise exception 'Urgency below minimum';end if;
   end if;
 end loop;
 if new.independent is not null then
   if length(coalesce(new.independent->>'impression',''))<5 or length(coalesce(new.independent->>'plan',''))<5 or not (doc->'specialties' ? (new.independent->>'specialty')) then raise exception 'Incomplete independent assessment';end if;
 end if;
 if new.release is not null then
   if length(coalesce(new.release->>'impression',''))<5 or length(coalesce(new.release->>'plan',''))<5 or not (doc->'specialties' ? (new.release->>'specialty')) then raise exception 'Incomplete release';end if;
 end if;
 return new;
end $$;
grant execute on function private.demo_validate_encounter() to gi_demo_executor,gi_demo_worker;
revoke execute on function private.demo_validate_encounter() from public,anon,authenticated,service_role;
create trigger validate_demo_encounter before insert or update on phi.encounters for each row execute function private.demo_validate_encounter();
notify pgrst,'reload schema';
`;
writeFileSync(target,sql);
console.log('Versioned content migration generated; do not regenerate after applying.');
