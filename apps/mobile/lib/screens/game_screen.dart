import 'dart:async';

import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../globe/country_colors.dart';
import '../globe/country_globe.dart';
import '../theme.dart';

/// The main screen after login. A round starts automatically: the player
/// searches for a country (server-side partial match), guesses it, and sees
/// how far off they were, until they find it or run out of guesses.
class GameScreen extends StatefulWidget {
  const GameScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  final _search = TextEditingController();
  final _searchFocus = FocusNode();
  Timer? _debounce;
  int _searchSeq = 0;

  String _firstName = 'Player';
  int? _points;

  Game? _game;
  final List<Guess> _guesses = [];
  List<Country> _suggestions = [];
  Country? _selected;
  bool _starting = false;
  bool _guessing = false;
  bool _searching = false;
  String _error = '';

  // Set when the round ends
  bool _won = false;
  bool _lost = false;
  int? _earned;
  String? _answer;

  /// The country the globe turns to: the latest guess
  String? _focus;

  bool get _over => _won || _lost;
  int get _maxGuesses => _game?.maxGuesses ?? 10;

  @override
  void initState() {
    super.initState();
    _loadUser();
    _newRound();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  Future<void> _loadUser() async {
    final user = await widget.api.currentUser();
    if (!mounted) return;
    if (user == null) return _toLogin();
    setState(() {
      _firstName = '${user['firstName'] ?? ''}'.trim().isEmpty ? 'Player' : '${user['firstName']}';
      _points = (user['totalPoints'] as num?)?.toInt();
    });
  }

  void _toLogin() {
    Navigator.pushNamedAndRemoveUntil(context, '/', (_) => false);
  }

  /// Shared error handling: an expired session goes back to login.
  void _handleError(Object e) {
    if (!mounted) return;
    if (e is ApiException && e.statusCode == 401) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      return _toLogin();
    }
    setState(() {
      _error = e is ApiException ? e.message : 'Could not reach the server. Check your connection.';
    });
  }

  Future<void> _newRound() async {
    setState(() {
      _starting = true;
      _error = '';
      _game = null;
      _guesses.clear();
      _focus = null;
      _won = _lost = false;
      _earned = _answer = null;
      _clearSearch();
    });
    try {
      final game = await widget.api.startGame();
      if (mounted) setState(() => _game = game);
    } catch (e) {
      _handleError(e);
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  void _clearSearch() {
    _debounce?.cancel();
    _searchSeq++;
    _search.clear();
    _suggestions = [];
    _selected = null;
    _searching = false;
  }

  void _onSearchChanged(String text) {
    _debounce?.cancel();
    if (_selected != null && text != _selected!.name) setState(() => _selected = null);
    if (text.trim().isEmpty) {
      setState(() {
        _suggestions = [];
        _searching = false;
      });
      return;
    }
    setState(() => _searching = true);
    // Wait for a pause in typing so each keystroke isn't a request
    _debounce = Timer(const Duration(milliseconds: 250), () => _runSearch(text));
  }

  Future<void> _runSearch(String text) async {
    final seq = ++_searchSeq;
    try {
      final results = await widget.api.searchCountries(text);
      // Ignore responses for text the player has since changed
      if (!mounted || seq != _searchSeq) return;
      final guessed = _guesses.map((g) => g.country.toLowerCase()).toSet();
      setState(() {
        _suggestions = results.where((c) => !guessed.contains(c.name.toLowerCase())).toList();
        _searching = false;
        _error = '';
      });
    } catch (e) {
      if (!mounted || seq != _searchSeq) return;
      setState(() => _searching = false);
      _handleError(e);
    }
  }

  void _select(Country country) {
    _debounce?.cancel();
    _searchSeq++;
    setState(() {
      _selected = country;
      _search.text = country.name;
      _search.selection = TextSelection.collapsed(offset: country.name.length);
      _suggestions = [];
      _searching = false;
    });
  }

  Future<void> _submitGuess() async {
    final game = _game;
    final country = _selected;
    if (game == null || country == null || _guessing || _over) return;
    setState(() {
      _guessing = true;
      _error = '';
    });
    try {
      final result = await widget.api.guess(game.gameId, country.id);
      if (!mounted) return;
      setState(() {
        _guesses.insert(0, Guess(country: result.country, range: result.range));
        _focus = result.country;
        _clearSearch();
        if (result.solved) {
          _won = true;
          _earned = result.pointsEarned ?? 0;
          _points = (_points ?? 0) + _earned!;
        } else if (result.guessesUsed >= _maxGuesses) {
          _lost = true;
        }
      });
      if (_won) _syncPoints();
      if (_lost) _revealAnswer(game.gameId);
    } catch (e) {
      _handleError(e);
    } finally {
      if (mounted) setState(() => _guessing = false);
    }
  }

  /// Replaces the locally added points with the server's total.
  Future<void> _syncPoints() async {
    try {
      final user = await widget.api.refreshUser();
      if (mounted) setState(() => _points = (user['totalPoints'] as num?)?.toInt() ?? _points);
    } catch (_) {
      // Keep the local total; it's only a display value
    }
  }

  /// The server only shares the answer once the round is over.
  Future<void> _revealAnswer(String gameId) async {
    try {
      final game = await widget.api.getGame(gameId);
      if (mounted) setState(() => _answer = game.answer);
    } catch (e) {
      _handleError(e);
    }
  }

  Future<void> _logout() async {
    await widget.api.logout();
    if (mounted) _toLogin();
  }

  void _showHelp() {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('How to play'),
        content: const Text(
          'Find the mystery country before you run out of guesses.\n\n'
          'Type a country name and pick it from the list. After each guess you '
          'see how far your guess is from the mystery country. Smaller distance '
          'ranges mean you’re closer.\n\n'
          'Find it in fewer guesses to earn more points. Your points add to '
          'your total on the leaderboard.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Got it')),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('CountryGuesser'),
        actions: [
          IconButton(
            tooltip: 'Leaderboard',
            icon: const Icon(Icons.leaderboard_outlined),
            onPressed: () => Navigator.pushNamed(context, '/leaderboard'),
          ),
          IconButton(
            tooltip: 'How to play',
            icon: const Icon(Icons.help_outline),
            onPressed: _showHelp,
          ),
          IconButton(
            tooltip: 'Log out',
            icon: const Icon(Icons.logout),
            onPressed: _logout,
          ),
        ],
      ),
      body: SafeArea(
        child: Align(
          alignment: Alignment.topCenter,
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    _points == null ? 'Hi, $_firstName' : 'Hi, $_firstName · $_points pts',
                    key: const Key('player-summary'),
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.muted),
                  ),
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'FIND THE MYSTERY COUNTRY',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.labelSmall,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Guess a country to see how far it is from the mystery country.',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.muted),
                          ),
                          const SizedBox(height: 20),
                          ..._roundBody(theme),
                          if (_error.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            Text(
                              _error,
                              key: const Key('game-error'),
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: AppColors.error),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(12, 16, 12, 12),
                      child: Column(
                        children: [
                          CountryGlobe(
                            key: const Key('globe'),
                            guesses: _guesses,
                            answer: _answer,
                            focusCountry: _focus,
                            roundId: _game?.gameId,
                          ),
                          const SizedBox(height: 8),
                          const _GlobeLegend(),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _GuessHistory(guesses: _guesses, maxGuesses: _maxGuesses),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _roundBody(ThemeData theme) {
    if (_starting) {
      return const [
        Center(child: CircularProgressIndicator()),
        SizedBox(height: 12),
        Text('Starting round…', textAlign: TextAlign.center),
      ];
    }
    if (_game == null) {
      return [
        OutlinedButton(onPressed: _newRound, child: const Text('Try again')),
      ];
    }
    if (_over) {
      return [
        _RoundResult(
          won: _won,
          earned: _earned,
          answer: _answer,
          guesses: _guesses.length,
          onPlayAgain: _newRound,
        ),
      ];
    }

    return [
      Text(
        'Guess ${_guesses.length + 1} of $_maxGuesses',
        key: const Key('guess-counter'),
        textAlign: TextAlign.center,
        style: theme.textTheme.titleSmall,
      ),
      const SizedBox(height: 12),
      TextField(
        key: const Key('country-search'),
        controller: _search,
        focusNode: _searchFocus,
        enabled: !_guessing,
        textInputAction: TextInputAction.done,
        textCapitalization: TextCapitalization.words,
        onChanged: _onSearchChanged,
        onSubmitted: (_) {
          if (_selected == null && _suggestions.isNotEmpty) _select(_suggestions.first);
        },
        decoration: InputDecoration(
          labelText: 'Country',
          hintText: 'Start typing, e.g. "fra"',
          prefixIcon: const Icon(Icons.search),
          suffixIcon: _searching
              ? const Padding(
                  padding: EdgeInsets.all(14),
                  child: SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                )
              : _search.text.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Clear',
                      icon: const Icon(Icons.close),
                      onPressed: () => setState(_clearSearch),
                    ),
        ),
      ),
      if (_suggestions.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(top: 6),
          // ListTile draws its tap highlight on the nearest Material
          child: Material(
            color: AppColors.input,
            clipBehavior: Clip.antiAlias,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
              side: const BorderSide(color: AppColors.inputBorder),
            ),
            child: Column(
              children: [
                for (final c in _suggestions)
                  ListTile(
                    dense: true,
                    title: Text(c.name),
                    subtitle: c.continent.isEmpty ? null : Text(c.continent),
                    onTap: () => _select(c),
                  ),
              ],
            ),
          ),
        )
      else if (!_searching && _search.text.trim().isNotEmpty && _selected == null)
        const Padding(
          padding: EdgeInsets.only(top: 8),
          child: Text('No matching countries', textAlign: TextAlign.center),
        ),
      const SizedBox(height: 16),
      FilledButton(
        key: const Key('guess-button'),
        onPressed: _selected == null || _guessing ? null : _submitGuess,
        child: _guessing
            ? const SizedBox.square(
                dimension: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.onPrimary),
              )
            : Text(_selected == null ? 'Pick a country to guess' : 'Guess ${_selected!.name}'),
      ),
    ];
  }
}

class _RoundResult extends StatelessWidget {
  const _RoundResult({
    required this.won,
    required this.earned,
    required this.answer,
    required this.guesses,
    required this.onPlayAgain,
  });

  final bool won;
  final int? earned;
  final String? answer;
  final int guesses;
  final VoidCallback onPlayAgain;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      key: const Key('round-result'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(
          won ? Icons.emoji_events_outlined : Icons.flag_outlined,
          size: 48,
          color: won ? AppColors.success : AppColors.primary,
        ),
        const SizedBox(height: 8),
        Text(
          won ? 'You found it!' : 'Out of guesses',
          textAlign: TextAlign.center,
          style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        Text(
          won
              ? 'Solved in $guesses ${guesses == 1 ? 'guess' : 'guesses'}. +${earned ?? 0} points'
              : answer == null
                  ? 'Loading the answer…'
                  : 'The mystery country was $answer.',
          textAlign: TextAlign.center,
          style: theme.textTheme.bodyLarge?.copyWith(color: AppColors.muted),
        ),
        const SizedBox(height: 20),
        FilledButton(onPressed: onPlayAgain, child: const Text('Play again')),
      ],
    );
  }
}

/// Explains the globe colors: hotter is closer.
class _GlobeLegend extends StatelessWidget {
  const _GlobeLegend();

  @override
  Widget build(BuildContext context) {
    const style = TextStyle(color: AppColors.muted, fontSize: 12);
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Text('Closer', style: style),
        const SizedBox(width: 8),
        for (final color in [...rangeColors.values])
          Container(
            width: 18,
            height: 8,
            margin: const EdgeInsets.symmetric(horizontal: 1),
            decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2)),
          ),
        const SizedBox(width: 8),
        const Text('Farther', style: style),
      ],
    );
  }
}

class _GuessHistory extends StatelessWidget {
  const _GuessHistory({required this.guesses, required this.maxGuesses});

  final List<Guess> guesses;
  final int maxGuesses;

  /// Same colors as the globe (and the web app).
  static Color _rangeColor(String range) => guessColor(range);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('YOUR GUESSES (${guesses.length}/$maxGuesses)', style: theme.textTheme.labelSmall),
            if (guesses.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Text(
                  'No guesses yet. Your guesses and their distances will show up here.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.muted),
                ),
              )
            else
              for (final (i, g) in guesses.indexed)
                Container(
                  key: Key('guess-row-$i'),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: const BoxDecoration(
                    border: Border(top: BorderSide(color: AppColors.divider)),
                  ),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 28,
                        child: Text(
                          '${guesses.length - i}',
                          style: const TextStyle(color: AppColors.muted),
                        ),
                      ),
                      Expanded(
                        child: Text(g.country, style: const TextStyle(fontWeight: FontWeight.w600)),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: _rangeColor(g.range).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          g.range,
                          style: TextStyle(
                            color: _rangeColor(g.range),
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
          ],
        ),
      ),
    );
  }
}
