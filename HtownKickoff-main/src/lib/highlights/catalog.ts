import type { EventType, Sport, Weights } from './types';

/**
 * Event-type importance (goal > red card > shot …). A transparent heuristic prior,
 * combined with observed video evidence in the sports-importance signal.
 */
export const eventCatalog: Record<EventType, { label: string; importance: number; keywords: string[] }> = {
  goal: { label: 'Goal', importance: 1, keywords: ['goal', 'scores', 'scored', 'equaliser', 'equalizer', 'winner'] },
  penalty: { label: 'Penalty', importance: 0.9, keywords: ['penalty', 'pen', 'spot kick'] },
  red_card: { label: 'Red card', importance: 0.9, keywords: ['red card', 'sent off', 'red'] },
  big_chance: { label: 'Big chance', importance: 0.65, keywords: ['chance', 'miss', 'missed', 'woodwork', 'post', 'bar'] },
  save: { label: 'Save', importance: 0.6, keywords: ['save', 'saved', 'keeper', 'goalkeeper'] },
  shot: { label: 'Shot', importance: 0.45, keywords: ['shot', 'strike', 'effort'] },
  yellow_card: { label: 'Yellow card', importance: 0.4, keywords: ['yellow', 'booked', 'booking'] },
  foul: { label: 'Foul', importance: 0.3, keywords: ['foul', 'tackle', 'challenge'] },
  celebration: { label: 'Celebration', importance: 0.5, keywords: ['celebrate', 'celebration', 'scenes'] },
  crowd_reaction: { label: 'Crowd reaction', importance: 0.35, keywords: ['crowd', 'fans', 'stadium', 'atmosphere'] },
  player_reaction: { label: 'Player reaction', importance: 0.35, keywords: ['reaction', 'frustration', 'disbelief'] },
  substitution: { label: 'Substitution', importance: 0.15, keywords: ['sub', 'substitution', 'comes on'] },
  dunk: { label: 'Dunk', importance: 0.7, keywords: ['dunk', 'slam', 'jam'] },
  three_pointer: { label: 'Three-pointer', importance: 0.6, keywords: ['three', '3pt', 'triple', 'from deep'] },
  block: { label: 'Block', importance: 0.55, keywords: ['block', 'rejected', 'swat'] },
  assist: { label: 'Assist', importance: 0.45, keywords: ['assist', 'dime', 'pass'] },
  other: { label: 'Key moment', importance: 0.25, keywords: [] },
};

/** TwelveLabs search queries per sport (diagram step 4: goals, cards, saves, reactions …). */
export const defaultQueries: Record<Sport, { type: EventType; text: string }[]> = {
  Soccer: [
    { type: 'goal', text: 'Goal scored, the ball goes into the net' },
    { type: 'big_chance', text: 'Big chance or near miss, shot just wide or off the post' },
    { type: 'save', text: 'Goalkeeper makes a save' },
    { type: 'red_card', text: 'Referee shows a red card' },
    { type: 'yellow_card', text: 'Referee shows a yellow card' },
    { type: 'foul', text: 'Hard foul or penalty appeal' },
    { type: 'celebration', text: 'Players celebrate together' },
    { type: 'crowd_reaction', text: 'Crowd reaction, fans cheering in the stands' },
  ],
  Basketball: [
    { type: 'dunk', text: 'Slam dunk' },
    { type: 'three_pointer', text: 'Three-point shot goes in' },
    { type: 'block', text: 'Blocked shot' },
    { type: 'assist', text: 'Spectacular assist or pass' },
    { type: 'celebration', text: 'Players celebrate together' },
    { type: 'crowd_reaction', text: 'Crowd reaction, fans cheering in the arena' },
  ],
};

/** Diagram step 7 example weights; quality & diversity is tunable from 0 to 0.05. */
export const defaultWeights: Weights = { sports: 0.3, social: 0.3, emotion: 0.2, controversy: 0.15, audience: 0.05, quality: 0.05 };

export const scoringPresets = [
  { id: 'balanced', name: 'Balanced', description: 'The diagram’s default weights.', weights: defaultWeights },
  { id: 'big_plays', name: 'Big plays', description: 'Sporting importance counts most.', weights: { ...defaultWeights, sports: 0.5, social: 0.15, controversy: 0.1 } },
  { id: 'emotion', name: 'Emotion & reactions', description: 'Player and crowd emotion counts most.', weights: { ...defaultWeights, sports: 0.25, social: 0.15, emotion: 0.4 } },
  { id: 'fan_response', name: 'Fan response', description: 'Measured X engagement counts most.', weights: { ...defaultWeights, sports: 0.2, social: 0.5, emotion: 0.15, controversy: 0.1 } },
] as const;
export type ScoringPresetId = typeof scoringPresets[number]['id'];

export function presetWeights(id: string): Weights {
  const preset = scoringPresets.find(item => item.id === id);
  if (!preset) throw new Error('Choose a supported scoring priority.');
  return { ...preset.weights };
}

export function eventLabel(type: EventType) {
  return eventCatalog[type].label;
}
