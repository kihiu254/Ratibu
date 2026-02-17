class GamificationStats {
  final String userId;
  final int points;
  final int level;
  final int totalContributions;
  final int meetingsAttended;

  GamificationStats({
    required this.userId,
    required this.points,
    required this.level,
    required this.totalContributions,
    required this.meetingsAttended,
  });

  factory GamificationStats.fromMap(Map<String, dynamic> map) {
    return GamificationStats(
      userId: map['user_id'],
      points: map['points'] ?? 0,
      level: map['level'] ?? 1,
      totalContributions: map['total_contributions'] ?? 0,
      meetingsAttended: map['meetings_attended'] ?? 0,
    );
  }
}

class Badge {
  final String id;
  final String name;
  final String description;
  final String iconType;

  Badge({
    required this.id,
    required this.name,
    required this.description,
    required this.iconType,
  });

  factory Badge.fromMap(Map<String, dynamic> map) {
    return Badge(
      id: map['id'],
      name: map['name'] ?? '',
      description: map['description'] ?? '',
      iconType: map['icon_type'] ?? 'star',
    );
  }
}
