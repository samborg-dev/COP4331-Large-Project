import 'package:flutter/material.dart';

import 'api/api_client.dart';
import 'screens/check_inbox_screen.dart';
import 'screens/forgot_password_screen.dart';
import 'screens/game_screen.dart';
import 'screens/leaderboard_screen.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'theme.dart';

void main() {
  runApp(const App());
}

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    final api = ApiClient();
    return MaterialApp(
      title: 'Country Guesser',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      // Android 12+ stretches content when you scroll past the end, which
      // squished the text; just stop at the edge instead
      scrollBehavior: const MaterialScrollBehavior().copyWith(overscroll: false),
      initialRoute: '/',
      routes: {
        '/': (_) => LoginScreen(api: api),
        '/register': (_) => RegisterScreen(api: api),
        '/check-inbox': (_) => CheckInboxScreen(api: api),
        '/forgot-password': (_) => ForgotPasswordScreen(api: api),
        '/home': (_) => GameScreen(api: api),
        '/leaderboard': (_) => LeaderboardScreen(api: api),
      },
    );
  }
}
