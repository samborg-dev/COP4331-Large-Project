import 'package:flutter/material.dart';

import '../api/models.dart';

// Mirrors apps/web/src/components/countryHighlights.ts so web and mobile
// color guesses and match country names the same way.

const correctColor = Color(0xFF66D99A);

const rangeColors = <String, Color>{
  '< 500 km': Color(0xFFE62932),
  '500–1,500 km': Color(0xFFD9684F),
  '1,500–3,000 km': Color(0xFFD5C56D),
  '3,000–6,000 km': Color(0xFF80A9D4),
  '> 6,000 km': Color(0xFF747FC5),
};

/// Hotter colors mean the guess is closer to the mystery country.
Color guessColor(String range) =>
    range == 'Correct' ? correctColor : rangeColors[range] ?? const Color(0xFF747FC5);

const _aliases = {
  'united states': 'united states of america',
  'usa': 'united states of america',
  'tanzania': 'united republic of tanzania',
  'serbia': 'republic of serbia',
  'timor leste': 'east timor',
  'swaziland': 'eswatini',
  'cote d ivoire': 'ivory coast',
  'cape verde': 'cabo verde',
  'vatican city': 'vatican',
  'holy see': 'vatican',
  'micronesia': 'federated states of micronesia',
  'bahamas': 'the bahamas',
  'congo': 'republic of the congo',
  'congo republic': 'republic of the congo',
  'dr congo': 'democratic republic of the congo',
  'congo democratic republic': 'democratic republic of the congo',
  'congo drc': 'democratic republic of the congo',
  'russian federation': 'russia',
  'brunei darussalam': 'brunei',
  'czech republic': 'czechia',
  'turkiye': 'turkey',
};

const _accents = {
  'á': 'a', 'à': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
  'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
  'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
  'ó': 'o', 'ò': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
  'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
  'ç': 'c', 'ñ': 'n', 'ý': 'y',
};

/// A normalized key so "Côte d'Ivoire", "cote d ivoire" and "Ivory Coast"
/// all find the same shape.
String countryKey(String name) {
  final folded = name.toLowerCase().split('').map((c) => _accents[c] ?? c).join();
  final key = folded.replaceAll(RegExp('[^a-z0-9]+'), ' ').trim();
  return _aliases[key] ?? key;
}

/// The guesses to highlight, plus the answer in green once it's revealed.
List<Guess> withRevealedAnswer(List<Guess> guesses, String? answer) {
  if (answer == null) return guesses;
  final key = countryKey(answer);
  return [
    ...guesses.where((g) => countryKey(g.country) != key),
    Guess(country: answer, range: 'Correct'),
  ];
}
