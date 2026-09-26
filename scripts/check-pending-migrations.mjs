import {existsSync,readFileSync} from 'node:fs';
import {connectCloud,localMigrations} from './cloud.mjs';
for(const f of ['.env','.env.operator','.env.test'])if(existsSync(f))process.loadEnvFile(f);
const {client}=await connectCloud('test');
try{await client.query('begin');const {rows}=await client.query('select name from public.gi_schema_migrations');for(const {name} of localMigrations()){if(rows.some(r=>r.name===name))continue;try{await client.query(readFileSync(`supabase/migrations/${name}`,'utf8'));console.log(`${name}: validated`);}catch(e){console.error(JSON.stringify({migration:name,code:e.code,message:e.message,position:e.position}));process.exitCode=1;break;}}}finally{await client.query('rollback');await client.end();}
