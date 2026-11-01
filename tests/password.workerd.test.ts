import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {it,expect} from 'vitest';
const require=createRequire(import.meta.url);
const {Miniflare}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));
it('executes the actual password implementation inside Cloudflare workerd',async()=>{
 const passwordModule=ts.transpileModule(readFileSync('lib/password.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const mf=new Miniflare({compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],modules:[{type:'ESModule',path:process.cwd()+'/qa-worker.mjs',contents:`import {hashPassword,verifyPassword} from './password.mjs';export default {fetch(){const hash=hashPassword('Synthetic workerd password 123!');return Response.json({right:verifyPassword('Synthetic workerd password 123!',hash),wrong:verifyPassword('Wrong password',hash),salted:hash!==hashPassword('Synthetic workerd password 123!')});}}`},{type:'ESModule',path:process.cwd()+'/password.mjs',contents:passwordModule}]});
 try {const r=await mf.dispatchFetch('http://test.local/');expect(r.status).toBe(200);expect(await r.json()).toEqual({right:true,wrong:false,salted:true});}finally{await mf.dispose();}
},30000);
