'use client';
import {useEffect,useRef,useState} from 'react';
import {accountRequest} from './account-forms';
import {PasswordField} from './password-field';
const c='min-h-11 rounded border border-cu-border bg-cu-panel px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-cu-purple disabled:opacity-50';

export function RecoveryForm(){
 const [email,setEmail]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <form className="space-y-3" onSubmit={async e=>{
  e.preventDefault();if(busy)return;setBusy(true);setMessage('');setError('');
  try{const r=await accountRequest<{message:string}>('/api/auth/recovery',{email});setMessage(r.message)}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }}>
  <p className="text-sm text-cu-text-secondary">Ingresá el email de tu cuenta. Te enviaremos un enlace de un solo uso, válido por 30 minutos, para elegir una nueva contraseña.</p>
  <label className="block text-sm">Email de tu cuenta<input autoFocus required type="email" autoComplete="email" maxLength={254} className={c+' mt-1 w-full'} value={email} onChange={e=>{setEmail(e.target.value);setMessage('');setError('')}}/></label>
  <button disabled={busy} className={c}>{busy?'Enviando…':message?'Volver a enviar enlace':'Enviar enlace de recuperación'}</button>
  {message&&<div role="status" className="space-y-2 text-sm"><p>{message}</p><p className="text-cu-text-secondary">Revisá también Spam. Si el correo no llega, reintentá o contactá al administrador.</p></div>}
  {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
 </form>;
}
export function AccountAccessOptions({account=false}:{account?:boolean}){
 const [cap,setCap]=useState<{email:boolean;google:boolean}|null>(null),[show,setShow]=useState(false);
 useEffect(()=>{if(!account&&new URLSearchParams(location.search).get('recovery')==='1')setShow(true);fetch('/api/auth/capabilities').then(r=>r.json()).then(d=>setCap(d as {email:boolean;google:boolean})).catch(()=>{});},[account]);
 return <div className="mt-4 space-y-3">
  {cap?.google&&<a href={'/api/auth/google/start'+(account?'?link=1':'')} target="_top" className={c+' flex items-center justify-center'}>{account?'Vincular mi cuenta de Google':'Ingresar con Google'}</a>}
  {!account&&<><button type="button" aria-expanded={show} aria-controls="password-recovery" className="min-h-11 rounded text-sm text-cu-purple underline focus-visible:outline-2 focus-visible:outline-cu-purple" onClick={()=>setShow(!show)}>{show?'Cerrar recuperación':'Olvidé mi contraseña'}</button>{show&&<section id="password-recovery" aria-label="Recuperar contraseña"><RecoveryForm/></section>}</>}
  {account&&<p className="text-xs text-cu-text-secondary">{cap?.google?'Google se vincula después de verificar tu cuenta actual. Tus permisos se conservan.':'El login de Google requiere configurar las credenciales y el dominio del espacio.'}</p>}
 </div>;
}
export function ResetPasswordForm(){
 const [token,setToken]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[message,setMessage]=useState(''),[done,setDone]=useState(false),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
 const initialized=useRef(false);
 useEffect(()=>{if(initialized.current)return;initialized.current=true;setToken(new URLSearchParams(location.hash.slice(1)).get('token')??'');history.replaceState(null,'','/reset-password');setReady(true)},[]);
 if(!ready)return <p role="status" className="mt-4 text-sm">Preparando recuperación…</p>;
 if(done)return <div role="status" className="mt-4 space-y-3 text-sm"><p>Contraseña actualizada. Se cerraron las sesiones y se revocaron las conexiones API anteriores.</p><a className="inline-flex min-h-11 items-center text-cu-purple underline" href="/login">Ingresar con mi nueva contraseña</a></div>;
 return <form className="mt-4 space-y-4" onSubmit={async e=>{e.preventDefault();if(busy)return;setMessage('');if(password!==confirm){setMessage('Las contraseñas no coinciden.');return;}setBusy(true);try{await accountRequest('/api/auth/reset-password',{token,password});setPassword('');setConfirm('');setToken('');setDone(true)}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}}>
  <p className="text-sm text-cu-text-secondary">Elegí una contraseña de entre 12 y 128 caracteres.</p>
  <PasswordField label="Nueva contraseña" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/>
  <PasswordField label="Repetir contraseña" required minLength={12} maxLength={128} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/>
  <button disabled={busy||!token} className={c}>{busy?'Guardando…':'Guardar contraseña'}</button>
  {(message||!token)&&<p role="alert" className="text-sm text-red-600">{message||'Falta el enlace de recuperación. Solicitá uno nuevo desde el login.'}</p>}
  <a className="block min-h-11 py-2 text-sm text-cu-purple underline" href="/login?recovery=1">Solicitar otro enlace</a>
 </form>;
}
