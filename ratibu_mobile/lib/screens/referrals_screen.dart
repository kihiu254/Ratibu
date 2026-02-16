import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:share_plus/share_plus.dart';

class ReferralsScreen extends StatefulWidget {
  const ReferralsScreen({super.key});

  @override
  State<ReferralsScreen> createState() => _ReferralsScreenState();
}

class _ReferralsScreenState extends State<ReferralsScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _referrals = [];
  String _referralCode = '';

  @override
  void initState() {
    super.initState();
    _fetchReferrals();
  }

  Future<void> _fetchReferrals() async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      final userData = await Supabase.instance.client
          .from('users')
          .select('referral_code')
          .eq('id', user.id)
          .single();

      final data = await Supabase.instance.client
          .from('referrals')
          .select('*, referred:users!referrals_referred_id_fkey(first_name, last_name, avatar_url)')
          .eq('referrer_id', user.id)
          .order('created_at', ascending: false);

      setState(() {
        _referralCode = userData['referral_code'] ?? '';
        _referrals = List<Map<String, dynamic>>.from(data);
        _loading = false;
      });
    } catch (e) {
      debugPrint('Error fetching referrals: $e');
      setState(() => _loading = false);
    }
  }

  void _shareReferral() {
    final shareUrl = 'https://ratibu.vercel.app/ref/$_referralCode';
    Share.share(
      'Join me on Ratibu! Use my referral code $_referralCode to sign up: $shareUrl',
      subject: 'Join Ratibu',
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        title: const Text('My Referrals'),
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
                  _buildHeader(),
                  const SizedBox(height: 32),
                  const Text(
                    'REFERRED FRIENDS',
                    style: TextStyle(
                      color: Colors.white54,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (_referrals.isEmpty)
                    _buildEmptyState()
                  else
                    ..._referrals.map((ref) => _buildReferralItem(ref)),
                ],
              ),
            ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF00C853), Color(0xFF009624)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF00C853).withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          const Icon(LucideIcons.users, color: Colors.white, size: 48),
          const SizedBox(height: 16),
          const Text(
            'Refer & Earn Rewards',
            style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          const Text(
            'Share your code and get KES 500 when they make their first contribution.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white70, fontSize: 13),
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.1),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white24),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  _referralCode,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 2,
                  ),
                ),
                GestureDetector(
                  onTap: _shareReferral,
                  child: const Icon(LucideIcons.share2, color: Colors.white, size: 20),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      padding: const EdgeInsets.all(40),
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Column(
        children: [
          Icon(LucideIcons.userPlus, color: Colors.white.withOpacity(0.1), size: 64),
          const SizedBox(height: 16),
          const Text(
            'No friends referred yet',
            style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'Invite friends using your code to start earning!',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white54, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildReferralItem(Map<String, dynamic> ref) {
    final referred = ref['referred'] as Map<String, dynamic>?;
    final isCompleted = ref['status'] == 'completed';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: const Color(0xFF0f172a),
            backgroundImage: referred?['avatar_url'] != null
                ? NetworkImage(referred!['avatar_url'])
                : null,
            child: referred?['avatar_url'] == null
                ? const Icon(LucideIcons.user, color: Colors.white24)
                : null,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${referred?['first_name'] ?? ''} ${referred?['last_name'] ?? ''}',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                ),
                Text(
                  'Joined ${DateTime.parse(ref['created_at']).toLocal().toString().split(' ')[0]}',
                  style: const TextStyle(color: Colors.white54, fontSize: 11),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: isCompleted ? Colors.green.withOpacity(0.1) : Colors.amber.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              isCompleted ? 'EARNED' : 'PENDING',
              style: TextStyle(
                color: isCompleted ? Colors.green : Colors.amber,
                fontSize: 10,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
