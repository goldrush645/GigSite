// Conservative event-title parsing. Titles are not automatically artist names.
// Prefer a structured performer when provided by a licensed event API.
const clean = x => String(x ?? '').replace(/\s+/g,' ').trim();
const unwantedEvent = /\b(?:trivia|competition|proms|festival|fest|club night|dance party|two.day pass|tickets?|workshop|fundraiser|exhibition|showcase|nights?|experience|burlesque|afterparty)\b/i;
const groupBrand = /^(?:red hot summer tour|the rockwiz christmas show|the princess proms concert|ministry of sound|vinyl night|lvl\s*1\b|show stoppers|tipsy rodeo|sydney music festival|the rock orchestra by candlelight|the uk rod stewart show)\b/i;
const weakEnding = /\b(?:christmas show|presents|invites|club night|tour package|tour|show|tribute|showcase|concert|experience|live with full band)\b/i;
const cap = s => clean(s).replace(/^['“”‘’]|['“”‘’]$/g,'').replace(/\s*[-–—|:]\s*$/,'').slice(0,100);
function isLikelyArtist(s) {
  if (!s || s.length<2 || s.length>80 || unwantedEvent.test(s) || groupBrand.test(s) || weakEnding.test(s)) return false;
  if (/\b(?:presents?|invites?|with special guest|at the|ft\.|featuring)\b/i.test(s)) return false;
  return true;
}
export function inferArtistName(title,{attraction=null}={}) {
  const raw=clean(title);
  const struct=cap(attraction);
  if (isLikelyArtist(struct)) return struct;
  if (!raw) return null;
  // Headlining performers of a package tour can follow the event name.
  if (/^(?:(?:19|20)\d{2}\s+)?red hot summer tour\b/i.test(raw)) {
    const m=raw.match(/\s[-–—|:]\s+(.+)$/);
    if(m && isLikelyArtist(cap(m[1]))) return cap(m[1]);
    return null;
  }
  if (/^(?:[\w .&'-]+\s+)?(?:presents|invites)\b/i.test(raw)) {
    const match=raw.match(/\b(?:presents|invites)\b\s*:?\s+(.+?)(?:\s+\(\w{2,}\)|\s*\[|\s*\+|$)/i);
    if (match && isLikelyArtist(cap(match[1]))) return cap(match[1]);
  }
  if (groupBrand.test(raw) || /^(?:trivia|vinyl night|no flowers mahjong|club country|show stoppers|dig[i:]|★)/i.test(raw)) return null;
  const warmup=raw.match(/^(.+?)\s+warm[ -]?up show\b/i);
  if(warmup && isLikelyArtist(cap(warmup[1])))return cap(warmup[1]);
  const bill=raw.match(/^(.+?)\s+\+\s+[^+]+/);
  if(bill && isLikelyArtist(cap(bill[1]))) return cap(bill[1]);
  const quoted=raw.match(/^(.+?)\s+[‘“'"](.*?)[’”'"]\s+(?:album\s+)?(?:tour|album\s+launch|ep\s+launch|single\s+(?:release|launch))\b/i);
  if(quoted && isLikelyArtist(cap(quoted[1]))) return cap(quoted[1]);
  for(const re of [
    /^(.+?)\s+(?:19|20)\d{2}\s+(?:aus(?:tralian)?\s+|national\s+|world\s+)?tour\b/i,
    /^(.+?)\s+(?:national|australian|world|east coast|headline)\s+tour\b/i,
    /^(.+?)\s+(?:live\s+with\s+full\s+band|live\s+in\s+(?:sydney|wollongong|newcastle))$/i,
    /^(.+?)\s+(?:album|ep|single)\s+(?:launch|release)\b/i
  ]){
    const m=raw.match(re);
    if(m && isLikelyArtist(cap(m[1])))return cap(m[1]);
  }
  const candidate=raw.split(/\s+[|–—]\s+|\s+-\s+|\s+\/\/\s+/)[0];
  if(candidate!==raw && isLikelyArtist(cap(candidate))) return cap(candidate);
  if(raw.length<60 && !/\b(?:tour|presents|invites|special guest|live|launch|release|tribute|show|orchestra by candlelight|ft\.|feat\.|festival|fest|experience|new album)\b/i.test(raw) && isLikelyArtist(raw))return cap(raw);
  return null;
}
