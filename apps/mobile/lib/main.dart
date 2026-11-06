import 'package:flutter/material.dart';

import 'api/api_client.dart';
import 'screens/cards_screen.dart';
import 'screens/check_inbox_screen.dart';
import 'screens/forgot_password_screen.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';

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
      theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
      initialRoute: '/',
      routes: {
        '/': (_) => LoginScreen(api: api),
        '/register': (_) => RegisterScreen(api: api),
        '/check-inbox': (_) => CheckInboxScreen(api: api),
        '/forgot-password': (_) => ForgotPasswordScreen(api: api),
        '/cards': (_) => CardsScreen(api: api),
      },
    );
  }
}
