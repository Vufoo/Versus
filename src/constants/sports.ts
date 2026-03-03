export const SPORT_EMOJI: Record<string, string> = {
  'Tennis': '\u{1F3BE}',
  'Pickleball': '\u{1F952}', // pickle (pickleball)
  'Badminton': '\u{1F3F8}',
  'Ping Pong': '\u{1F3D3}',
  'Racquetball': '\u{1F4A5}',
  'Squash': '\u{1F94E}',
  'Basketball': '\u{1F3C0}',
  'Golf': '\u26F3',
  'Volleyball': '\u{1F3D0}',
};

export const SPORTS = [
  'Tennis',
  'Pickleball',
  'Badminton',
  'Ping Pong',
  'Racquetball',
  'Squash',
  'Basketball',
  'Golf',
  'Volleyball',
] as const;

export type SportName = (typeof SPORTS)[number];

/** Sports that support 2v2 format */
export const SPORTS_2V2: readonly string[] = ['Tennis', 'Ping Pong', 'Basketball'];

export function sportLabel(name: string): string {
  return `${SPORT_EMOJI[name] ?? '\u{1F3C6}'} ${name}`;
}

/** Sport scoring rules: game format [target, winBy] or 'set' for tennis-style sets */
export const SPORT_SCORING: Record<string, { target: number; winBy: number } | 'set'> = {
  Tennis: 'set',
  Pickleball: { target: 11, winBy: 2 },
  Badminton: { target: 21, winBy: 2 },
  'Ping Pong': { target: 11, winBy: 2 },
  Racquetball: { target: 15, winBy: 2 },
  Squash: { target: 11, winBy: 2 },
  Basketball: { target: 0, winBy: 0 },
  Golf: { target: 0, winBy: 0 },
  Volleyball: { target: 25, winBy: 2 },
};

/** Validates a game score for a sport. Returns error message or null if valid. */
export function validateGameScore(
  sportName: string,
  scoreChallenger: number,
  scoreOpponent: number,
): string | null {
  const rules = SPORT_SCORING[sportName];
  if (!rules || (rules !== 'set' && rules.target === 0)) return null;

  if (rules === 'set') {
    const [w, l] = scoreChallenger >= scoreOpponent ? [scoreChallenger, scoreOpponent] : [scoreOpponent, scoreChallenger];
    if (w < 6) return `Tennis: Winner must have at least 6 games (got ${w}-${l})`;
    if (w === 6 && l >= 5) return `Tennis: At 6-5 or 6-6, set must go to 7-5 or 7-6 (got ${w}-${l})`;
    if (w === 7 && l < 5) return `Tennis: 7-4 or lower is invalid; use 7-5 or 7-6 (got ${w}-${l})`;
    if (w > 7) return `Tennis: Invalid set score (got ${w}-${l})`;
    return null;
  }

  const { target, winBy } = rules;
  const [w, l] = scoreChallenger >= scoreOpponent ? [scoreChallenger, scoreOpponent] : [scoreOpponent, scoreChallenger];
  if (w < target) return `${sportName}: Winner must reach ${target} (got ${w}-${l})`;
  if (w - l < winBy) return `${sportName}: Must win by ${winBy} (got ${w}-${l})`;
  if (l >= target && w - l < winBy) return `${sportName}: Must win by ${winBy} (got ${w}-${l})`;
  return null;
}
