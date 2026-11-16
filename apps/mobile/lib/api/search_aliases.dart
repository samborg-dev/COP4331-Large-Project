import '../globe/country_colors.dart';

// The server matches the letters typed against the stored name, so "cote" misses
// "Côte d'Ivoire" and "ivory coast" or "usa" find nothing. For names like these
// the app also searches for a word the server does match.
const _alsoSearch = {
  'cote d ivoire': 'Ivoire',
  'ivory coast': 'Ivoire',
  'usa': 'United States',
  'america': 'United States',
  'uk': 'United Kingdom',
  'britain': 'United Kingdom',
  'great britain': 'United Kingdom',
  'england': 'United Kingdom',
  'uae': 'United Arab Emirates',
  'burma': 'Myanmar',
  'swaziland': 'Eswatini',
  'cape verde': 'Cabo Verde',
  'east timor': 'Timor',
  'holland': 'Netherlands',
  'czechia': 'Czech',
  'turkiye': 'Turkey',
  'holy see': 'Vatican',
  'drc': 'Congo DRC',
};

/// Extra searches to run alongside [typed], e.g. "ivory" -> ["Ivoire"].
List<String> extraSearchesFor(String typed) {
  final q = foldName(typed);
  if (q.length < 2) return const [];
  return {
    for (final MapEntry(key: name, value: search) in _alsoSearch.entries)
      if (name.startsWith(q) || q.startsWith(name)) search,
  }.toList();
}
