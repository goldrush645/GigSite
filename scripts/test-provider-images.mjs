import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {choosePosterImage,validatedImageUrl} from './provider-images.mjs';

const fakeUrl='https://s1.ticketm.net/dam/a/abc/example_TABLET_LANDSCAPE_3_2.jpg';
test('Ticketmaster image URL validation excludes unsafe and unrelated images',()=>{
  assert.equal(validatedImageUrl(fakeUrl),fakeUrl);
  assert.equal(validatedImageUrl('javascript:alert(1)'),null);
  assert.equal(validatedImageUrl('https://fake-ticketm.net/artist.jpg'),null);
  assert.equal(validatedImageUrl('https://s1.ticketm.net.evil.com/photo.jpg'),null);
  assert.equal(validatedImageUrl('http://s1.ticketm.net/photo.jpg'),null);
  assert.equal(validatedImageUrl('https://s1.ticketm.net/file.svg'),null);
});
test('Image picking avoids Ticketmaster generic fallback images',()=>{
  const result=choosePosterImage([
    {url:'https://s1.ticketm.net/dam/a/generic.jpg',width:1800,height:900,fallback:true},
    {url:fakeUrl,width:900,height:600,fallback:false,attribution:'Artist photographer'}
  ]);
  assert.equal(result.url,fakeUrl);
  assert.equal(result.attribution,'Artist photographer');
  assert.equal(choosePosterImage([{url:fakeUrl,width:900,height:600,fallback:true}]),null);
});
test('Image picker prefers a balanced photographic crop and rejects thumbnail-only sources',()=>{
  const result=choosePosterImage([
    {url:'https://s1.ticketm.net/wide.jpg',width:1200,height:500},
    {url:fakeUrl,width:900,height:600},
    {url:'https://s1.ticketm.net/thumb.jpg',width:100,height:100},
  ]);
  assert.equal(result.url,fakeUrl);
});
test('Frontend poster markup and scripts compile and render with real-data shape',async()=>{
  const page=await readFile('index.html','utf8');
  const source=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(source,'No app JavaScript');
  new vm.Script(source,{filename:'encore.js'});
  assert.match(page,/ENCORE POSTER PHOTOS V8/);
  assert.match(page,/poster-photo-scrim/);
  assert.match(page,/FOLLOWING FESTIVALS/);
  assert.match(page,/suggestionRowMarkup/);
  assert.match(page,/Additional verified event page/);
  const root={innerHTML:''};
  const doc={
    body:{style:{}},
    getElementById(id){return id==='app'?root:null;},
    querySelectorAll(){return []},
    querySelector(){return null},
    addEventListener(){},
    createTextNode(x){return x}
  };
  const feed={
    updatedAt:'2026-11-09T00:00:00Z',updateStatus:'provider',sources:['Moshtix','Ticketmaster'],
    events:[{
      id:'tm-test',source:'Ticketmaster',name:'Poster Test Artist',artistName:'Poster Test Artist',
      title:'Poster Test Artist — Tour',venue:'Test Hall',city:'Sydney',date:'2099-01-12',
      time:'7:00 PM',genre:'Indie',stage:'unknown',art:'art-a',short:'POSTER TEST\nARTIST',
      artistImage:fakeUrl,eventImage:fakeUrl,
      url:'https://www.ticketmaster.com.au/poster-test/event/12345',
      detectedAt:'2026-11-09T00:00:00Z'
    }],
    festivals:[{
      id:'tm-festival',source:'Ticketmaster',name:'Poster Test Festival',
      venue:'Test Park',city:'Sydney',date:'2099-02-10',date2:'2099-02-10',
      art:'art-b',short:'POSTER\nFESTIVAL',lineup:['Poster Test Artist'],
      eventImage:fakeUrl,url:'https://www.ticketmaster.com.au/poster-festival/event/54321'
    }]
  };
  const context={
    document:doc,
    window:{scrollTo(){}},
    localStorage:{getItem:()=>null,setItem(){}},
    fetch:async()=>({ok:true,json:async()=>feed}),
    URL,console,Intl,Date, setTimeout,clearTimeout
  };
  vm.runInNewContext(source,context,{filename:'encore.js'});
  for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.match(root.innerHTML,/Poster Test Artist/);
  assert.match(root.innerHTML,/class="poster-photo"/);
  assert.match(root.innerHTML,/s1.ticketm.net/);
  assert.match(root.innerHTML,/Poster Test Festival/);
  assert.match(root.innerHTML,/M[OY] ARTISTS|My Artists/);
});
