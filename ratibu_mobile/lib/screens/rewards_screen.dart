import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:go_router/go_router.dart';

class RewardsScreen extends StatefulWidget {
  const RewardsScreen({super.key});

  @override
  State<RewardsScreen> createState() => _RewardsScreenState();
}

class _RewardsScreenState extends State<RewardsScreen> {
  bool _loading = true;
  int _points = 0;
  int _level = 1;
  int _penaltyPoints = 0;
  String _referralCode = '';
  List<Map<String, dynamic>> _badges = [];

  @override
  void initState() {
    super.initState();
    _loadRewards();
  }

  Future<void> _loadRewards() async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      final stats = await Supabase.instance.client
          .from('gamification_stats')
          .select('points, level, penalty_points')
          .eq('user_id', user.id)
          .maybeSingle();

      final userRow = await Supabase.instance.client
          .from('users')
          .select('referral_code')
          .eq('id', user.id)
          .maybeSingle();

      final badgesData = await Supabase.instance.client
          .from('user_badges')
          .select('badges(*)')
          .eq('user_id', user.id);

      setState(() {
        _points = stats?['points'] ?? 0;
        _level = stats?['level'] ?? 1;
        _penaltyPoints = stats?['penalty_points'] ?? 0;
        _referralCode = userRow?['referral_code'] ?? '';
        _badges = (badgesData as List)
            .map((b) => b['badges'] as Map<String, dynamic>)
            .toList();
        _loading = false;
      });
    } catch (e) {
      debugPrint('Error loading rewards: $e');
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  void _shareReferral() {
    if (_referralCode.isEmpty) return;
    final shareUrl = 'https://ratibu.vercel.app/ref/$_referralCode';
    SharePlus.instance.share(
      ShareParams(
        text: 'Join me on Ratibu! Use my referral code $_referralCode: $shareUrl',
        subject: 'Join Ratibu',
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        title: const Text('Rewards'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C853)))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF00C853), Color(0xFF009624)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF00C853).withValues(alpha: 0.2),
                          blurRadius: 16,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Level $_level Saver', style: const TextStyle(color: Colors.white70, fontSize: 14)),
                        const SizedBox(height: 8),
                        Text(
                          '$_points pts',
                          style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Penalty Points: $_penaltyPoints',
                          style: const TextStyle(color: Colors.white70, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Referral Code',
                    style: TextStyle(color: Colors.white70, fontSize: 12, letterSpacing: 1.2),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1e293b),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.white24),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _referralCode.isEmpty ? 'Not available' : _referralCode,
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, letterSpacing: 2),
                          ),
                        ),
                        IconButton(
                          onPressed: _shareReferral,
                          icon: const Icon(Icons.share, color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => context.push('/referrals'),
                          icon: const Icon(Icons.people),
                          label: const Text('Referrals'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF1e293b),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => context.push('/leaderboard'),
                          icon: const Icon(Icons.emoji_events),
                          label: const Text('Leaderboard'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF00C853),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Badges',
                    style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  if (_badges.isEmpty)
                    const Text('No badges earned yet.', style: TextStyle(color: Colors.white54))
                  else
                    ..._badges.map((b) => Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1e293b),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white10),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.verified, color: Color(0xFF00C853)),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      b['name'] ?? 'Badge',
                                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      b['description'] ?? '',
                                      style: const TextStyle(color: Colors.white54, fontSize: 12),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        )),
                ],
              ),
            ),
    );
  }
}
