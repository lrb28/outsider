import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve,join } from 'node:path';
const root = resolve(import.meta.dirname,'../..');
const files = execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const problems = [];
for (const file of files) {
  if (/^web\/(?!app\/|node_modules\/).+\/app\/.*\.(tsx?|jsx?)$/.test(file) || file.startsWith('web/lib/web/')) problems.push(`${file}: unexpected nested application`);
  if (!/\.(tsx?|jsx?|mjs|py|ya?ml|sql)$/.test(file)) continue;
  const source = readFileSync(join(root,file),'utf8');
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source) || /(?:postgres(?:ql)?):\/\/[^\s:'"]+:[^\s@'"<>]{12,}@[^\s'"<>]+/.test(source) || /\b(?:ghp_[A-Za-z0-9]{30,}|sb_secret_[A-Za-z0-9_-]{20,})\b/.test(source)) problems.push(`${file}: potential secret; inspect locally`);
}
if (problems.length) {console.error(problems.join('\n'));process.exit(1);}
console.log(`Repository guard: ${files.length} tracked paths checked.`);
