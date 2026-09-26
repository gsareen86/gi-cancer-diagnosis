import {readFileSync} from 'node:fs';
import {connectCloud} from './cloud.mjs';
for(const f of ['.env','.env.operator','.env.test'])process.loadEnvFile(f);
const {client}=await connectCloud('test');
try {await client.query('begin');await client.query(readFileSync('supabase/migrations/202609210003_hospital_demo.sql','utf8'));console.log('Migration dry run passed');}
catch(e){console.log(JSON.stringify({code:e.code,position:e.position,routine:e.routine,message:e.message?.replace(/https?:\/\/\S+/g,'[endpoint]')}));}
finally {await client.query('rollback');await client.end();}
