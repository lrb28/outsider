import { build } from 'esbuild';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname,'..');
const dir = await mkdtemp(join(root,'.test-build-'));
let failed = false;
try {
  for (const name of ['portfolio','brokers','instruments','format','valuation','apiValidation','fetchJson','watchlist']) {
    await build({entryPoints:[join(root,`lib/${name}.ts`)],outfile:join(dir,`${name}.mjs`),bundle:true,platform:'node',format:'esm',logLevel:'silent'});
  }
  const mockDb = join(dir,'db.ts');
  await writeFile(mockDb,'export const getPool = () => (globalThis as any).__testPool ?? null;');
  for (const name of ['queries','stats']) {
    await build({entryPoints:[join(root,`lib/${name}.ts`)],outfile:join(dir,`${name}.mjs`),bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'test-db',setup(builder){builder.onResolve({filter:/^\.\/db$/},()=>({path:mockDb}));}}],logLevel:'silent'});
  }
  for (const route of ['trades','prices','quotes','history','resolve','match','stats','discover']) {
    await build({entryPoints:[join(root,`app/api/${route}/route.ts`)],outfile:join(dir,`route-${route}.cjs`),bundle:true,platform:'node',format:'cjs',packages:'external',plugins:[{name:'test-db',setup(builder){builder.onResolve({filter:/^\.\/db$/},()=>({path:mockDb}));}}],logLevel:'silent'});
  }
  await build({entryPoints:[join(root,'lib/rateLimit.ts')],outfile:join(dir,'rateLimit.cjs'),bundle:true,platform:'node',format:'cjs',packages:'external',logLevel:'silent'});
  for (const name of ['test-portfolio.mjs','test-broker-import.mjs','test-audit.mjs','test-hardening.mjs']) {
    const source = (await readFile(join(root,'scripts',name),'utf8')).replaceAll('../.tmp-','./');
    const file = join(dir,name); await writeFile(file,source);
    const result = spawnSync(process.execPath,[file],{cwd:root,stdio:'inherit',env:{...process.env,OUTSIDER_REPO:resolve(root,'..')}});
    if (result.status !== 0) failed = true;
  }
} finally {await rm(dir,{recursive:true,force:true});}
if (failed) process.exit(1);
