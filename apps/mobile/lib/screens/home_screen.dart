import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../widgets/auth_scaffold.dart';

/// Where a successful login lands. Placeholder until the game screen exists.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? _user;

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    final user = await widget.api.currentUser();
    if (!mounted) return;
    if (user == null) {
      Navigator.pushReplacementNamed(context, '/');
      return;
    }
    setState(() => _user = user);
  }

  Future<void> _logout() async {
    await widget.api.logout();
    if (mounted) Navigator.pushReplacementNamed(context, '/');
  }

  @override
  Widget build(BuildContext context) {
    final user = _user;
    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return AuthScaffold(
      title: 'Hi, ${user['firstName']}!',
      subtitle: "You're logged in as ${user['firstName']} ${user['lastName']}.",
      icon: Icons.check_circle_outline,
      children: [
        const Text(
          'The game is coming soon.',
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 32),
        OutlinedButton.icon(
          onPressed: _logout,
          icon: const Icon(Icons.logout),
          label: const Text('Log Out'),
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
        ),
      ],
    );
  }
}
