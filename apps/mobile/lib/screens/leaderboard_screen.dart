import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../theme.dart';

/// Players ranked by total points, 20 per page, with the current player
/// highlighted.
class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen> {
  LeaderboardPage? _data;
  String? _myId;
  int _page = 1;
  bool _loading = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    widget.api.currentUser().then((u) {
      if (mounted) setState(() => _myId = '${u?['id'] ?? u?['userId'] ?? ''}');
    });
    _load(1);
  }

  Future<void> _load(int page) async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final data = await widget.api.leaderboard(page: page);
      if (mounted) {
        setState(() {
          _data = data;
          _page = data.page;
        });
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.statusCode == 401) {
        Navigator.pushNamedAndRemoveUntil(context, '/', (_) => false);
        return;
      }
      setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not reach the server. Check your connection.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final data = _data;
    return Scaffold(
      appBar: AppBar(title: const Text('Leaderboard')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _load(_page),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              Text('TOP PLAYERS', textAlign: TextAlign.center, style: theme.textTheme.labelSmall),
              const SizedBox(height: 12),
              if (_error.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Column(
                    children: [
                      Text(_error, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.error)),
                      TextButton(onPressed: () => _load(_page), child: const Text('Try again')),
                    ],
                  ),
                ),
              if (data == null && _loading)
                const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (data != null && data.entries.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(32),
                  child: Text('No players yet. Win a round to get on the board!', textAlign: TextAlign.center),
                )
              else if (data != null)
                Card(
                  child: Column(
                    children: [
                      for (final (i, e) in data.entries.indexed)
                        _Row(entry: e, isMe: e.userId == _myId, first: i == 0),
                    ],
                  ),
                ),
              if (data != null && data.pageCount > 1) ...[
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IconButton(
                      tooltip: 'Previous page',
                      onPressed: _loading || _page <= 1 ? null : () => _load(_page - 1),
                      icon: const Icon(Icons.chevron_left),
                    ),
                    Text('Page $_page of ${data.pageCount}'),
                    IconButton(
                      tooltip: 'Next page',
                      onPressed: _loading || _page >= data.pageCount ? null : () => _load(_page + 1),
                      icon: const Icon(Icons.chevron_right),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.entry, required this.isMe, required this.first});

  final LeaderboardEntry entry;
  final bool isMe;
  final bool first;

  @override
  Widget build(BuildContext context) {
    final name = '${entry.firstName} ${entry.lastName}'.trim();
    final medal = switch (entry.rank) {
      1 => const Color(0xFFFFD36B),
      2 => const Color(0xFFD5DBE6),
      3 => const Color(0xFFE0A26B),
      _ => AppColors.muted,
    };
    return Container(
      decoration: BoxDecoration(
        color: isMe ? AppColors.primary.withValues(alpha: 0.12) : null,
        border: first ? null : const Border(top: BorderSide(color: AppColors.divider)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      child: Row(
        children: [
          SizedBox(
            width: 40,
            child: Text(
              '#${entry.rank}',
              style: TextStyle(color: medal, fontWeight: FontWeight.w800),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isMe ? '$name (you)' : (name.isEmpty ? 'Player' : name),
                  style: const TextStyle(fontWeight: FontWeight.w600),
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  '${entry.gamesWon} ${entry.gamesWon == 1 ? 'win' : 'wins'}',
                  style: const TextStyle(color: AppColors.muted, fontSize: 13),
                ),
              ],
            ),
          ),
          Text(
            '${entry.totalPoints} pts',
            style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.link),
          ),
        ],
      ),
    );
  }
}
