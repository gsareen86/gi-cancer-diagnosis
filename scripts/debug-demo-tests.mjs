import {readFileSync} from 'node:fs';import {connectCloud} from './cloud.mjs';
for(const f of ['.env','.env.operator','.env.test'])process.loadEnvFile(f);
const {client}=await connectCloud('test');
try {await client.query('begin');await client.query('set local search_path=public,extensions,pg_catalog');const r=await client.query(readFileSync('supabase/tests/database/003_demo_journey.sql','utf8'));for(const result of Array.isArray(r)?r:[r])for(const row of result.rows)for(const v of Object.values(row))if(typeof v==='string'&&/^(not ok|ok |#|1\.\.)/.test(v))console.log(v);}
catch(e){console.log(JSON.stringify({code:e.code,message:e.message,where:e.where?.split('\n').filter(s=>s.startsWith('PL/pgSQL function')||s.startsWith('SQL function')).join('\n')}));}
finally{await client.query('rollback');await client.end();}
