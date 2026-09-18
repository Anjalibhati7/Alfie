/**
 * Discussion themes for a finished session, derived on the device.
 *
 * These are drawn only from words the user actually said during the session, so
 * the Field Log can show what the conversation was about without storing a
 * transcript or sending anything anywhere. This is a simple word-frequency
 * heuristic, not a summariser; it is deliberately predictable and offline.
 */

import type { ConversationTurn } from '../realtime/client';
import type { JournalTheme } from './storage';

const STOP_WORDS = new Set([
  'about',
  'above',
  'after',
  'again',
  'against',
  'almost',
  'along',
  'also',
  'although',
  'always',
  'among',
  'another',
  'anything',
  'around',
  'because',
  'become',
  'been',
  'before',
  'being',
  'below',
  'beside',
  'better',
  'between',
  'both',
  'cannot',
  'could',
  'does',
  'doing',
  'done',
  'down',
  'during',
  'each',
  'either',
  'else',
  'even',
  'ever',
  'every',
  'from',
  'getting',
  'going',
  'gonna',
  'have',
  'having',
  'here',
  'hers',
  'herself',
  'himself',
  'into',
  'isn',
  'itself',
  'just',
  'kind',
  'know',
  'like',
  'little',
  'look',
  'looking',
  'made',
  'make',
  'many',
  'maybe',
  'might',
  'more',
  'most',
  'much',
  'must',
  'myself',
  'never',
  'nothing',
  'often',
  'only',
  'other',
  'over',
  'own',
  'perhaps',
  'pretty',
  'quite',
  'rather',
  'really',
  'right',
  'said',
  'same',
  'saying',
  'seem',
  'seen',
  'should',
  'since',
  'some',
  'something',
  'still',
  'such',
  'sure',
  'take',
  'than',
  'that',
  'that’s',
  'thats',
  'their',
  'them',
  'themselves',
  'then',
  'there',
  'there’s',
  'these',
  'they',
  'thing',
  'things',
  'think',
  'this',
  'those',
  'though',
  'thought',
  'through',
  'together',
  'under',
  'until',
  'very',
  'want',
  'well',
  'were',
  'what',
  'what’s',
  'when',
  'where',
  'which',
  'while',
  'will',
  'with',
  'without',
  'would',
  'yeah',
  'your',
  'yourself',
]);

function tokenise(text: string): { word: string; sentence: string }[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const found: { word: string; sentence: string }[] = [];
  for (const sentence of sentences) {
    const words = sentence.toLowerCase().match(/[a-z][a-z'’-]{3,}/g) ?? [];
    for (const word of words) {
      if (STOP_WORDS.has(word)) continue;
      found.push({ word, sentence: sentence.trim() });
    }
  }
  return found;
}

/**
 * Returns between zero and four themes, most-mentioned first. Duplicate labels
 * are collapsed, and a theme whose label equals the label of an earlier theme is
 * dropped so the list never repeats itself.
 */
export function deriveThemes(
  turns: ConversationTurn[],
  max = 4,
): JournalTheme[] {
  const userText = turns
    .filter((turn) => turn.role === 'user')
    .map((turn) => turn.text)
    .join(' ');
  if (!userText.trim()) return [];

  const counts = new Map<string, { count: number; sentence: string }>();
  for (const { word, sentence } of tokenise(userText)) {
    const existing = counts.get(word);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(word, { count: 1, sentence });
    }
  }

  return [...counts.entries()]
    .filter(([, value]) => value.count >= 2 || counts.size <= 3)
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([word, value]) => ({
      label: word.charAt(0).toUpperCase() + word.slice(1),
      detail: value.sentence.slice(0, 160),
    }));
}
