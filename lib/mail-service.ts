export type MailEnvironment={RESEND_API_KEY?:string;MAIL_FROM?:string};
export const mailReady=(env:MailEnvironment)=>!!env.RESEND_API_KEY&&!!env.MAIL_FROM;
export async function sendTransactionalMail(env:MailEnvironment,to:string,subject:string,text:string,key:string){
 if(!mailReady(env))return {sent:false,reason:'not_configured'};
 try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from:env.MAIL_FROM,to:[to],subject,text}),signal:AbortSignal.timeout(10000)});return r.ok?{sent:true}:{sent:false,reason:'provider_error'};}catch{return {sent:false,reason:'provider_unavailable'};}
}
