import 'dart:convert';

import 'package:cop4331_mobile/api/api_client.dart';
import 'package:cop4331_mobile/screens/game_screen.dart';
import 'package:cop4331_mobile/screens/leaderboard_screen.dart';
import 'package:cop4331_mobile/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

// A JWT that expires in 2100, so the screens treat the session as valid.
final _jwt = [
  base64Url.encode(utf8.encode('{"alg":"HS256","typ":"JWT"}')),
  base64Url.encode(utf8.encode('{"userId":"u1","exp":4102444800}')),
  'sig',
].join('.').replaceAll('=', '');

http.Response _json(Object body, [int status = 200]) =>
    http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json; charset=utf-8'});

const _countries = [
  {'id': 'FR', 'name': 'France', 'iso2': 'FR', 'iso3': 'FRA', 'continent': 'Europe'},
  {'id': 'DE', 'name': 'Germany', 'iso2': 'DE', 'iso3': 'DEU', 'continent': 'Europe'},
];

/// A fake API where the mystery country is France and the round allows
/// [maxGuesses] guesses.
ApiClient fakeApi({int maxGuesses = 10}) {
  var used = 0;
  return ApiClient(client: MockClient((req) async {
    final path = req.url.path;
    if (path == '/api/games' && req.method == 'POST') {
      used = 0;
      return _json({'gameId': 'g1', 'maxGuesses': maxGuesses}, 201);
    }
    if (path == '/api/countries/search') {
      final q = req.url.queryParameters['q']!.toLowerCase();
      return _json(_countries.where((c) => (c['name'] as String).toLowerCase().contains(q)).toList());
    }
    if (path == '/api/games/g1/guesses') {
      used++;
      final id = jsonDecode(req.body)['countryId'];
      final solved = id == 'FR';
      return _json({
        'country': solved ? 'France' : 'Germany',
        'range': solved ? 'Correct' : '500–1,500 km',
        'solved': solved,
        'guessesUsed': used,
        if (solved) 'pointsEarned': 100,
      });
    }
    if (path == '/api/games/g1') {
      return _json({'gameId': 'g1', 'status': 'lost', 'guesses': [], 'maxGuesses': maxGuesses, 'answer': 'France'});
    }
    if (path == '/api/users/me') {
      return _json({'id': 'u1', 'firstName': 'Ada', 'lastName': 'L', 'totalPoints': 150});
    }
    if (path == '/api/leaderboard') {
      return _json({
        'entries': [
          {'rank': 1, 'userId': 'u2', 'firstName': 'Grace', 'lastName': 'Hopper', 'totalPoints': 300, 'gamesWon': 4},
          {'rank': 2, 'userId': 'u1', 'firstName': 'Ada', 'lastName': 'L', 'totalPoints': 150, 'gamesWon': 2},
        ],
        'page': 1,
        'limit': 20,
        'total': 2,
      });
    }
    return _json({'error': 'Not found'}, 404);
  }));
}

Widget _app(Widget home) => MaterialApp(
      theme: buildTheme(),
      home: home,
      routes: {'/leaderboard': (_) => const SizedBox()},
    );

Future<void> _guess(WidgetTester tester, String typed, String pick) async {
  await tester.enterText(find.byKey(const Key('country-search')), typed);
  await tester.pump(const Duration(milliseconds: 300)); // debounce
  await tester.pumpAndSettle();
  await tester.tap(find.widgetWithText(ListTile, pick));
  await tester.pump();
  await tester.ensureVisible(find.byKey(const Key('guess-button')));
  await tester.tap(find.byKey(const Key('guess-button')));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({
      'token_data': _jwt,
      'user_data': jsonEncode({'id': 'u1', 'firstName': 'Ada', 'lastName': 'L', 'totalPoints': 50}),
    });
  });

  testWidgets('a round starts and partial search suggests countries', (tester) async {
    await tester.pumpWidget(_app(GameScreen(api: fakeApi())));
    await tester.pumpAndSettle();

    expect(find.text('Guess 1 of 10'), findsOneWidget);
    expect(find.text('Hi, Ada · 50 pts'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('country-search')), 'an');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    // "an" matches the middle of both names
    expect(find.widgetWithText(ListTile, 'France'), findsOneWidget);
    expect(find.widgetWithText(ListTile, 'Germany'), findsOneWidget);
  });

  testWidgets('a wrong guess shows its distance range', (tester) async {
    await tester.pumpWidget(_app(GameScreen(api: fakeApi())));
    await tester.pumpAndSettle();

    await _guess(tester, 'ger', 'Germany');

    expect(find.text('500–1,500 km'), findsOneWidget);
    expect(find.text('Guess 2 of 10'), findsOneWidget);
  });

  testWidgets('the right guess wins and updates points', (tester) async {
    await tester.pumpWidget(_app(GameScreen(api: fakeApi())));
    await tester.pumpAndSettle();

    await _guess(tester, 'fra', 'France');

    expect(find.text('You found it!'), findsOneWidget);
    expect(find.text('Solved in 1 guess. +100 points'), findsOneWidget);
    // Total comes from GET /api/users/me after the win
    expect(find.text('Hi, Ada · 150 pts'), findsOneWidget);
  });

  testWidgets('running out of guesses reveals the answer', (tester) async {
    await tester.pumpWidget(_app(GameScreen(api: fakeApi(maxGuesses: 1))));
    await tester.pumpAndSettle();

    await _guess(tester, 'ger', 'Germany');

    expect(find.text('Out of guesses'), findsOneWidget);
    expect(find.text('The mystery country was France.'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Play again'));
    await tester.pumpAndSettle();
    expect(find.text('Guess 1 of 1'), findsOneWidget);
  });

  testWidgets('leaderboard lists players and highlights you', (tester) async {
    await tester.pumpWidget(_app(LeaderboardScreen(api: fakeApi())));
    await tester.pumpAndSettle();

    expect(find.text('Grace Hopper'), findsOneWidget);
    expect(find.text('Ada L (you)'), findsOneWidget);
    expect(find.text('300 pts'), findsOneWidget);
  });
}
