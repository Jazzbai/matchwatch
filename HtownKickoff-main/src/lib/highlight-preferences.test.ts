import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightPriorities, priorityWeights } from './highlight-preferences';
import { defaultSignalWeights, type FusionInputs } from './event-fusion';
import { rankViralMoments } from './viral-ranking';
import type { HighlightEvent } from './highlight-plan';
const input: FusionInputs = { matchId:'fixture', stats:[], posts:[], anchors:[], videoUtc:'', reactionDelay:15, tolerance:0 };
function event(id: string, sports: number, emotion: number): HighlightEvent {
  return { id, label:id, start:1, end:8, confidence:0, importance:0, context:0, audio:0, reaction:0, preference:0,
    jev:{ candidate_id:id, event:id, importance_estimate:sports, excitement_estimate:null, watchability_estimate:null, emotional_intensity:{score:emotion,evidence:'Synthetic preference test fixture.'}, controversy_surprise:{score:null,evidence:'Unavailable.'}, match_context:null, duplicate_of:null, suggested_start:1, suggested_end:8, recommend_include:true, needs_review:false, reason:'Synthetic fixture.', } };
}
test('balanced preserves the specified defaults and each priority uses normalized bounded weights',()=>{
  assert.deepEqual(priorityWeights(),defaultSignalWeights);
  for(const priority of highlightPriorities){const weights=priorityWeights(priority.id);assert.ok(Math.abs(Object.values(weights).reduce((a,b)=>a+b,0)-1)<1e-10);assert.ok(Object.values(weights).every(v=>Number.isFinite(v)&&v>=0&&v<=1));}
  const copy=priorityWeights();copy.sports=0;assert.equal(priorityWeights().sports,.3);
  for(const invalid of ['unknown','__proto__',null,{},0])assert.throws(()=>priorityWeights(invalid));
});
test('changing the scoring priority can change the selected verified moment, including the backend ranking weights',()=>{
  const candidates=[event('big_play',.95,.1),event('emotional_play',.5,.7)];
  const balanced=rankViralMoments(candidates,input,20,10,priorityWeights('balanced'));
  const emotion=rankViralMoments(candidates,input,20,10,priorityWeights('emotion'));
  assert.equal(balanced.moments[0].event_id,'big_play');assert.equal(emotion.moments[0].event_id,'emotional_play');
  assert.equal(emotion.weights.emotion,.4);assert.equal(emotion.moments[0].scores.social,null);
  assert.ok(Math.abs(emotion.moments[0].effective_weights.emotion-.4/.65)<1e-10);
});
test('scoring customization cannot bypass duplicate and uncertain-event checks',()=>{
  const uncertain=event('uncertain',1,1);uncertain.jev!.needs_review=true;
  const duplicate=event('duplicate',1,1);duplicate.jev!.duplicate_of='good';
  for(const preset of highlightPriorities)assert.deepEqual(rankViralMoments([event('good',.7,.4),uncertain,duplicate],input,20,10,priorityWeights(preset.id)).moments.map(m=>m.event_id),['good']);
});
