import {readFileSync,readdirSync,mkdtempSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {validateBackup,restoreBackup} from '../lib/backup-service';
const filename=process.argv[2];if(!filename)throw new Error('Usage: pnpm exec tsx scripts/restore-workspace.ts /absolute/backup.json [empty-recovery-directory]');
const root=process.argv[3]?resolve(process.argv[3]):mkdtempSync(resolve(tmpdir(),'sav3-recovery-'));
const require=createRequire(import.meta.url),{Miniflare}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));
const mf=new Miniflare({modules:true,script:"export default{fetch(){return new Response('isolated recovery')}}",compatibilityDate:'2026-05-15',d1Databases:{DB:'sav3-recovery'},r2Buckets:{BUCKET:'sav3-recovery'},d1Persist:resolve(root,'d1'),r2Persist:resolve(root,'r2')});
try{const db=await mf.getD1Database('DB'),exists=await db.prepare("SELECT name FROM sqlite_master WHERE name='Workspace'").first();if(!exists)for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+f,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();const result=await restoreBackup(db,validateBackup(JSON.parse(readFileSync(filename,'utf8'))),await mf.getR2Bucket('BUCKET'));console.log(JSON.stringify({directory:root,...result},null,2));}finally{await mf.dispose();}
