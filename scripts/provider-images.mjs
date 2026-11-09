// Shared, conservative selection of approved provider imagery.
// Never show generic segment-category fallbacks as an artist photograph.
const trustedHosts = ['ticketm.net','ticketmaster.com','ticketmaster.com.au'];
export function validatedImageUrl(raw) {
  if (typeof raw!=='string'||raw.length>2048)return null;
  try {
    const u=new URL(raw);
    if(u.protocol!=='https:'||u.username||u.password)return null;
    const host=u.hostname.toLowerCase();
    if(!trustedHosts.some(d=>host===d||host.endsWith('.'+d)))return null;
    if(!/\.(?:jpe?g|png|webp)(?:$|\?)/i.test(u.pathname+u.search))return null;
    return u.href;
  } catch {return null}
}
export function choosePosterImage(candidates,{minWidth=450}={}) {
  if(!Array.isArray(candidates))return null;
  const images=candidates.filter(x=>x && x.fallback!==true && validatedImageUrl(x.url))
    .map(x=>({
      url:validatedImageUrl(x.url),
      width:Number(x.width)||0,height:Number(x.height)||0,
      attribution: typeof x.attribution==='string'?x.attribution.trim().slice(0,200):null,
      ratio:x.ratio
    })).filter(x=>x.width>=minWidth&&x.height>=175);
  if(!images.length)return null;
  const score=x=>{
    const actualRatio=x.width/x.height;
    const ratioScore=actualRatio<=1.5?45:actualRatio<=2?25:0;
    const widthScore= Math.min(x.width,1200)/25;
    const tooLarge= x.width>2000 ? (x.width-2000)/100 : 0;
    return ratioScore+widthScore-tooLarge;
  };
  images.sort((a,b)=>score(b)-score(a));
  return {url:images[0].url,attribution:images[0].attribution};
}
