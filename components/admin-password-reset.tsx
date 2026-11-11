'use client';
import {useState} from 'react';
import {accountRequest} from './account-forms';
import {PasswordField} from './password-field';
import {Dialog,DialogContent,DialogTitle,DialogDescription,DialogTrigger} from './ui/dialog';
const button='min-h-11 rounded-md border border-cu-border bg-cu-panel px-3 text-sm text-cu-text focus-visible:outline-2 focus-visible:outline-cu-purple disabled:opacity-50';
export function AdminPasswordReset({userId,email}:{userId:string;email:string}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[password,setPassword]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
 return <Dialog open={open} onOpenChange={value=>{if(busy)return;setOpen(value);setPassword('');setError('');setMessage('')}}>
  <DialogTrigger asChild><button type="button" className={button+' mt-2'}>Generar contraseña</button></DialogTrigger>
  <DialogContent className="border-cu-border bg-cu-panel text-cu-text">
   <DialogTitle>Nueva contraseña de usuario</DialogTitle>
   <DialogDescription className="break-all text-cu-text-secondary">Cuenta: {email}</DialogDescription>
   {!password?<><p className="text-sm">Se reemplazará su contraseña y se cerrarán sus sesiones y conexiones API anteriores. Sus permisos no cambian. Compartí la nueva contraseña de forma privada para que pueda ingresar y cambiarla desde Mi cuenta.</p><button type="button" disabled={busy} className={button} onClick={async()=>{setBusy(true);setError('');try{const result=await accountRequest<{password:string}>('/api/team/users/reset-password',{userId});setPassword(result.password)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>{busy?'Generando…':'Confirmar y generar contraseña'}</button></>:<>
    <p role="status" className="text-sm">Contraseña generada. Solo se muestra en esta ventana; al cerrarla no podrás consultarla de nuevo.</p>
    <PasswordField label="Nueva contraseña generada" value={password} readOnly autoComplete="off" onFocus={e=>e.target.select()}/>
    <button type="button" className={button} onClick={()=>navigator.clipboard.writeText(password).then(()=>setMessage('Contraseña copiada.')).catch(()=>setMessage('Seleccioná y copiá la contraseña del campo.'))}>Copiar contraseña</button>
    <button type="button" className={button} onClick={()=>{setOpen(false);setPassword('');setMessage('')}}>Cerrar y ocultar contraseña</button>
   </>}
   {message&&<p role="status" className="text-sm">{message}</p>}{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  </DialogContent>
 </Dialog>;
}
