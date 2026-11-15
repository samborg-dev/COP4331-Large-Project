import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:jwt_decoder/jwt_decoder.dart';

import 'models.dart';

/// An error response from the API: `{ "error": "..." }` plus the HTTP status.
class ApiException implements Exception {
  ApiException(this.statusCode, this.message);

  final int statusCode;
  final String message;

  @override
  String toString() => message;
}

/// Mirrors the contracts in packages/shared (apps/api REST endpoints).
///
/// Override the server with: flutter run --dart-define=API_URL=https://your-domain.com:5000
class ApiClient {
  static const _envUrl = String.fromEnvironment('API_URL');
  static const _storage = FlutterSecureStorage();
  static const _tokenKey = 'token_data';
  static const _userKey = 'user_data';

  ApiClient({http.Client? client}) : _http = client ?? http.Client();

  final http.Client _http;

  static String get baseUrl {
    if (_envUrl.isNotEmpty) return _envUrl;
    // The Android emulator reaches the host machine at 10.0.2.2
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:5000';
    }
    return 'http://localhost:5000';
  }

  /// Sends a request and returns the HTTP status with the decoded body
  /// (a map, a list, or null for a non-JSON body such as Express's HTML 404).
  /// With [auth], sends the saved JWT and treats a 401 as an expired session:
  /// it logs out and throws [ApiException] with status 401.
  Future<(int, dynamic)> _request(
    String method,
    String route, {
    Map<String, dynamic>? body,
    bool auth = false,
  }) async {
    final headers = <String, String>{
      if (body != null) 'Content-Type': 'application/json',
    };
    if (auth) {
      final t = await token;
      if (t != null) headers['Authorization'] = 'Bearer $t';
    }
    final request = http.Request(method, Uri.parse('$baseUrl/$route'))..headers.addAll(headers);
    if (body != null) request.body = jsonEncode(body);
    final res = await http.Response.fromStream(
      await _http.send(request).timeout(const Duration(seconds: 15)),
    );
    if (auth && res.statusCode == 401) {
      await logout();
      throw ApiException(401, 'Your session expired. Please log in again.');
    }
    dynamic json;
    try {
      json = jsonDecode(res.body);
    } on FormatException {
      // not JSON; leave it null
    }
    return (res.statusCode, json);
  }

  /// POSTs to a public route and returns the status with the body as a map.
  Future<(int, Map<String, dynamic>)> _send(String route, Map<String, dynamic> body) async {
    final (status, json) = await _request('POST', route, body: body);
    return (status, json is Map<String, dynamic> ? json : <String, dynamic>{});
  }

  /// Calls a protected route, throws [ApiException] on any error, and
  /// returns the decoded body.
  Future<dynamic> _authed(String method, String route, [Map<String, dynamic>? body]) async {
    final (status, json) = await _request(method, route, body: body, auth: true);
    _throwIfError(status, json is Map<String, dynamic> ? json : const {});
    return json;
  }

  /// Throws [ApiException] for a non-2xx status or a non-empty `error` field.
  void _throwIfError(int status, Map<String, dynamic> json) {
    final error = json['error'];
    if (status >= 400 || (error is String && error.isNotEmpty)) {
      throw ApiException(status, error is String && error.isNotEmpty ? error : _fallbackMessage(status));
    }
  }

  /// Same wording as the web app for errors without a server message.
  static String _fallbackMessage(int status) {
    if (status >= 500) return 'The server is unavailable right now. Please try again shortly.';
    if (status == 404) return 'This service is not available yet. Please try again later.';
    return 'The request failed. Please try again.';
  }

  Future<void> _storeToken(Object? jwtToken) async {
    if (jwtToken is Map && jwtToken['accessToken'] is String) {
      await _storage.write(key: _tokenKey, value: jwtToken['accessToken'] as String);
    }
  }

  Future<String?> get token => _storage.read(key: _tokenKey);

  /// The JWT payload merged with the `user` object saved at login, so
  /// firstName/lastName are there even when the token only carries userId.
  Future<Map<String, dynamic>?> currentUser() async {
    final t = await token;
    if (t == null || JwtDecoder.isExpired(t)) return null;
    final saved = await _storage.read(key: _userKey);
    return {
      ...JwtDecoder.decode(t),
      if (saved != null) ...jsonDecode(saved) as Map<String, dynamic>,
    };
  }

  Future<void> logout() async {
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userKey);
  }

  /// Stores the JWT on success. Throws [ApiException]; a 403 means the
  /// account exists but the email hasn't been verified yet.
  Future<void> login(String email, String password) async {
    final (status, json) = await _send('api/auth/login', {'email': email, 'password': password});
    _throwIfError(status, json);
    final accessToken = json['accessToken'];
    if (accessToken is! String) throw ApiException(status, 'Login failed');
    await _storeToken({'accessToken': accessToken});
    final user = json['user'];
    if (user is Map<String, dynamic>) {
      await _storage.write(key: _userKey, value: jsonEncode(user));
    } else {
      await _storage.delete(key: _userKey);
    }
  }

  /// Creates an unverified account; the server emails a verification link.
  /// Throws [ApiException] (409 if the email is already registered).
  Future<void> register({
    required String firstName,
    required String lastName,
    required String email,
    required String password,
  }) async {
    final (status, json) = await _send('api/auth/register', {
      'firstName': firstName,
      'lastName': lastName,
      'email': email,
      'password': password,
    });
    _throwIfError(status, json);
  }

  /// Always succeeds server-side for a valid email (no account enumeration).
  Future<void> resendVerification(String email) async {
    final (status, json) = await _send('api/auth/resend-verification', {'email': email});
    _throwIfError(status, json);
  }

  /// Emails a reset link that opens the web app. Always 200 for a valid email.
  Future<void> forgotPassword(String email) async {
    final (status, json) = await _send('api/auth/forgot-password', {'email': email});
    _throwIfError(status, json);
  }

  /// Refreshes the saved profile (name, points) from `GET /api/users/me`.
  Future<Map<String, dynamic>> refreshUser() async {
    final user = await _authed('GET', 'api/users/me') as Map<String, dynamic>;
    await _storage.write(key: _userKey, value: jsonEncode(user));
    return user;
  }

  /// Server-side partial-match search over country names.
  Future<List<Country>> searchCountries(String query, {int limit = 8}) async {
    final q = Uri.encodeQueryComponent(query.trim());
    final json = await _authed('GET', 'api/countries/search?q=$q&limit=$limit');
    return [
      for (final c in json as List? ?? const []) Country.fromJson(c as Map<String, dynamic>),
    ];
  }

  /// Starts a round: the server secretly picks the mystery country.
  Future<Game> startGame() async {
    final json = await _authed('POST', 'api/games', const {});
    return Game.fromJson(json as Map<String, dynamic>);
  }

  /// Loads a round, including its guesses (and the answer once it's over).
  Future<Game> getGame(String gameId) async {
    final json = await _authed('GET', 'api/games/${Uri.encodeComponent(gameId)}');
    return Game.fromJson(json as Map<String, dynamic>);
  }

  Future<GuessResult> guess(String gameId, String countryId) async {
    final json = await _authed(
      'POST',
      'api/games/${Uri.encodeComponent(gameId)}/guesses',
      {'countryId': countryId},
    );
    return GuessResult.fromJson(json as Map<String, dynamic>);
  }

  /// Ends the round as a loss. Call [getGame] afterwards for the answer.
  Future<void> giveUp(String gameId) async {
    await _authed('POST', 'api/games/${Uri.encodeComponent(gameId)}/give-up', const {});
  }

  Future<LeaderboardPage> leaderboard({int page = 1, int limit = 20}) async {
    final json = await _authed('GET', 'api/leaderboard?page=$page&limit=$limit');
    return LeaderboardPage.fromJson(json as Map<String, dynamic>);
  }
}
