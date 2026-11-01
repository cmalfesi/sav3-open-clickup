import {spawnSync} from 'node:child_process';
for (const args of [['scripts/prepare-private-data.mjs'],['node_modules/prisma/build/index.js','generate'],['scripts/run-framework.mjs','build']]) {
 const result=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});
 if(result.status!==0)process.exit(result.status??1);
}
