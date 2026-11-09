// ENCORE Ticketmaster Discovery API v2 import.
// Uses TICKETMASTER_API_KEY only on the GitHub Actions runner, never in client JS.
// See https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
import {readFile,writeFile} from 'node:fs/promises';
import {inferArtistName} from './artist-names.mjs';
import {pathToFileURL} from 'node:url';

const CENTERS=[
  {name:'Sydney',lat:-33.8688,lon:151.2093,radius:42},
  {name:'Wollongong',lat:-34.4278,lon:150.8931,radius:30},
  {name:'Newcastle',lat:-32.9283,lon:151.7817,radius:33}
];
const POSTER_STYLES=['art-a','art-b','art-c','art-d','art-e','art-f','art-g','art-h'];
const API='https://app.ticketmaster.com/discovery/v2/events.json';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const clean=x=>String(x??'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim();
const key=x=>clean(x).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const todaySydney=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const localTime=iso=>{
  if(!iso)return null;
  const d=new Date(iso);
  if(!Number.isFinite(+d))return null;
  return new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(d);
};
const poster=name=>{
  const parts=clean(name).toUpperCase().split(' ');
  return parts.length<3?parts.join(' '):parts.slice(0,Math.ceil(parts.length/2)).join(' ')+'\n'+parts.slice(Math.ceil(parts.length/2)).join(' ');
};
const genreFor=genre=>{
  const a=clean(genre).toLowerCase();
  return /electronic|dance|house|techno|trance|drum|edm|dubstep|dj/.test(a)?'Electronic':
    /rock|metal|punk|hardcore|alternative/.test(a)?'Rock':
    /indie|folk|singer.son/.test(a)?'Indie':
    /pop|hip.hop|r.b|rap|soul/.test(a)?'Pop':'Other';
};
function distanceKm(a,b,c,d){
  const R=6371,rad=x=>x*Math.PI/180,lat=rad(c-a),lon=rad(d-b);
  const h=Math.sin(lat/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(lon/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function geohash(lat,lon,length=8){
  const alphabet='0123456789bcdefghjkmnpqrstuvwxyz';
  let minLat=-90,maxLat=90,minLon=-180,maxLon=180,even=true,bits=0,chunk=0,out='';
  while(out.length<length){
    if(even){const mid=(minLon+maxLon)/2;if(lon>=mid){chunk=chunk*2+1;minLon=mid}else{chunk*=2;maxLon=mid}}
    else{const mid=(minLat+maxLat)/2;if(lat>=mid){chunk=chunk*2+1;minLat=mid}else{chunk*=2;maxLat=mid}}
    even=!even;bits++;
    if(bits===5){out+=alphabet[chunk];bits=0;chunk=0}
  }
  return out;
}
function locationFor(raw,center){
  const venue=raw?._embedded?.venues?.[0];
  if(!venue||String(venue.country?.countryCode||'').toUpperCase()!=='AU')return null;
  // NSW-only: reject explicit interstate venue classifications.
  if(venue.state?.stateCode && !['NSW','NS'].includes(venue.state.stateCode.toUpperCase()))return null;
  const lat=Number(venue.location?.latitude),lon=Number(venue.location?.longitude);
  // With valid venue coordinates, a nearby city is the source of truth.
  if(Number.isFinite(lat)&&Number.isFinite(lon)&&lat!==0&&lon!==0){
    const candidates=CENTERS.map(c=>({city:c.name,distance:distanceKm(c.lat,c.lon,lat,lon),limit:c.radius})).filter(c=>c.distance<=c.limit).sort((a,b)=>a.distance-b.distance);
    return candidates[0]?.city??null;
  }
  // Missing coordinates: accept only a precisely named target city.
  const place=clean(venue.city?.name).toLowerCase();
  return CENTERS.find(c=>c.name.toLowerCase()===place)?.name??null;
}
function isFestival(raw){
  return /\bfestival\b|\bfest\b|\bgong crawl\b/i.test(clean(raw.name));
}
function isVerifiedTicketmasterUrl(u){
  try{const x=new URL(u);return x.protocol==='https:' && /(^|\.)ticketmaster\.(com|com\.au)$/.test(x.hostname)}catch{return false}
}
export function normalizeTicketmaster(raw,now=new Date().toISOString(),cityHint=null){
  if(raw?.test||!raw?.id||!raw?.url||!isVerifiedTicketmasterUrl(raw.url))return null;
  if(raw.dates?.status?.code==='canceled')return null;
  const venue=raw?._embedded?.venues?.[0];
  const city=locationFor(raw)||(!venue&&cityHint)||null;
  const date=raw?.dates?.start?.localDate;
  if(!city||!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||date<todaySydney())return null;
  const attractions=(raw?._embedded?.attractions||[]).filter(x=>x?.type==='attraction'&&x?.name);
  const artistName=inferArtistName(raw.name,{attraction:attractions[0]?.name});
  const name=artistName||clean(raw.name).slice(0,100);
  const title=clean(raw.name).slice(0,180);
  const group=raw.classifications?.[0]||{};
  const rawGenre=group.subGenre?.name||group.genre?.name||'';
  const presales=(raw.sales?.presales||[]).filter(p=>p?.startDateTime&&Number.isFinite(+new Date(p.startDateTime))).sort((a,b)=>a.startDateTime.localeCompare(b.startDateTime));
  const presaleAt=presales[0]?.startDateTime||null;
  const onSaleAt=raw.sales?.public?.startDateTime||null;
  const status=raw.dates?.status?.code||'';
  const beforeSale=onSaleAt&&new Date(onSaleAt)>new Date(now);
  const stage=status==='onsale'&&!beforeSale?'on':beforeSale?'soon':'unknown';
  const t=raw.dates?.start?.localTime;
  const time=raw.dates?.start?.noSpecificTime||raw.dates?.start?.timeTBA||!t?'Time TBA':new Date('2000-01-01T'+t).toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit',hour12:true});
  const event={
    id:'tm-'+clean(raw.id),tmId:clean(raw.id),
    name,artistName,title,short:poster(name),tour:title,city,venue:clean(venue?.name)||'Venue TBA',
    date,time,genre:genreFor(rawGenre),stage,
    presale:localTime(presaleAt),sale:localTime(onSaleAt),
    presaleAt,onSaleAt,announced:null,detectedAt:now,
    source:'Ticketmaster',url:raw.url,
    art:POSTER_STYLES[clean(raw.id).split('').reduce((n,c)=>n+c.charCodeAt(0),0)%POSTER_STYLES.length]
  };
  if(isFestival(raw)){
    const lineup=attractions.map(a=>clean(a.name)).filter(n=>key(n)!==key(raw.name)).slice(0,100);
    return {id:event.id,tmId:event.tmId,name:title,short:poster(title),city,venue:event.venue,
      date,date2:raw.dates?.end?.localDate||date,lineup,tag:'Official Ticketmaster listing',source:'Ticketmaster',url:raw.url,art:event.art,detectedAt:now,festival:true};
  }
  return event;
}
const equalConcert=(a,b)=>{
  if(a.date!==b.date||a.city!==b.city||!a.venue||!b.venue)return false;
  const venue1=key(a.venue),venue2=key(b.venue);
  if(venue1.length<5||venue2.length<5||!(venue1===venue2||venue1.includes(venue2)||venue2.includes(venue1)))return false;
  const n1=key(a.name),n2=key(b.name);
  return n1.length>3&&n1===n2;
};
const equalFestival=(a,b)=>a.date===b.date&&a.city===b.city&&key(a.name).length>6&&key(a.name)===key(b.name);
export function mergeTicketmaster(feed,imported,now=new Date().toISOString()){
  const today=todaySydney();
  const result={...feed,events:feed.events.filter(e=>e.date>=today).map(e=>({...e})),festivals:feed.festivals.filter(f=>f.date>=today).map(f=>({...f}))};
  const tally={newConcerts:0,newFestivals:0,matched:0,updated:0};
  for(const fresh of imported){
    const list=fresh.festival?result.festivals:result.events;
    const existing=list.find(old=>old.id===fresh.id||old.tmId===fresh.tmId&&!!fresh.tmId)
      ||list.find(old=>fresh.festival?equalFestival(old,fresh):equalConcert(old,fresh));
    if(!existing){
      const {festival,...event}=fresh;
      list.push(event);
      fresh.festival?tally.newFestivals++:tally.newConcerts++;
      continue;
    }
    const isSameProvider=existing.source==='Ticketmaster'||existing.tmId===fresh.tmId;
    if(isSameProvider){
      Object.assign(existing,{...fresh,id:existing.id,detectedAt:existing.detectedAt||fresh.detectedAt});
      delete existing.festival;
      tally.updated++;
    }else{
      // Preserve preferred Moshtix URL and add an alternative official seller.
      const opts=Array.isArray(existing.ticketOptions)?existing.ticketOptions:[];
      const map=new Map(opts.filter(o=>o?.url).map(o=>[o.url,o]));
      map.set(fresh.url,{source:'Ticketmaster',url:fresh.url});
      existing.ticketOptions=[...map.values()];
      existing.presaleAt=existing.presaleAt||fresh.presaleAt||null;
      existing.onSaleAt=existing.onSaleAt||fresh.onSaleAt||null;
      existing.presale=existing.presale||fresh.presale||null;
      existing.sale=existing.sale||fresh.sale||null;
      tally.matched++;
    }
  }
  result.events.sort((a,b)=>a.date.localeCompare(b.date));
  result.festivals.sort((a,b)=>a.date.localeCompare(b.date));
  result.sources=['Moshtix','Ticketmaster'];
  result.updatedAt=now;
  result.ticketmasterUpdatedAt=now;
  result.updateStatus='provider';
  return {feed:result,tally};
}
async function fetchEvents(apiKey){
  const now=new Date().toISOString();
  const result=new Map();
  let totalRequests=0;
  for(const center of CENTERS){
    let countForCity=0;
    // Deep paging is restricted to the first 1,000 items. Max 4 x 200 per city.
    for(let page=0;page<4;page++){
      const url=new URL(API);
      for(const [key,value] of Object.entries({
        apikey:apiKey,countryCode:'AU',segmentName:'Music',
        geoPoint:geohash(center.lat,center.lon),radius:String(center.radius),unit:'km',
        startDateTime:now.replace(/\.\d{3}Z$/,'Z'),sort:'date,asc',size:'200',page:String(page),includeTest:'no'
      }))url.searchParams.set(key,value);
      const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);
      let body;
      try{
        const response=await fetch(url,{signal:controller.signal,headers:{accept:'application/json'}});
        if(!response.ok)throw Error('Ticketmaster returned HTTP '+response.status+' for '+center.name+' page '+page);
        body=await response.json();
      }finally{clearTimeout(timeout)}
      const batch=body?._embedded?.events||[];
      if(!Array.isArray(batch))throw Error('Ticketmaster returned unexpected events format');
      totalRequests++;
      for(const raw of batch){
        const event=normalizeTicketmaster(raw,now,center.name);
        if(event)result.set(event.id,event);
      }
      countForCity+=batch.length;
      const totalPages=Number(body?.page?.totalPages)||1;
      if(batch.length===0||page+1>=Math.min(totalPages,4))break;
      await wait(350);
    }
    console.log(center.name+': '+countForCity+' API listings processed');
    await wait(350);
  }
  return {events:[...result.values()],totalRequests};
}
async function main(){
  const apiKey=process.env.TICKETMASTER_API_KEY?.trim();
  if(!apiKey){console.log('Ticketmaster disabled: add TICKETMASTER_API_KEY to repository Actions secrets. Existing events retained.');return}
  const existing=JSON.parse(await readFile('data/events.json','utf8'));
  if(!Array.isArray(existing.events)||!Array.isArray(existing.festivals))throw Error('Invalid existing feed, refusing overwrite');
  const {events,totalRequests}=await fetchEvents(apiKey);
  if(events.length===0)throw Error('Ticketmaster returned zero matching events. Existing feed retained.');
  const {feed,tally}=mergeTicketmaster(existing,events);
  await writeFile('data/events.json',JSON.stringify(feed,null,2)+'\n');
  console.log('Ticketmaster API calls: '+totalRequests+'; matches from API '+events.length+'; new '+tally.newConcerts+' concerts, '+tally.newFestivals+' festivals, '+tally.matched+' cross-provider matches, '+tally.updated+' updates');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(e=>{console.error('Ticketmaster sync failed: '+e.message);process.exitCode=1});
}
