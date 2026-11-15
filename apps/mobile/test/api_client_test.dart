import 'dart:convert';

import 'package:cop4331_mobile/api/api_client.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

// A JWT that expires in 2100, so the client treats the session as valid.
final _jwt = [
  base64Url.encode(utf8.encode('{"alg":"HS256","typ":"JWT"}')),
  base64Url.encode(utf8.encode('{"userId":"u1","exp":4102444800}')),
  'sig',
].join('.').replaceAll('=', '');

http.Response _json(Object body, [int status = 200]) =>
    http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});

void main() {
  late List<http.Request> sent;

  ApiClient clientReturning(http.Response Function(http.Request) handler) {
    return ApiClient(client: MockClient((req) async {
      sent.add(req);
      return handler(req);
    }));
  }

  setUp(() {
    sent = [];
    FlutterSecureStorage.setMockInitialValues({});
  });

  Future<ApiClient> loggedIn(http.Response Function(http.Request) handler) async {
    final api = clientReturning((req) => req.url.path == '/api/auth/login'
        ? _json({
            'accessToken': _jwt,
            'user': {'id': 'u1', 'firstName': 'Ada', 'lastName': 'Lovelace', 'totalPoints': 0},
          })
        : handler(req));
    await api.login('ada@example.com', 'password1');
    sent.clear();
    return api;
  }

  test('login posts email and password and saves the user', () async {
    final api = await loggedIn((_) => _json({}));
    final user = await api.currentUser();
    expect(user?['firstName'], 'Ada');
    expect(user?['userId'], 'u1');
  });

  test('login surfaces the server error and status', () async {
    final api = clientReturning((_) => _json({'error': 'Account email is not verified'}, 403));
    await expectLater(
      api.login('ada@example.com', 'password1'),
      throwsA(isA<ApiException>()
          .having((e) => e.statusCode, 'statusCode', 403)
          .having((e) => e.message, 'message', 'Account email is not verified')),
    );
    expect(jsonDecode(sent.single.body), {'email': 'ada@example.com', 'password': 'password1'});
  });

  test('a server outage shows a friendly message', () async {
    final api = clientReturning((_) => http.Response('<html>502 Bad Gateway</html>', 502));
    await expectLater(
      api.login('ada@example.com', 'password1'),
      throwsA(isA<ApiException>().having(
        (e) => e.message,
        'message',
        'The server is unavailable right now. Please try again shortly.',
      )),
    );
  });

  test('country search sends the bearer token and encodes the query', () async {
    final api = await loggedIn((_) => _json([
          {'id': 'FR', 'name': 'France', 'iso2': 'FR', 'iso3': 'FRA', 'continent': 'Europe'},
        ]));
    final results = await api.searchCountries('fra nce');
    expect(results.single.name, 'France');
    final req = sent.single;
    expect(req.method, 'GET');
    expect(req.url.path, '/api/countries/search');
    expect(req.url.queryParameters, {'q': 'fra nce', 'limit': '8'});
    expect(req.headers['Authorization'], 'Bearer $_jwt');
  });

  test('a round starts, takes a guess, and reports the result', () async {
    final api = await loggedIn((req) => switch (req.url.path) {
          '/api/games' => _json({'gameId': 'g1', 'maxGuesses': 10}, 201),
          '/api/games/g1/guesses' => _json({
              'country': 'France',
              'range': 'Correct',
              'solved': true,
              'guessesUsed': 1,
              'pointsEarned': 100,
            }),
          _ => _json({'error': 'Not found'}, 404),
        });
    final game = await api.startGame();
    expect(game.gameId, 'g1');
    expect(game.maxGuesses, 10);

    final result = await api.guess('g1', 'FR');
    expect(result.solved, isTrue);
    expect(result.pointsEarned, 100);
    expect(jsonDecode(sent.last.body), {'countryId': 'FR'});
  });

  test('a finished round includes the answer', () async {
    final api = await loggedIn((_) => _json({
          'gameId': 'g1',
          'status': 'lost',
          'guesses': [
            {
              'countryId': 'DE',
              'country': 'Germany',
              'range': '500–1,500 km',
              'distance': 520,
              'direction': 'E',
              'at': '2026-11-14T00:00:00Z',
            },
          ],
          'maxGuesses': 10,
          'guessesUsed': 10,
          'pointsEarned': 0,
          'surrendered': true,
          'answer': 'Poland',
        }));
    final game = await api.getGame('g1');
    expect(game.status, 'lost');
    expect(game.answer, 'Poland');
    expect(game.surrendered, isTrue);
    expect(game.guesses.single.range, '500–1,500 km');
    expect(game.guesses.single.distance, 520);
    expect(game.guesses.single.direction, 'E');
  });

  test('giving up posts to the give-up route', () async {
    final api = await loggedIn((req) => switch (req.url.path) {
          '/api/games/g1/give-up' => _json({'gameId': 'g1'}),
          _ => _json({'error': 'Not found'}, 404),
        });
    await api.giveUp('g1');
    expect(sent.last.method, 'POST');
    expect(sent.last.url.path, '/api/games/g1/give-up');
  });

  test('a finished round also parses the database-shaped response', () async {
    final api = await loggedIn((_) => _json({
          'gameId': 'g1',
          'status': 'LOST',
          'guesses': [
            {'countryId': 'DE', 'guessName': 'Germany', 'range': '500–1,500 km'},
          ],
          'maxGuesses': 10,
          'guessesUsed': 10,
          'pointsEarned': 0,
          'targetCountry': 'Poland',
        }));
    final game = await api.getGame('g1');
    expect(game.status, 'lost');
    expect(game.answer, 'Poland');
    expect(game.guesses.single.country, 'Germany');
  });

  test('leaderboard parses entries and page count', () async {
    final api = await loggedIn((_) => _json({
          'entries': [
            {'rank': 1, 'userId': 'u1', 'firstName': 'Ada', 'lastName': 'L', 'totalPoints': 250, 'gamesWon': 3},
          ],
          'page': 1,
          'limit': 20,
          'total': 41,
        }));
    final page = await api.leaderboard();
    expect(page.entries.single.totalPoints, 250);
    expect(page.pageCount, 3);
  });

  test('a 401 on a protected route logs the user out', () async {
    final api = await loggedIn((_) => _json({'error': 'Unauthorized'}, 401));
    await expectLater(
      api.startGame(),
      throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 401)),
    );
    expect(await api.currentUser(), isNull);
  });
}
