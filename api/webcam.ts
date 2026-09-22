import type { VercelRequest,VercelResponse } from '@vercel/node';
const PAGE='https://www.eiskanal-augsburg.de/eiskanal-infos/eiskanal-webcam/';
function abs(src:string){try{return new URL(src,PAGE).toString()}catch{return''}}
export default async function handler(req:VercelRequest,res:VercelResponse){
 try{
  const html=await fetch(PAGE,{headers:{'user-agent':'Mozilla/5.0 EiskanalDashboard/1.0'}}).then(r=>{if(!r.ok)throw new Error('page');return r.text()});
  const imgs=[...html.matchAll(/<img\b[^>]*?src=["']([^"']+)["'][^>]*>/gi)].map(m=>({src:abs(m[1]),tag:m[0]})).filter(x=>x.src);
  const scored=imgs.map(x=>{const s=(x.src+' '+x.tag).toLowerCase();let score=0;if(/webcam|camera|camimage|snapshot|eiskanal/.test(s))score+=20;if(/\.jpe?g|\.png/.test(s))score+=5;if(/logo|icon|avatar|piwik|cookie|svg/.test(s))score-=20;const w=x.tag.match(/width=["']?(\d+)/i),h=x.tag.match(/height=["']?(\d+)/i);if(w&&h)score+=Math.min(20,(Number(w[1])*Number(h[1]))/50000);return{...x,score}}).sort((a,b)=>b.score-a.score);
  for(const c of scored){
   try{
    const r=await fetch(c.src,{headers:{'user-agent':'Mozilla/5.0 EiskanalDashboard/1.0','referer':PAGE}});
    const ct=r.headers.get('content-type')||'';
    if(r.ok&&ct.startsWith('image/')){
     const buf=Buffer.from(await r.arrayBuffer());
     res.setHeader('Content-Type',ct);res.setHeader('Cache-Control','public, s-maxage=3600, stale-while-revalidate=3600');return res.status(200).send(buf);
    }
   }catch{}
  }
  return res.redirect(302,PAGE);
 }catch(e){console.error(e);return res.redirect(302,PAGE)}
}