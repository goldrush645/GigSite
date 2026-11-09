import test from 'node:test';
import assert from 'node:assert/strict';
import {inferArtistName} from './artist-names.mjs';
const cases=[
['Ecca Vandal ‘Looking For People to Unfollow’ Album Tour','Ecca Vandal'],
['Katchafire 2026 Aus Tour w/ Mike Love','Katchafire'],
['THE TULLAMARINES 2026 TOUR','THE TULLAMARINES'],
['Congette + The Low Dogs + The Money','Congette'],
['Sandbox presents Kuko','Kuko'],
['Lvl 1- Vinyl Night with Special Guest Cam Undy',null],
['Vinyl Night with Special Guest Robbie Buck on Level 1',null],
['Red Hot Summer Tour',null],
['2027 Red Hot Summer Tour - JIMMY BARNES','JIMMY BARNES'],
['The UK Rod Stewart Show',null],
['The Princess Proms Concert',null],
['Foo Fighters','Foo Fighters'],
['Cry Club + Fvneral + Worm Girlz present: The Gay Agenda','Cry Club'],
['Mickey & The Monkeys - Album Launch','Mickey & The Monkeys']
];
for(const [name,expected] of cases)test(name,()=>assert.equal(inferArtistName(name),expected));
test('prefer official structured artist',()=>assert.equal(inferArtistName('ECCA VANDAL AUSTRALIAN TOUR',{attraction:'Ecca Vandal'}),'Ecca Vandal'));
test('reject a tour brand attraction but find the named headliner',()=>assert.equal(inferArtistName('2027 Red Hot Summer Tour - JIMMY BARNES',{attraction:'Red Hot Summer Tour'}),'JIMMY BARNES'));