export const SPORT_EMOJI: Record<string, string> = {
  'Tennis': '\u{1F3BE}',
  'Pickleball': '\u{1F3D3}',
  'Badminton': '\u{1F3F8}',
  'Ping Pong': '\u{1F3D3}',
  'Racquetball': '\u{1F4A5}',
  'Squash': '\u{1F3BE}',
  'Basketball': '\u{1F3C0}',
  'Bowling': '\u{1F3B3}',
  'Golf': '\u26F3',
  'Boxing': '\u{1F94A}',
  'Wrestling': '\u{1F93C}',
  'Pool': '\u{1F3B1}',
  'Spikeball': '\u{1F3D0}',
  'Track': '\u{1F3C3}',
};

export const SPORTS = [
  'Tennis',
  'Pickleball',
  'Badminton',
  'Ping Pong',
  'Racquetball',
  'Squash',
  'Basketball',
  'Bowling',
  'Golf',
  'Boxing',
  'Wrestling',
  'Pool',
  'Spikeball',
  'Track',
] as const;

export type SportName = (typeof SPORTS)[number];

export function sportLabel(name: string): string {
  return `${SPORT_EMOJI[name] ?? '\u{1F3C6}'} ${name}`;
}
