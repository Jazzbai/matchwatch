'use client';
import type { ReactNode } from 'react';
import { ChevronDown, Settings2 } from 'lucide-react';
import { defaultQueries, presetWeights, scoringPresets, type ScoringPresetId } from '../../../lib/highlights/catalog';
import type { EventType, HighlightPreferences, Sport } from '../../../lib/highlights/types';
import styles from '../HighlightStudio.module.css';

export type PreferenceForm = {
  sport: Sport;
  targetSeconds: number;
  preset: ScoringPresetId;
  types: EventType[];
  favoriteTeam: string;
  starPlayers: string;
  maxMoments: number;
  minGapSeconds: number;
};
export const defaultPreferenceForm = (sport: Sport = 'Soccer'): PreferenceForm => ({
  sport, targetSeconds: 60, preset: 'balanced', types: defaultQueries[sport].map(query => query.type),
  favoriteTeam: '', starPlayers: '', maxMoments: 5, minGapSeconds: 5,
});

export function toPreferences(form: PreferenceForm): HighlightPreferences {
  return {
    sport: form.sport,
    targetSeconds: form.targetSeconds,
    maxMoments: form.maxMoments,
    minGapSeconds: form.minGapSeconds,
    weights: presetWeights(form.preset),
    queries: defaultQueries[form.sport].filter(query => form.types.includes(query.type)),
    favoriteTeam: form.favoriteTeam.trim() || undefined,
    starPlayers: form.starPlayers.split(',').map(name => name.trim()).filter(Boolean).slice(0, 10),
  };
}

type Props = { form: PreferenceForm; onChange: (form: PreferenceForm) => void; disabled: boolean; children?: ReactNode };

/** Sport, length, scoring priority and audience: inputs to steps 4, 6, 7 and 9. */
export default function PreferencesCard({ form, onChange, disabled, children }: Props) {
  const set = (changes: Partial<PreferenceForm>) => onChange({ ...form, ...changes });
  const preset = scoringPresets.find(item => item.id === form.preset)!;
  return <section className={styles.card} id="preferences">
    <div className={styles.heading}><span>03</span><div><h2>Your highlight</h2><p>Set the sport, length and what should stand out.</p></div></div>
    <fieldset className={styles.choiceGroup} disabled={disabled}>
      <legend>Which sport?</legend>
      <div className={styles.choices}>{(['Soccer', 'Basketball'] as const).map(sport => <button type="button" key={sport} aria-pressed={form.sport === sport} onClick={() => onChange(defaultPreferenceForm(sport))}>{sport}</button>)}</div>
    </fieldset>
    <fieldset className={styles.choiceGroup} disabled={disabled}>
      <legend>How long should it be?</legend>
      <div className={styles.choices}>{[30, 60, 90].map(seconds => <button type="button" key={seconds} aria-pressed={form.targetSeconds === seconds} onClick={() => set({ targetSeconds: seconds })}>{seconds} sec{seconds === 60 && <small>Popular</small>}</button>)}</div>
    </fieldset>
    <fieldset className={styles.choiceGroup} disabled={disabled}>
      <legend>What should stand out?</legend>
      <div className={styles.priorityChoices}>{scoringPresets.map(item => <button type="button" key={item.id} aria-pressed={form.preset === item.id} onClick={() => set({ preset: item.id })}><strong>{item.name}</strong><small>{item.description}</small></button>)}</div>
    </fieldset>
    <details className={styles.advanced}>
      <summary><Settings2 size={15} /><span>More customization<small>{form.types.length} moment types · {preset.name} · up to {form.maxMoments} moments</small></span><ChevronDown size={15} /></summary>
      <div className={styles.detailsBody}>
        <fieldset className={styles.customGroup} disabled={disabled}>
          <legend>Moments to look for</legend>
          <p className={styles.hint}>TwelveLabs searches the video for each of these.</p>
          <div className={styles.momentChoices}>{defaultQueries[form.sport].map(query => <label key={query.type}>
            <input type="checkbox" checked={form.types.includes(query.type)} onChange={event => set({ types: event.target.checked ? [...form.types, query.type] : form.types.filter(type => type !== query.type) })} />
            <span>{query.text}</span>
          </label>)}</div>
        </fieldset>
        <fieldset className={styles.customGroup} disabled={disabled}>
          <legend>Audience</legend>
          <div className={styles.row}>
            <label>Favourite team<input value={form.favoriteTeam} maxLength={80} onChange={event => set({ favoriteTeam: event.target.value })} placeholder="Tottenham" /></label>
            <label>Star players<input value={form.starPlayers} maxLength={400} onChange={event => set({ starPlayers: event.target.value })} placeholder="Solanke, Kudus" /><small>Comma separated.</small></label>
          </div>
        </fieldset>
        <fieldset className={styles.customGroup} disabled={disabled}>
          <legend>Selection rules</legend>
          <div className={styles.row}>
            <label>Top moments<select value={form.maxMoments} onChange={event => set({ maxMoments: Number(event.target.value) })}>{[3, 4, 5, 6, 8, 10].map(n => <option key={n} value={n}>Up to {n}</option>)}</select></label>
            <label>Minimum gap between clips<select value={form.minGapSeconds} onChange={event => set({ minGapSeconds: Number(event.target.value) })}>{[0, 5, 10, 20].map(n => <option key={n} value={n}>{n} seconds</option>)}</select></label>
            <label>Total length<select value={form.targetSeconds} onChange={event => set({ targetSeconds: Number(event.target.value) })}>{[30, 60, 90, 120, 180, 300].map(n => <option key={n} value={n}>{n} seconds</option>)}</select></label>
          </div>
        </fieldset>
      </div>
    </details>
    {children}
  </section>;
}
