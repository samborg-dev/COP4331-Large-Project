// Response types for the game, search and leaderboard endpoints.
// Shapes follow docs/api-contract.md.

class Country {
  const Country({required this.id, required this.name, this.continent = ''});

  factory Country.fromJson(Map<String, dynamic> json) => Country(
        id: '${json['id'] ?? ''}',
        name: '${json['name'] ?? ''}',
        continent: '${json['continent'] ?? ''}',
      );

  final String id;
  final String name;
  final String continent;
}

class Guess {
  const Guess({required this.country, required this.range, this.distance, this.direction});

  factory Guess.fromJson(Map<String, dynamic> json) => Guess(
        // The contract says `country`; the server has also sent `guessName`
        country: '${json['country'] ?? json['guessName'] ?? ''}',
        range: '${json['range'] ?? ''}',
        distance: (json['distance'] as num?)?.round(),
        direction: json['direction'] as String?,
      );

  final String country;

  /// A distance bucket such as "1,500–3,000 km", or "Correct".
  final String range;

  /// Kilometers to the mystery country, rounded to 10 km. Older servers omit it.
  final int? distance;

  /// Compass direction from this guess to the mystery country, e.g. "NE".
  final String? direction;
}

class Game {
  const Game({
    required this.gameId,
    required this.maxGuesses,
    this.status = 'active',
    this.guesses = const [],
    this.pointsEarned = 0,
    this.answer,
    this.surrendered = false,
  });

  factory Game.fromJson(Map<String, dynamic> json) => Game(
        gameId: '${json['gameId']}',
        maxGuesses: (json['maxGuesses'] as num?)?.toInt() ?? 10,
        status: _status(json['status']),
        guesses: [
          for (final g in json['guesses'] as List? ?? const [])
            Guess.fromJson(g as Map<String, dynamic>),
        ],
        pointsEarned: (json['pointsEarned'] as num?)?.toInt() ?? 0,
        // The contract says `answer`; the server has also sent `targetCountry`
        answer: (json['answer'] ?? json['targetCountry']) as String?,
        surrendered: json['surrendered'] == true,
      );

  /// Accepts the contract's `active`/`won`/`lost` and the database's
  /// `IN_PROGRESS`/`WON`/`LOST`.
  static String _status(Object? raw) => switch ('${raw ?? ''}'.toLowerCase()) {
        'won' => 'won',
        'lost' => 'lost',
        _ => 'active',
      };

  final String gameId;
  final int maxGuesses;

  /// "active", "won" or "lost".
  final String status;
  final List<Guess> guesses;
  final int pointsEarned;

  /// The mystery country; the server only includes it once the round is over.
  final String? answer;

  /// True when the player gave up.
  final bool surrendered;
}

class GuessResult {
  const GuessResult({
    required this.country,
    required this.range,
    required this.solved,
    required this.guessesUsed,
    this.pointsEarned,
    this.distance,
    this.direction,
  });

  factory GuessResult.fromJson(Map<String, dynamic> json) => GuessResult(
        country: '${json['country'] ?? ''}',
        range: '${json['range'] ?? ''}',
        distance: (json['distance'] as num?)?.round(),
        direction: json['direction'] as String?,
        solved: json['solved'] == true,
        guessesUsed: (json['guessesUsed'] as num?)?.toInt() ?? 0,
        pointsEarned: (json['pointsEarned'] as num?)?.toInt(),
      );

  final String country;
  final String range;
  final bool solved;
  final int guessesUsed;

  /// Only present when [solved].
  final int? pointsEarned;

  final int? distance;
  final String? direction;

  Guess toGuess() => Guess(country: country, range: range, distance: distance, direction: direction);
}

class LeaderboardEntry {
  const LeaderboardEntry({
    required this.rank,
    required this.userId,
    required this.firstName,
    required this.lastName,
    required this.totalPoints,
    required this.gamesWon,
  });

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) => LeaderboardEntry(
        rank: (json['rank'] as num?)?.toInt() ?? 0,
        userId: '${json['userId'] ?? ''}',
        firstName: '${json['firstName'] ?? ''}',
        lastName: '${json['lastName'] ?? ''}',
        totalPoints: (json['totalPoints'] as num?)?.toInt() ?? 0,
        gamesWon: (json['gamesWon'] as num?)?.toInt() ?? 0,
      );

  final int rank;
  final String userId;
  final String firstName;
  final String lastName;
  final int totalPoints;
  final int gamesWon;
}

class LeaderboardPage {
  const LeaderboardPage({
    required this.entries,
    required this.page,
    required this.limit,
    required this.total,
  });

  factory LeaderboardPage.fromJson(Map<String, dynamic> json) => LeaderboardPage(
        entries: [
          for (final e in json['entries'] as List? ?? const [])
            LeaderboardEntry.fromJson(e as Map<String, dynamic>),
        ],
        page: (json['page'] as num?)?.toInt() ?? 1,
        limit: (json['limit'] as num?)?.toInt() ?? 20,
        total: (json['total'] as num?)?.toInt() ?? 0,
      );

  final List<LeaderboardEntry> entries;
  final int page;
  final int limit;
  final int total;

  int get pageCount => total == 0 ? 1 : (total + limit - 1) ~/ limit;
}
