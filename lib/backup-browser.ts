/** Local integrity check. Restore independently validates again in the target environment. */
export async function validateBackupFile(file:File){
 const b=JSON.parse(await file.text()) as {format:string;schema:number;createdAt:string;tables:Record<string,unknown[]>;checksums:Record<string,string>;files:{key:string;data:string;checksum:string}[]};
 if(b.format!=='sav3-workspace'||b.schema!==1||!b.tables||!b.checksums||!Array.isArray(b.files))throw new Error('Formato no compatible.');
 async function hash(bytes:Uint8Array){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))].map(x=>x.toString(16).padStart(2,'0')).join('');}
 const encoder=new TextEncoder();for(const [name,rows]of Object.entries(b.tables))if(await hash(encoder.encode(JSON.stringify(rows)))!==b.checksums[name])throw new Error('Checksum incorrecto en '+name);
 for(const f of b.files){const binary=atob(f.data),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);if(await hash(bytes)!==f.checksum)throw new Error('Adjunto dañado: '+f.key);}
 return {createdAt:b.createdAt,counts:Object.fromEntries(Object.entries(b.tables).map(([k,v])=>[k,v.length])),files:b.files.length};
}
