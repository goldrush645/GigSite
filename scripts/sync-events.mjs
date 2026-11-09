// ENCORE: once-daily, server-side Moshtix event import.
// Docs: https://developer.moshtix.com/docs/our-api/
// Do not add API keys or use browser-side polling.
import {readFile,writeFile} from 'node:fs/promises';

const folder='data/';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const clean=x=>String(x||'').trim().replace(/[<>]/g,'').replace(/\s+/g,' ');
const suburbs={
  Sydney:['sydney','chippendale','newtown','enmore','erskineville','marrickville','surry hills','darlington','redfern','darlinghurst','ultimo','haymarket','pyrmont','camperdown','glebe','darling harbour','barangaroo','rozelle','balmain','ashfield','stanmore','annandale','bondi','paddington','moore park','centennial park','mascot','alexandria','zetland','homebush','olympic park','north sydney','sydney olympic park','waterloo','tempe','botany','st peters','randwick','coogee','potts point','leichhardt','the rocks','kingsford'],
  Wollongong:['wollongong','north wollongong','fairy meadow','towradgi','corrimal','woonona','bulli','thirroul','unanderra','figtree','dapto','kiama'],
  Newcastle:['newcastle','hamilton','mayfield','merewether','newcastle west','the junction','islington','adamstown','cooks hill','carrington','wallsend','callaghan','broadmeadow','charlestown']
};
function cityFor(locality){
  const k=clean(locality).toLowerCase();
  return Object.keys(suburbs).find(city=>suburbs[city].includes(k))||null;
}
function genreFor(value){
  const s=clean(value).toLowerCase();
  return /electronic|dance|dj|house|techno|trance|drum|edm|club/.test(s)?'Electronic':/rock|metal|punk|hardcore|alternative/.test(s)?'Rock':/indie|folk/.test(s)?'Indie':/pop|r&b|hip hop|hip-hop/.test(s)?'Pop':'Other';
}
function localDateTime(utc){
  const d=new Date(utc);
  if(Number.isNaN(+d))return null;
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'numeric',minute:'2-digit',hour12:true}).formatToParts(d).map(x=>[x.type,x.value]));
  return {date:[p.year,p.month,p.day].join('-'),time:p.hour+':'+p.minute+' '+p.dayPeriod.toUpperCase()};
}
function slug(s){
  return clean(s).toLowerCase().replace(/([^0-9 a-zA-Z-\u4e00-\u9eff])+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
}
function artistTitle(s){
  return clean(s.split(/\s[|–—]\s|\s-\s|\s+w\/\s|\s+feat(?:uring)?\.?\s/i)[0]).slice(0,90);
}
function poster(s){
  const a=clean(s).toUpperCase().split(' ');
  return a.length<3?a.join(' '):a.slice(0,Math.ceil(a.length/2)).join(' ')+'\n'+a.slice(Math.ceil(a.length/2)).join(' ');
}
const idFromUrl=u=>String(u||'').match(/\/(\d+)(?:\?.*)?$/)?.[1]||null;
function normalize(raw,seen,now,today){
  const id=Number(raw?.id),title=clean(raw?.name),dt=localDateTime(raw?.startDate),city=cityFor(raw?.venue?.address?.locality);
  if(!Number.isSafeInteger(id)||!title||!dt||!city||dt.date<today)return null;
  const u='https://www.moshtix.com.au/v2/event/'+slug(title)+'/'+id;
  const previous=seen.get(String(id));
  const obj={id:'moshtix-'+id,name:artistTitle(title),title,short:poster(artistTitle(title)),tour:clean(raw.teaser)||title,city,venue:clean(raw.venue?.name)||'See event page',date:dt.date,time:dt.time,genre:genreFor(raw.genre?.name),stage:'unknown',presale:null,sale:null,announced:null,detectedAt:previous?.detectedAt??now,source:'Moshtix',url:u,art:'art-'+String.fromCharCode(97+id%8)};
  if(/\bfestival\b|\bfest\b|gong crawl/i.test(title))return {id:obj.id,name:title,short:poster(title),city,venue:obj.venue,date:dt.date,date2:dt.date,lineup:[],tag:'Official event',source:'Moshtix',url:u,art:obj.art,festival:true};
  return obj;
}
async function fetchMoshtix(){
  const result=[];
  for(let page=0;page<8;page++){
    const query='query { viewer { getEvents(pageIndex: '+page+', pageSize: 30, sortBy: STARTDATE, sortByDirection: ASC) { pageInfo { hasNextPage } items { id name teaser startDate venue { name address { locality } } genre { name } } } } }';
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    let response;
    try{response=await fetch('https://api.moshtix.com/v1/graphql',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query}),signal:controller.signal});}
    finally{clearTimeout(timer);}
    if(!response.ok)throw Error('Moshtix HTTP '+response.status);
    const json=await response.json();
    if(json.errors?.length)throw Error('Moshtix GraphQL: '+JSON.stringify(json.errors).slice(0,600));
    const block=json.data?.viewer?.getEvents;
    if(!Array.isArray(block?.items))throw Error('Moshtix response is missing getEvents.items');
    result.push(...block.items);
    if(!block.pageInfo?.hasNextPage)break;
    await sleep(450);
  }
  return result;
}
async function main(){
  const [seed,previous]=await Promise.all(['seed.json','events.json'].map(name=>readFile(folder+name,'utf8').then(JSON.parse)));
  const input=await fetchMoshtix();
  if(!input.length)throw Error('Zero API results; preserving existing file');
  const now=new Date().toISOString();
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const originals=[...seed.events,...seed.festivals,...previous.events,...previous.festivals];
  const seen=new Map(originals.map(e=>[idFromUrl(e.url),e]).filter(([id])=>id));
  const imported=input.map(x=>normalize(x,seen,now,today)).filter(Boolean);
  const merge=(baseline,additions)=>{
    const m=new Map();
    for(const e of baseline)if(e.date>=today)m.set(idFromUrl(e.url)||e.id,e);
    for(const e of additions){
      const k=idFromUrl(e.url)||e.id,p=m.get(k);
      m.set(k,p?{...e,id:p.id,detectedAt:p.detectedAt||null,lineup:p.lineup||e.lineup}:e);
    }
    return [...m.values()].sort((a,b)=>a.date.localeCompare(b.date));
  };
  const events=merge([...seed.events,...previous.events],imported.filter(e=>!e.festival)).filter(e=>!/\bfestival\b|\bfest\b|gong crawl/i.test(e.title||e.name));
  const festivals=merge([...seed.festivals,...previous.festivals],imported.filter(e=>e.festival).map(({festival,...e})=>e));
  if(!events.length&&!festivals.length)throw Error('No matching NSW concerts, refusing empty overwrite');
  await writeFile(folder+'events.json',JSON.stringify({updatedAt:now,source:'Moshtix public API + curated official source links',updateStatus:'provider',events,festivals},null,2)+'\n');
  console.log('Fetched '+input.length+' events. NSW matches '+imported.length+'. Published '+events.length+' concerts and '+festivals.length+' festivals.');
}
main().catch(e=>{console.error(e);process.exitCode=1});