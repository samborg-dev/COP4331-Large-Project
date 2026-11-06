import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:jwt_decoder/jwt_decoder.dart';

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

  static String get baseUrl {
    if (_envUrl.isNotEmpty) return _envUrl;
    // The Android emulator reaches the host machine at 10.0.2.2
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:5000';
    }
    return 'http://localhost:5000';
  }

  Future<Map<String, dynamic>> _post(String route, Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('$baseUrl/$route'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  /// Like [_post], but keeps the HTTP status, tolerates non-JSON bodies
  /// (e.g. Express's HTML 404 page), and logs out on a 401.
  Future<(int, Map<String, dynamic>)> _send(String route, Map<String, dynamic> body) async {
    final res = await http
        .post(
          Uri.parse('$baseUrl/$route'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 15));
    if (res.statusCode == 401) await logout();
    Map<String, dynamic> json = {};
    try {
      final decoded = jsonDecode(res.body);
      if (decoded is Map<String, dynamic>) json = decoded;
    } on FormatException {
      // not JSON; fall through with an empty body
    }
    return (res.statusCode, json);
  }

  /// Throws [ApiException] for a non-2xx status or a non-empty `error` field.
  void _throwIfError(int status, Map<String, dynamic> json) {
    final error = json['error'];
    if (status >= 400 || (error is String && error.isNotEmpty)) {
      throw ApiException(
        status,
        error is String && error.isNotEmpty ? error : 'Something went wrong (HTTP $status)',
      );
    }
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
    var (status, json) = await _send('api/auth/login', {'email': email, 'password': password});
    // TODO(arwa): remove once /api/auth/login is merged. Until then, fall back
    // to the course demo route, which takes a username instead of an email.
    if (status == 404) {
      (status, json) = await _send('api/login', {'login': email, 'password': password});
    }
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

  /// Returns null on success, otherwise an error message.
  Future<String?> addCard(int userId, String card) async {
    final res = await _post('api/addcard', {
      'userId': userId,
      'card': card,
      'jwtToken': await token,
    });
    final error = res['error'] as String? ?? '';
    if (error.isNotEmpty) return error;
    await _storeToken(res['jwtToken']);
    return null;
  }

  /// Server-side partial match search. Throws on API error.
  Future<List<String>> searchCards(int userId, String search) async {
    final res = await _post('api/searchcards', {
      'userId': userId,
      'search': search,
      'jwtToken': await token,
    });
    final error = res['error'] as String? ?? '';
    if (error.isNotEmpty) throw Exception(error);
    await _storeToken(res['jwtToken']);
    return (res['results'] as List).cast<String>();
  }
}
