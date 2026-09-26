import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const files = ['openspec/config.yaml', 'docs/clinical/question-inventory.md', ...['proposal.md','design.md','tasks.md','specs/hospital-demo/spec.md'].map(f=>`openspec/changes/hospital-demo-journey/${f}`)];
const prompt = 'You are the independent Claude reviewer required by AGENTS.md. Review these specifications before implementation. Return concise blocking findings and concrete fixes, then nonblocking findings. Check urgency scenarios against the included question inventory, consent, PHI auditing/RLS, patient capability separation, source-linked verification, model failures/stale results and independent clinician review. Synthetic demo only. No tools; all context follows. Do not ask to read files.\n'+files.map(f=>`\nFILE ${f}\n${readFileSync(f,'utf8')}`).join('\n');
mkdirSync('var/reviews',{recursive:true});
const child = spawn('C:/Users/saree/.local/bin/claude.exe',['--safe-mode','--tools','','--no-session-persistence','--print','--output-format','json'],{shell:false,stdio:['pipe','pipe','pipe'],windowsHide:true});
let output=''; child.stdout.on('data',b=>output+=b); child.stderr.on('data',()=>{});
child.stdin.end(prompt);
child.on('close',code=>{writeFileSync('var/reviews/hospital-demo-spec.json',output); console.log(JSON.stringify({code,outputFile:'var/reviews/hospital-demo-spec.json',length:output.length}));});
