import {connectCloud} from './cloud.mjs';
for(const f of ['.env','.env.operator','.env.test'])process.loadEnvFile(f);
const {client}=await connectCloud('test');
try{const r=await client.query("update phi.demo_jobs j set status='cancelled',lease=null,error_code='test_run_ended' from phi.encounters e join app.staff_accounts a on a.user_id=e.assigned_to where e.id=j.encounter_id and a.synthetic_key like 'SYN-JOURNEY-%' and not a.active and j.status in('queued','running')");console.log(`${r.rowCount} abandoned synthetic test jobs cancelled`);}finally{await client.end();}
