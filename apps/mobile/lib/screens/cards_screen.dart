import 'package:flutter/material.dart';

import '../api/api_client.dart';

class CardsScreen extends StatefulWidget {
  const CardsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<CardsScreen> createState() => _CardsScreenState();
}

class _CardsScreenState extends State<CardsScreen> {
  final _search = TextEditingController();
  final _card = TextEditingController();
  Map<String, dynamic>? _user;
  List<String> _results = [];
  String _message = '';

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  @override
  void dispose() {
    _search.dispose();
    _card.dispose();
    super.dispose();
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

  Future<void> _searchCard() async {
    try {
      final results = await widget.api.searchCards(_user!['userId'] as int, _search.text);
      setState(() {
        _results = results;
        _message = 'Card(s) have been retrieved';
      });
    } catch (e) {
      setState(() => _message = e.toString());
    }
  }

  Future<void> _addCard() async {
    try {
      final error = await widget.api.addCard(_user!['userId'] as int, _card.text);
      setState(() => _message = error == null ? 'Card has been added' : 'API Error: $error');
    } catch (e) {
      setState(() => _message = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = _user;
    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return Scaffold(
      appBar: AppBar(
        title: Text('Logged In As ${user['firstName']} ${user['lastName']}'),
        actions: [TextButton(onPressed: _logout, child: const Text('Log Out'))],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(controller: _search, decoration: const InputDecoration(labelText: 'Card To Search For')),
            FilledButton(onPressed: _searchCard, child: const Text('Search Card')),
            Expanded(child: ListView(children: [for (final r in _results) ListTile(title: Text(r))])),
            TextField(controller: _card, decoration: const InputDecoration(labelText: 'Card To Add')),
            FilledButton(onPressed: _addCard, child: const Text('Add Card')),
            const SizedBox(height: 8),
            Text(_message),
          ],
        ),
      ),
    );
  }
}
