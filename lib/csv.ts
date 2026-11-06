export function csvCell(v:unknown){let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
export function csv(rows:unknown[][]){return '\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');}
export function csvResponse(rows:unknown[][],name:string){return new Response(csv(rows),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${name}.csv"`}});}
