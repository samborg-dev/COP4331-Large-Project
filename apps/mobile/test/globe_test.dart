import 'package:cop4331_mobile/api/models.dart';
import 'package:cop4331_mobile/globe/country_colors.dart';
import 'package:cop4331_mobile/globe/country_globe.dart';
import 'package:cop4331_mobile/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('countryKey', () {
    test('ignores case, accents and punctuation', () {
      expect(countryKey("Côte d'Ivoire"), 'ivory coast');
      expect(countryKey('  FRANCE '), 'france');
    });

    test('maps common alternate names to the shape names', () {
      expect(countryKey('United States'), countryKey('United States of America'));
      expect(countryKey('Czech Republic'), countryKey('Czechia'));
      expect(countryKey('Türkiye'), countryKey('Turkey'));
    });
  });

  test('guess colors match the web app', () {
    expect(guessColor('Correct'), correctColor);
    expect(guessColor('< 500 km'), const Color(0xFFE62932));
    expect(guessColor('> 6,000 km'), const Color(0xFF747FC5));
  });

  test('the revealed answer is added in green, once', () {
    const guesses = [Guess(country: 'Germany', range: '500–1,500 km')];
    final shown = withRevealedAnswer(guesses, 'Poland');
    expect(shown.map((g) => g.country), ['Germany', 'Poland']);
    expect(shown.last.range, 'Correct');
    expect(withRevealedAnswer(guesses, null), guesses);
  });

  test('every country has a shape and a label position', () async {
    TestWidgetsFlutterBinding.ensureInitialized();
    final data = await GlobeData.load();
    expect(data.countries.length, greaterThan(200));
    for (final name in ['France', 'Brazil', 'Japan', 'Vatican', 'United States']) {
      final shape = data.countries[countryKey(name)];
      expect(shape, isNotNull, reason: name);
      expect(shape!.rings, isNotEmpty);
      expect(shape.center, hasLength(2));
    }
  });

  testWidgets('the globe draws guesses and survives spinning', (tester) async {
    await tester.runAsync(GlobeData.load);
    await tester.pumpWidget(MaterialApp(
      theme: buildTheme(),
      home: const Scaffold(
        body: SizedBox(
          width: 360,
          child: CountryGlobe(
            guesses: [Guess(country: 'Germany', range: '500–1,500 km')],
            focusCountry: 'Germany',
            answer: 'France',
          ),
        ),
      ),
    ));
    // Loading uses a background isolate, so give it real time to finish
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
    await tester.pumpAndSettle();
    expect(find.text('Loading globe…'), findsNothing);
    expect(find.byType(CustomPaint), findsWidgets);

    await tester.drag(find.byType(CountryGlobe), const Offset(-120, 60));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
