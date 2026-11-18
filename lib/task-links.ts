/** Canonical app link; never copy the current URL's filters, tokens or hash. */
export function taskPath(listId:string,taskId:string){
 return `/l/${encodeURIComponent(listId)}?task=${encodeURIComponent(taskId)}`;
}
export function taskLink(origin:string,listId:string,taskId:string){return new URL(taskPath(listId,taskId),origin).href;}

/** Allow app navigation only, never an external or authentication destination. */
export function safeAppReturnTo(value:unknown):string{
 if(typeof value!=='string'||value.length>4096||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u001f\u007f]/.test(value))return '/home';
 try{
  const url=new URL(value,'https://app.local');
  if(url.origin!=='https://app.local'||!/^\/(?:home|settings|dashboards|l\/[^/]+|documents(?:\/[^/]+)?)\/?$/.test(url.pathname))return '/home';
  return url.pathname+url.search;
 }catch{return '/home';}
}

export async function copyTaskText(value:string,clipboard?:Pick<Clipboard,'writeText'>):Promise<boolean>{
 try{if(!clipboard)return false;await clipboard.writeText(value);return true;}catch{return false;}
}
