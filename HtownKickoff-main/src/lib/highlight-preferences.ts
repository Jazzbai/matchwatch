import { defaultSignalWeights, type SignalWeights } from './event-fusion';

export const highlightPriorities = [
  { id: 'balanced', name: 'Balanced', description: 'A mix of strong plays, emotion and available fan reactions.', weights: defaultSignalWeights },
  { id: 'big_plays', name: 'Big plays', description: 'Give sporting importance more influence.', weights: { sports: 0.5, social: 0.15, emotion: 0.2, controversy: 0.1, audience: 0.05 } },
  { id: 'emotion', name: 'Emotion & reactions', description: 'Give player and crowd emotion more influence.', weights: { sports: 0.25, social: 0.15, emotion: 0.4, controversy: 0.15, audience: 0.05 } },
  { id: 'fan_response', name: 'Fan response', description: 'Give observed X engagement more influence when available.', weights: { sports: 0.2, social: 0.5, emotion: 0.15, controversy: 0.1, audience: 0.05 } },
] as const;
export type HighlightPriority = typeof highlightPriorities[number]['id'];
export function priorityWeights(value: unknown = 'balanced'): SignalWeights {
  const priority = highlightPriorities.find(item => item.id === value);
  if (!priority) throw new Error('Choose a supported highlight scoring priority.');
  return { ...priority.weights };
}
