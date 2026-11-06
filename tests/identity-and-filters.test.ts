import {describe,it,expect,vi,afterEach} from 'vitest';
import {verifyGoogleToken} from '@/lib/google-login';
import {sendTransactionalMail} from '@/lib/mail-service';
import {matchFieldFilter} from '@/lib/advanced-filters';
import {csvCell} from '@/lib/csv';
import {Access} from '@/lib/access-context';
import {canReadField} from '@/lib/field-runtime';
afterEach(()=>vi.unstubAllGlobals());
describe('identity verification and advanced filtering',()=>{
 it('verifies Google signatures, issuer, audience, nonce and Workspace domain',async()=>{
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']),publicKey=await crypto.subtle.exportKey('jwk',keys.publicKey);
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({keys:[{...publicKey,kid:'test-key'}]})));
 const env={GOOGLE_CLIENT_ID:'client-id',GOOGLE_CLIENT_SECRET:'secret',GOOGLE_WORKSPACE_DOMAIN:'company.test'},now=Math.floor(Date.now()/1000);
 async function token(change:Record<string,unknown>={}){const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'test-key'})).toString('base64url'),payload=Buffer.from(JSON.stringify({iss:'https://accounts.google.com',aud:'client-id',exp:now+600,iat:now,nonce:'expected',email_verified:true,hd:'company.test',sub:'google-subject',email:'user@company.test',...change})).toString('base64url'),body=header+'.'+payload,signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(body));return body+'.'+Buffer.from(signature).toString('base64url');}
 expect((await verifyGoogleToken(await token(),env,'expected')).subject).toBe('google-subject');
 for(const change of [{iss:'https://other.test'},{aud:'other'},{nonce:'other'},{hd:'other.test'},{email_verified:false},{exp:now-1}])await expect(verifyGoogleToken(await token(change),env,'expected')).rejects.toMatchObject({status:403});
 });
 it('only sends transaction mail when configured and supplies provider idempotency',async()=>{const send=vi.fn(async(_url:string|URL|Request,_init?:RequestInit)=>Response.json({id:'accepted'}));vi.stubGlobal('fetch',send);expect(await sendTransactionalMail({},'qa@test.com','Subject','Body','key')).toMatchObject({sent:false});expect(send).not.toHaveBeenCalled();expect(await sendTransactionalMail({RESEND_API_KEY:'secret',MAIL_FROM:'Team <team@test.com>'},'qa@test.com','Subject','Body','key')).toMatchObject({sent:true});expect(send.mock.calls[0][1]).toMatchObject({headers:{'Idempotency-Key':'key'}});});
 it('compares typed values and keeps empty, false and zero distinct',()=>{expect(matchFieldFilter(0,{fieldId:'f',op:'empty'})).toBe(false);expect(matchFieldFilter(false,{fieldId:'f',op:'eq',value:false})).toBe(true);expect(matchFieldFilter(null,{fieldId:'f',op:'empty'})).toBe(true);expect(matchFieldFilter('Negociación',{fieldId:'f',op:'contains',value:'negociacion'})).toBe(true);expect(matchFieldFilter(['one','two'],{fieldId:'f',op:'eq',value:'two'})).toBe(true);expect(matchFieldFilter('2026-11-01',{fieldId:'f',op:'before',value:'2026-11-05'})).toBe(true);expect(csvCell('=HYPERLINK("bad")')).toContain("'=HYPERLINK");});
 it('enforces field audiences independently from task access',()=>{const actor={user:{id:'a',email:'a@test.com',name:'A',color:'#000',avatarUrl:null},workspaceId:'w',role:'MEMBER' as const,kind:'local' as const,access:new Access('MEMBER',true,[],[])};expect(canReadField(actor,{readerIds:['b']})).toBe(false);expect(canReadField(actor,{readerIds:['a']})).toBe(true);expect(canReadField(actor,{adminOnly:true})).toBe(false);});
});
