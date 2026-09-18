/**
 * Turns one session's utterances into a memory of the outing.
 *
 * A Field Log is not a transcript. This module reads the conversation that just
 * happened, keeps only the parts that describe what the person noticed and what
 * they were curious about, and returns short semantic phrases. The transcript
 * itself is never stored — the caller derives this summary and drops the turns.
 *
 * Everything here is deterministic and local. No network, no model, no
 * randomness: the same session always produces the same summary.
 *
 * The hard requirement is that junk never reaches the screen. Conversational
 * filler ("okay", "cause"), UI state words ("speaking", "listening"), and
 * low-information tokens are removed before anything is scored, so a session
 * that was mostly chatter produces fewer, or no, entries rather than noise.
 */

export type SummaryTurn = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

export type DerivedMoment = {
  /** Milliseconds from the start of the session. */
  atMs: number;
  label: string;
};

export type DerivedSummary = {
  /** "You noticed" — short observational phrases. */
  observations: string[];
  /** "Conversation themes" — sentence-case labels. */
  themes: string[];
  /** "Moments" — timestamped highlights. */
  moments: DerivedMoment[];
};

/** Words that carry no meaning about the outing. */
const BLOCKED = new Set([
  // Articles, pronouns, auxiliaries, prepositions, conjunctions.
  'about',
  'above',
  'after',
  'again',
  'against',
  'almost',
  'along',
  'already',
  'also',
  'although',
  'always',
  'among',
  'another',
  'any',
  'anyone',
  'anything',
  'are',
  'around',
  'back',
  'been',
  'before',
  'being',
  'below',
  'beside',
  'best',
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
  'further',
  'have',
  'having',
  'here',
  'hers',
  'herself',
  'himself',
  'into',
  'itself',
  'many',
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
  'others',
  'otherwise',
  'over',
  'own',
  'same',
  'shall',
  'should',
  'since',
  'some',
  'someone',
  'something',
  'sometimes',
  'still',
  'such',
  'than',
  'that',
  'thats',
  'their',
  'theirs',
  'them',
  'themselves',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'though',
  'through',
  'thus',
  'together',
  'under',
  'until',
  'upon',
  'very',
  'were',
  'what',
  'whatever',
  'when',
  'whenever',
  'where',
  'whereas',
  'which',
  'while',
  'with',
  'within',
  'without',
  'would',
  'your',
  'yours',
  'yourself',

  // Conversational filler.
  'actually',
  'ah',
  'alright',
  'anyway',
  'basically',
  'cause',
  'cos',
  'cuz',
  'er',
  'gonna',
  'gotta',
  'guess',
  'ha',
  'hey',
  'hmm',
  'huh',
  'kinda',
  'know',
  'like',
  'literally',
  'maybe',
  'mean',
  'mm',
  'nah',
  'nope',
  'obviously',
  'oh',
  'okay',
  'ok',
  'perhaps',
  'pretty',
  'probably',
  'quite',
  'really',
  'right',
  'says',
  'sorta',
  'sort',
  'sure',
  'totally',
  'uh',
  'um',
  'wanna',
  'well',
  'yeah',
  'yep',
  'yup',

  // Weak, low-information verbs and nouns.
  'bit',
  'come',
  'comes',
  'doing',
  'get',
  'gets',
  'getting',
  'give',
  'gives',
  'go',
  'goes',
  'going',
  'got',
  'keep',
  'keeps',
  'kind',
  'let',
  'lets',
  'look',
  'looks',
  'lot',
  'made',
  'make',
  'makes',
  'much',
  'need',
  'needs',
  'put',
  'puts',
  'said',
  'see',
  'sees',
  'stuff',
  'take',
  'takes',
  'taking',
  'tell',
  'tells',
  'thing',
  'things',
  'think',
  'thinks',
  'took',
  'try',
  'tries',
  'used',
  'uses',
  'want',
  'wants',
  'way',
  'ways',

  // Session, product, and UI-state words. These describe the app, not the world.
  'alfie',
  'app',
  'audio',
  'button',
  'connect',
  'connected',
  'connecting',
  'conversation',
  'discover',
  'error',
  'language',
  'listening',
  'microphone',
  'mode',
  'paused',
  'reimagine',
  'resume',
  'retry',
  'save',
  'saved',
  'screen',
  'session',
  'speak',
  'speaking',
  'start',
  'started',
  'stop',
  'stopped',
  'transcript',
  'voice',
]);

/** Tokens shorter than this carry too little information to be worth showing. */
const MIN_WORD_LENGTH = 4;

/**
 * Words that are acceptable inside a phrase but read badly at its edge.
 * "Building across" and "Empty except" are the artefacts this removes.
 */
const WEAK_EDGE = new Set([
  'above',
  'across',
  'after',
  'against',
  'along',
  'among',
  'around',
  'at',
  'before',
  'behind',
  'below',
  'beneath',
  'beside',
  'between',
  'beyond',
  'despite',
  'down',
  'during',
  'except',
  'for',
  'from',
  'in',
  'inside',
  'into',
  'near',
  'of',
  'off',
  'on',
  'onto',
  'out',
  'outside',
  'over',
  'past',
  'per',
  'plus',
  'than',
  'through',
  'to',
  'toward',
  'towards',
  'under',
  'until',
  'upon',
  'via',
  'with',
  'within',
  'without',
]);

/** Removes weak words from both ends so a phrase starts and ends on substance. */
function trimEdges(run: string[]): string[] {
  let start = 0;
  let end = run.length;
  while (start < end && WEAK_EDGE.has(run[start] ?? '')) start += 1;
  while (end > start && WEAK_EDGE.has(run[end - 1] ?? '')) end -= 1;
  return run.slice(start, end);
}

/** Observations and moment labels stay short enough to read at a glance. */
const MAX_PHRASE_WORDS = 4;

const MAX_OBSERVATIONS = 3;
const MAX_THEMES = 4;
const MAX_MOMENTS = 4;

const WORD_PATTERN = /[a-z][a-z'-]*/g;
const WORD_SPLITTER =
  /[,;:.!?—–]|\s+-\s+|\s+(?:and|but|or|so|then|because|which|that)\s+/gi;

function isSignificant(word: string): boolean {
  return word.length >= MIN_WORD_LENGTH && !BLOCKED.has(word);
}

/**
 * Consecutive runs of significant words. Splitting into runs rather than taking
 * every word is what keeps phrases readable: "tall narrow windows" survives as a
 * phrase instead of collapsing into unrelated tokens.
 */
function significantRuns(text: string): string[][] {
  const runs: string[][] = [];
  for (const clause of text.split(WORD_SPLITTER)) {
    const words = clause.toLowerCase().match(WORD_PATTERN) ?? [];
    let run: string[] = [];
    for (const word of words) {
      if (isSignificant(word)) {
        run.push(word);
      } else if (run.length > 0) {
        runs.push(run);
        run = [];
      }
    }
    if (run.length > 0) runs.push(run);
  }
  // Trim weak edges after splitting, so a clause that ends on a preposition does
  // not become a phrase that ends on one.
  return runs.map(trimEdges).filter((run) => run.length > 0);
}

/** Sentence case: capitalise the first letter only, so labels read editorially. */
function sentenceCase(phrase: string): string {
  const trimmed = phrase.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function phraseOf(run: string[]): string {
  return run.slice(0, MAX_PHRASE_WORDS).join(' ');
}

/** Two phrases are too similar if they share two or more significant words. */
function overlaps(a: string, b: string): boolean {
  const left = new Set(a.split(' '));
  const right = new Set(b.split(' '));
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared >= 2;
}

function dedupe(phrases: string[], limit: number): string[] {
  const kept: string[] = [];
  for (const phrase of phrases) {
    if (kept.some((existing) => overlaps(existing, phrase))) continue;
    kept.push(phrase);
    if (kept.length >= limit) break;
  }
  return kept;
}

/**
 * Observations come from what the user said, preferring clauses that carry two
 * or more meaningful words — those are the ones that describe something seen.
 */
function deriveObservations(turns: SummaryTurn[]): string[] {
  const candidates: { phrase: string; score: number }[] = [];
  for (const turn of turns) {
    if (turn.role !== 'user') continue;
    for (const run of significantRuns(turn.text)) {
      if (run.length < 2) continue;
      candidates.push({
        phrase: phraseOf(run),
        score: Math.min(run.length, MAX_PHRASE_WORDS),
      });
    }
  }
  const ranked = candidates
    // A stable sort keeps the earlier mention first on equal score.
    .map((candidate, index) => ({ ...candidate, index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((candidate) => sentenceCase(candidate.phrase));
  return dedupe(ranked, MAX_OBSERVATIONS);
}

/**
 * Themes are built from adjacent word pairs, not single frequent words. That is
 * the difference between "public space" and a list of disconnected tokens.
 */
function deriveThemes(turns: SummaryTurn[]): string[] {
  const pairs = new Map<string, number>();
  const singles = new Map<string, number>();

  for (const turn of turns) {
    for (const run of significantRuns(turn.text)) {
      for (let i = 0; i < run.length; i += 1) {
        const word = run[i];
        if (word) singles.set(word, (singles.get(word) ?? 0) + 1);
        const next = run[i + 1];
        if (next) {
          const pair = `${word} ${next}`;
          pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
        }
      }
    }
  }

  const rankedPairs = [...pairs.entries()]
    .filter(([, count]) => count >= 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([pair]) => pair);

  const rankedSingles = [...singles.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([word]) => word);

  const themes = dedupe([...rankedPairs, ...rankedSingles], MAX_THEMES);
  return themes.map(sentenceCase);
}

/**
 * Moments are spread across the session rather than clustered at the start, so
 * the list reads like a walk rather than a burst of early remarks.
 */
function deriveMoments(
  turns: SummaryTurn[],
  times: Map<string, number>,
): DerivedMoment[] {
  const candidates: { label: string; atMs: number; index: number }[] = [];
  turns.forEach((turn, index) => {
    if (turn.role !== 'user') return;
    const runs = significantRuns(turn.text).filter((run) => run.length >= 2);
    const run = runs.sort((a, b) => b.length - a.length)[0];
    if (!run) return;
    candidates.push({
      label: sentenceCase(phraseOf(run)),
      atMs: times.get(turn.id) ?? 0,
      index,
    });
  });

  if (candidates.length <= MAX_MOMENTS) return candidates;

  // Even sampling across the session, keeping chronological order.
  const step = candidates.length / MAX_MOMENTS;
  const picked: typeof candidates = [];
  for (let i = 0; i < MAX_MOMENTS; i += 1) {
    const candidate = candidates[Math.floor(i * step)];
    if (candidate) picked.push(candidate);
  }
  return picked.filter(
    (candidate, index) =>
      picked.findIndex((other) => other.label === candidate.label) === index,
  );
}

export function summariseSession(
  turns: SummaryTurn[],
  times: Map<string, number>,
): DerivedSummary {
  return {
    observations: deriveObservations(turns),
    themes: deriveThemes(turns),
    moments: deriveMoments(turns, times),
  };
}
