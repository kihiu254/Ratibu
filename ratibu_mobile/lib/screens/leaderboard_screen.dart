import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen> {
  final _supabase = Supabase.instance.client;
  List<Map<String, dynamic>> _leaderboard = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchLeaderboard();
  }

  Future<void> _fetchLeaderboard() async {
    try {
      final data = await _supabase
          .from('gamification_stats')
          .select('''
            points,
            user:users (first_name, last_name, avatar_url)
          ''')
          .order('points', ascending: false)
          .limit(20);

      setState(() {
        _leaderboard = List<Map<String, dynamic>>.from(data);
        _loading = false;
      });
    } catch (e) {
      debugPrint('Error fetching leaderboard: $e');
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Top Savers', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: RefreshIndicator(
        onRefresh: _fetchLeaderboard,
        color: const Color(0xFF00C853),
        child: _loading && _leaderboard.isEmpty
            ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C853)))
            : Column(
                children: [
                  if (_leaderboard.isNotEmpty) _buildTopThree(),
                  Expanded(
                    child: ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: _leaderboard.length > 3 ? _leaderboard.length - 3 : 0,
                      itemBuilder: (context, index) {
                        final item = _leaderboard[index + 3];
                        final user = item['user'] as Map<String, dynamic>?;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.03),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 32,
                                height: 32,
                                alignment: Alignment.center,
                                child: Text(
                                  '${index + 4}',
                                  style: const TextStyle(color: Colors.white54, fontWeight: FontWeight.bold),
                                ),
                              ),
                              const SizedBox(width: 12),
                              CircleAvatar(
                                radius: 20,
                                backgroundImage: user?['avatar_url'] != null
                                    ? NetworkImage(user!['avatar_url'])
                                    : null,
                                child: user?['avatar_url'] == null
                                    ? const Icon(Icons.person, color: Colors.white)
                                    : null,
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Text(
                                  '${user?['first_name'] ?? 'User'} ${user?['last_name']?[0] ?? ''}.',
                                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                                ),
                              ),
                              Text(
                                '${item['points']} pts',
                                style: const TextStyle(color: Color(0xFF00C853), fontWeight: FontWeight.w900),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _buildTopThree() {
    return Container(
      padding: const EdgeInsets.all(24),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (_leaderboard.length > 1) _buildPodiumItem(_leaderboard[1], 2, 80),
          _buildPodiumItem(_leaderboard[0], 1, 100),
          if (_leaderboard.length > 2) _buildPodiumItem(_leaderboard[2], 3, 70),
        ],
      ),
    );
  }

  Widget _buildPodiumItem(Map<String, dynamic> item, int rank, double height) {
    final user = item['user'] as Map<String, dynamic>?;
    final color = rank == 1 ? const Color(0xFFFFD700) : (rank == 2 ? const Color(0xFFC0C0C0) : const Color(0xFFCD7F32));

    return Column(
      children: [
        Stack(
          alignment: Alignment.center,
          children: [
            CircleAvatar(
              radius: rank == 1 ? 40 : 30,
              backgroundColor: color,
              child: CircleAvatar(
                radius: rank == 1 ? 37 : 27,
                backgroundImage: user?['avatar_url'] != null
                    ? NetworkImage(user!['avatar_url'])
                    : null,
                child: user?['avatar_url'] == null
                    ? const Icon(Icons.person, color: Colors.white)
                    : null,
              ),
            ),
            Positioned(
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '#$rank',
                  style: const TextStyle(color: Colors.black, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          user?['first_name'] ?? 'User',
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
        ),
        Text(
          '${item['points']}',
          style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 14),
        ),
      ],
    );
  }
}
