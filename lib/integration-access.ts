import { randomBytes, randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { AccessError, type Actor } from "./access-context";
const hash = (s:string) => createHash("sha256").update(s).digest("hex");
export async function integrationRoute(req:Request, db:D1Database, a:Actor|null):Promise<Response|null> {
 const path=new URL(req.url).pathname;
 if(path!=="/api/integrations/tokens" && path!=="/api/notification-preferences")return null;
 try {
  if(!a)throw new AccessError(401,"Iniciá sesión.");
  if(a.kind==="token")throw new AccessError(403,"Administrá las conexiones desde tu cuenta en el sitio.");
  if(req.method!=="GET" && req.headers.get("Origin")!==new URL(req.url).origin)throw new AccessError(403,"Origen no permitido.");
  if(path==="/api/notification-preferences") {
   if(req.method==="GET")return Response.json(await db.prepare('SELECT mentions,assigned,comments FROM NotificationPreference WHERE userId=?').bind(a.user.id).first()??{mentions:1,assigned:1,comments:1});
   if(req.method!=="PUT")throw new AccessError(405,"Método no permitido.");
   const p=z.object({mentions:z.boolean(),assigned:z.boolean(),comments:z.boolean()}).parse(await req.json());
   await db.prepare('INSERT INTO NotificationPreference (userId,mentions,assigned,comments) VALUES (?,?,?,?) ON CONFLICT(userId) DO UPDATE SET mentions=excluded.mentions,assigned=excluded.assigned,comments=excluded.comments').bind(a.user.id,+p.mentions,+p.assigned,+p.comments).run();
   return Response.json({ok:true});
  }
  if(req.method==="GET")return Response.json({tokens:(await db.prepare('SELECT id,name,scope,createdAt,expiresAt,revoked FROM IntegrationToken WHERE userId=? ORDER BY createdAt DESC').bind(a.user.id).all()).results});
  if(req.method==="DELETE") {
   const {id}=z.object({id:z.string().min(1)}).parse(await req.json());
   await db.prepare('UPDATE IntegrationToken SET revoked=1 WHERE id=? AND userId=?').bind(id,a.user.id).run();return Response.json({ok:true});
  }
  if(req.method!=="POST")throw new AccessError(405,"Método no permitido.");
  const p=z.object({name:z.string().trim().min(1).max(80),scope:z.enum(["read","write"]),days:z.number().int().min(1).max(365)}).parse(await req.json());
  if(a.role==="GUEST"&&p.scope==="write")throw new AccessError(403,"Los invitados solo pueden crear conexiones de lectura.");
  const active=await db.prepare('SELECT count(*) n FROM IntegrationToken WHERE userId=? AND revoked=0 AND expiresAt>?').bind(a.user.id,Date.now()).first<{n:number}>();
  if((active?.n??0)>=20)throw new AccessError(400,"Revocá una conexión antes de crear otra (máximo 20 activas).");
  const token="sav3_"+randomBytes(32).toString("hex"),id=randomUUID(),expiresAt=Date.now()+p.days*86400000;
  await db.prepare('INSERT INTO IntegrationToken (id,userId,name,tokenHash,scope,createdAt,expiresAt) VALUES (?,?,?,?,?,?,?)').bind(id,a.user.id,p.name,hash(token),p.scope,Date.now(),expiresAt).run();
  return Response.json({id,token,expiresAt});
 }catch(e){return Response.json({error:e instanceof AccessError?e.message:"Solicitud inválida."},{status:e instanceof AccessError?e.status:400});}
}
