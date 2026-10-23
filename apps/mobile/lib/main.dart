import 'package:flutter/material.dart';

import 'api/api_client.dart';
import 'screens/cards_screen.dart';
import 'screens/login_screen.dart';

void main() {
  runApp(const App());
}

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    final api = ApiClient();
    return MaterialApp(
      title: 'COP 4331 MERN Stack Demo',
      theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
      initialRoute: '/',
      routes: {
        '/': (_) => LoginScreen(api: api),
        '/cards': (_) => CardsScreen(api: api),
      },
    );
  }
}
