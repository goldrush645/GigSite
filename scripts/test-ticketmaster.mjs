import test from 'node:test';
import assert from 'node:assert/strict';
import {geohash,normalizeTicketmaster,mergeTicketmaster} from './sync-ticketmaster.mjs';
const future='2099-12-10';
const venue={name:'The Enmore Theatre',city:{name:'Newtown'},state:{stateCode:'NSW'},country:{countryCode:'AU'},location:{latitude:'-33.8973',longitude:'151.1749'}};
const input=(id='tm1',name='Test Artist')=>({
  id,type:'event',name,url:'https://www.ticketmaster.com.au/event/'+id,
  dates:{start:{localDate:future,localTime:'19:30:00'},status:{code:'onsale'}},
  sales:{public:{startDateTime:'2099-09-01T00:00:00Z'},presales:[{name:'Early Bird',startDateTime:'2099-08-30T00:00:00Z'}]},
  classifications:[{segment:{name:'Music'},genre:{name:'Rock'}}],
  _embedded:{venues:[venue],attractions:[{name:'Test Artist',type:'attraction'}]}
});
test('geohash output is valid and deterministic',()=>{
  assert.match(geohash(-33.8688,151.2093),/^[0-9bcdefghjkmnpqrstuvwxyz]{8}$/);
  assert.equal(geohash(-33.8688,151.2093),geohash(-33.8688,151.2093));
});
test('normalises a NSW concert and sale dates',()=>{
  const x=normalizeTicketmaster(input(),'2026-11-09T00:00:00Z');
  assert.equal(x.city,'Sydney');assert.equal(x.genre,'Rock');
  assert.equal(x.date,future);assert.equal(x.name,'Test Artist');
  assert.equal(x.stage,'soon');assert.ok(x.presaleAt);assert.ok(x.onSaleAt);
  assert.equal(x.detectedAt,'2026-11-09T00:00:00Z');
});
test('rejects untrusted links, cancelled events, and interstate shows',()=>{
  const wrongUrl=input();wrongUrl.url='https://fake-tickets.example/event/1';
  assert.equal(normalizeTicketmaster(wrongUrl),null);
  const cancelled=input();cancelled.dates.status.code='canceled';
  assert.equal(normalizeTicketmaster(cancelled),null);
  const interstate=input();interstate._embedded.venues=[{...venue,state:{stateCode:'VIC'}}];
  assert.equal(normalizeTicketmaster(interstate),null);
});
test('adds a separate provider listing for unmatched shows without removing Moshtix',()=>{
  const feed={events:[{id:'moshtix-2',name:'Other Artist',date:future,city:'Sydney',venue:'The Metro',url:'https://www.moshtix.com.au/v2/event/other/2',source:'Moshtix'}],festivals:[]};
  const fresh=normalizeTicketmaster(input(),'2026-11-09T00:00:00Z');
  const result=mergeTicketmaster(feed,[fresh]);
  assert.equal(result.feed.events.length,2);
  assert.equal(result.tally.newConcerts,1);
});
test('merges exact same concert and preserves original vendor link',()=>{
  const moshtix={id:'moshtix-1',name:'Test Artist',date:future,city:'Sydney',venue:'The Enmore Theatre',source:'Moshtix',url:'https://www.moshtix.com.au/v2/event/test/1',presale:null,sale:null};
  const newOne=normalizeTicketmaster(input(),'2026-11-09T00:00:00Z');
  const result=mergeTicketmaster({events:[moshtix],festivals:[]},[newOne]);
  assert.equal(result.feed.events.length,1);
  assert.equal(result.tally.matched,1);
  assert.equal(result.feed.events[0].url,moshtix.url);
  assert.equal(result.feed.events[0].ticketOptions?.[0].source,'Ticketmaster');
  assert.ok(result.feed.events[0].sale);
});
test('idempotent imports preserve initial detectedAt',()=>{
  const old=normalizeTicketmaster(input(),'2026-11-09T00:00:00Z');
  const fresh=normalizeTicketmaster(input(),'2026-11-10T00:00:00Z');
  const result=mergeTicketmaster({events:[old],festivals:[]},[fresh]);
  assert.equal(result.feed.events.length,1);
  assert.equal(result.feed.events[0].detectedAt,'2026-11-09T00:00:00Z');
  assert.equal(result.tally.updated,1);
});
test('preserves concerts when provider returns no records',()=>{
  const existing={events:[{id:'moshtix-1',date:future,city:'Wollongong',name:'Band'}],festivals:[]};
  const result=mergeTicketmaster(existing,[]);
  assert.equal(result.feed.events.length,1);
});
test('festival classifies separately and retains artist names',()=>{
  const f=input('fest-1','Sydney Music Festival');
  f._embedded.attractions=[{type:'attraction',name:'First Band'},{type:'attraction',name:'Second Band'}];
  const normalized=normalizeTicketmaster(f);
  assert.equal(normalized.festival,true);
  assert.equal(normalized.lineup.length,2);
});
