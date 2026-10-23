import 'package:flutter/material.dart';

import '../api/api_client.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _login = TextEditingController();
  final _password = TextEditingController();
  String _message = '';

  @override
  void dispose() {
    _login.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _doLogin() async {
    try {
      final error = await widget.api.login(_login.text, _password.text);
      if (!mounted) return;
      if (error != null) {
        setState(() => _message = 'User/Password combination incorrect');
        return;
      }
      Navigator.pushReplacementNamed(context, '/cards');
    } catch (e) {
      if (mounted) setState(() => _message = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('COP 4331 MERN Stack Demo')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('PLEASE LOG IN', style: TextStyle(fontSize: 20)),
            TextField(controller: _login, decoration: const InputDecoration(labelText: 'Username')),
            TextField(
              controller: _password,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Password'),
            ),
            const SizedBox(height: 16),
            FilledButton(onPressed: _doLogin, child: const Text('Do It')),
            const SizedBox(height: 8),
            Text(_message),
          ],
        ),
      ),
    );
  }
}
