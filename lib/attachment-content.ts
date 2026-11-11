// Inspect only the signature: extensions and browser MIME labels are not trusted
// for inline rendering. Other formats are always served as downloads.
export function imageMime(bytes: Uint8Array): string | null {
 const matches=(prefix:number[])=>prefix.every((b,i)=>bytes[i]===b);
 if(matches([137,80,78,71,13,10,26,10]))return 'image/png';
 if(matches([255,216,255]))return 'image/jpeg';
 const ascii=(start:number,end:number)=>String.fromCharCode(...bytes.slice(start,end));
 if(['GIF87a','GIF89a'].includes(ascii(0,6)))return 'image/gif';
 if(ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP')return 'image/webp';
 return null;
}
export function attachmentHeaders(name:string,mime:string,inline:boolean){
 const cleaned=name.replace(/[\x00-\x1f\x7f/\\]/g,'_')||'archivo';
 const ascii=cleaned.replace(/[^\x20-\x7e]|["\\]/g,'_');
 const encoded=encodeURIComponent(cleaned).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
 return {'Content-Type':mime,'Content-Disposition':`${inline?'inline':'attachment'}; filename="${ascii}"; filename*=UTF-8''${encoded}`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'};
}
export async function attachmentResponse(body:ReadableStream<Uint8Array>,name:string,declaredMime:string,download:boolean){
 const reader=body.getReader();
 const first=await reader.read();
 // An underlying stream may split the signature across chunks.
 const chunks:Uint8Array[]=first.done?[]:[first.value];let size=first.value?.length??0,done=!!first.done;
 while(size<12&&!done){const part=await reader.read();done=!!part.done;if(part.value){chunks.push(part.value);size+=part.value.length;}}
 const prefix=new Uint8Array(Math.min(size,12));let position=0;
 for(const chunk of chunks){const part=chunk.subarray(0,prefix.length-position);prefix.set(part,position);position+=part.length;if(position===prefix.length)break;}
 const image=imageMime(prefix),mime=image??(declaredMime.match(/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i)?declaredMime:'application/octet-stream');
 const stream=new ReadableStream<Uint8Array>({start(controller){for(const chunk of chunks)controller.enqueue(chunk);if(done)controller.close();},async pull(controller){try{const part=await reader.read();if(part.done)controller.close();else controller.enqueue(part.value);}catch(e){controller.error(e)}},cancel(reason){return reader.cancel(reason)}});
 return new Response(stream,{headers:attachmentHeaders(name,mime,!!image&&!download)});
}
