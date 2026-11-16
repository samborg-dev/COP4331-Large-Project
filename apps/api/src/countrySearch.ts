// Matching rules for GET /api/countries/search, kept separate so they're easy to test.

/** Lowercases and drops accents and punctuation: "Côte d'Ivoire" -> "cote d ivoire". */
export function foldName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Other names people commonly type, mapped to the name stored in the countries collection.
const aliases: Record<string, string> = {
  'ivory coast': "Côte d'Ivoire",
  usa: 'United States',
  america: 'United States',
  'united states of america': 'United States',
  uk: 'United Kingdom',
  britain: 'United Kingdom',
  'great britain': 'United Kingdom',
  england: 'United Kingdom',
  uae: 'United Arab Emirates',
  burma: 'Myanmar',
  swaziland: 'Eswatini',
  'cape verde': 'Cabo Verde',
  'east timor': 'Timor-Leste',
  holland: 'Netherlands',
  czechia: 'Czech Republic',
  turkiye: 'Turkey',
  'holy see': 'Vatican City',
  drc: 'Congo DRC',
  'democratic republic of the congo': 'Congo DRC',
  'republic of the congo': 'Congo',
  brunei: 'Brunei Darussalam',
};

// Spaces are ignored too, so "cote divoire" still finds "cote d ivoire"
const compact = (value: string) => foldName(value).replace(/ /g, '');

/**
 * True when the typed query is part of the country's name, ignoring case, accents,
 * punctuation and spaces, or part of another common name for it ("ivory" finds Côte d'Ivoire).
 */
export function matchesCountry(name: string, query: string): boolean {
  const q = compact(query);
  if (!q) return false;
  if (compact(name).includes(q)) return true;
  return Object.entries(aliases).some(([alias, target]) => target === name && compact(alias).includes(q));
}
