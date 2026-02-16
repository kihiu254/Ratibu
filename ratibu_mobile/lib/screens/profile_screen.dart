import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _firstNameController;
  late TextEditingController _lastNameController;
  late TextEditingController _phoneController;
  late TextEditingController _bioController;
  
  bool _loading = true;
  bool _saving = false;
  String? _avatarUrl;
  String _referralCode = '';
  int _points = 0;
  int _level = 1;
  List<Map<String, dynamic>> _badges = [];

  @override
  void initState() {
    super.initState();
    _firstNameController = TextEditingController();
    _lastNameController = TextEditingController();
    _phoneController = TextEditingController();
    _bioController = TextEditingController();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      final data = await Supabase.instance.client
          .from('users')
          .select('*, gamification_stats(*)')
          .eq('id', user.id)
          .single();

      final badgesData = await Supabase.instance.client
          .from('user_badges')
          .select('badges(*)')
          .eq('user_id', user.id);

      setState(() {
        _firstNameController.text = data['first_name'] ?? '';
        _lastNameController.text = data['last_name'] ?? '';
        _phoneController.text = data['phone'] ?? '';
        _bioController.text = data['bio'] ?? '';
        _avatarUrl = data['avatar_url'];
        _referralCode = data['referral_code'] ?? '';
        
        if (data['gamification_stats'] != null) {
          final stats = data['gamification_stats'];
          if (stats is List && stats.isNotEmpty) {
            final s = stats[0];
            _points = s['points'] ?? 0;
            _level = s['level'] ?? 1;
          } else if (stats is Map) {
            _points = stats['points'] ?? 0;
            _level = stats['level'] ?? 1;
          }
        }

        _badges = (badgesData as List).map((b) => b['badges'] as Map<String, dynamic>).toList();
        _loading = false;
      });
    } catch (e) {
      debugPrint('Error loading profile: $e');
      setState(() => _loading = false);
    }
  }

  Future<void> _pickAndUploadImage() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 512,
      maxHeight: 512,
      imageQuality: 75,
    );

    if (image == null) return;

    setState(() => _saving = true);

    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      final file = File(image.path);
      final fileExt = image.path.split('.').last;
      final fileName = '${DateTime.now().millisecondsSinceEpoch}.$fileExt';
      final filePath = '${user.id}/$fileName';

      await Supabase.instance.client.storage
          .from('avatars')
          .upload(filePath, file);

      final publicUrl = Supabase.instance.client.storage
          .from('avatars')
          .getPublicUrl(filePath);

      await Supabase.instance.client
          .from('users')
          .update({'avatar_url': publicUrl})
          .eq('id', user.id);

      setState(() {
        _avatarUrl = publicUrl;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Avatar updated successfully!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error uploading image: $e')),
        );
      }
    } finally {
      setState(() => _saving = false);
    }
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _saving = true);

    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      await Supabase.instance.client.from('users').upsert({
        'id': user.id,
        'first_name': _firstNameController.text,
        'last_name': _lastNameController.text,
        'phone': _phoneController.text,
        'bio': _bioController.text,
        'updated_at': DateTime.now().toIso8601String(),
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile updated successfully!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error saving profile: $e')),
        );
      }
    } finally {
      setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile Settings'),
        actions: [
          if (_saving)
            const Center(
              child: Padding(
                padding: EdgeInsets.only(right: 16.0),
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            )
          else
            IconButton(
              onPressed: _saveProfile,
              icon: const Icon(Icons.check),
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              // Avatar
              Center(
                child: Stack(
                  children: [
                    CircleAvatar(
                      radius: 60,
                      backgroundColor: Colors.grey[800],
                      backgroundImage: _avatarUrl != null 
                        ? NetworkImage(_avatarUrl!) 
                        : null,
                      child: _avatarUrl == null 
                        ? const Icon(Icons.person, size: 60, color: Colors.white) 
                        : null,
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: GestureDetector(
                        onTap: _pickAndUploadImage,
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: const BoxDecoration(
                            color: Color(0xFF00C853),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.camera_alt, color: Colors.white, size: 20),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              
              // Form Fields
              _buildTextField(
                controller: _firstNameController,
                label: 'First Name',
                icon: Icons.person_outline,
              ),
              const SizedBox(height: 16),
              _buildTextField(
                controller: _lastNameController,
                label: 'Last Name',
                icon: Icons.person_outline,
              ),
              const SizedBox(height: 16),
              _buildTextField(
                controller: _phoneController,
                label: 'Phone Number',
                icon: Icons.phone_outlined,
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 16),
              _buildTextField(
                controller: _bioController,
                label: 'Bio',
                icon: Icons.info_outline,
                maxLines: 4,
              ),
              
              const SizedBox(height: 32),
              
              // Referral Section
              _buildReferralSection(),
              
              const SizedBox(height: 32),
              
              // Achievements Section
              _buildAchievementsSection(),
              
              const SizedBox(height: 40),
              
              // Sign Out Button
              S_SignOutButton(ref: ref),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    TextInputType? keyboardType,
    int maxLines = 1,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      maxLines: maxLines,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: Colors.grey),
        prefixIcon: Icon(icon, color: const Color(0xFF00C853)),
        filled: true,
        fillColor: const Color(0xFF1e293b),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.white10),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF00C853)),
        ),
      ),
      validator: (value) {
        if (value == null || value.isEmpty) {
          if (label != 'Bio') return '$label is required';
        }
        return null;
      },
    );
  }

  Widget _buildReferralSection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF00C853), Color(0xFF009624)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.share, color: Colors.white, size: 20),
              SizedBox(width: 8),
              Text(
                'Refer & Earn KES 500',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            'Invite your friends to join Ratibu and earn rewards after their first contribution.',
            style: TextStyle(color: Colors.white70, fontSize: 13),
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                GestureDetector(
                  onTap: () {
                    GoRouter.of(context).push('/referrals');
                  },
                  child: Row(
                    children: [
                      const Text(
                        'View Trackers',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                      const SizedBox(width: 4),
                      const Icon(Icons.arrow_forward_ios, color: Colors.white, size: 12),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Invite your friends to join Ratibu and earn rewards after their first contribution.',
            style: TextStyle(color: Colors.white70, fontSize: 13),
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  _referralCode,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, letterSpacing: 2),
                ),
                GestureDetector(
                  onTap: () {
                    // Using Share logic similar to ReferralsScreen
                    final shareUrl = 'https://ratibu.vercel.app/ref/$_referralCode';
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Referral link ready to share!')),
                    );
                  },
                  child: const Icon(Icons.share, color: Colors.white, size: 20),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAchievementsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Achievements',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            TextButton(
              onPressed: () => GoRouter.of(context).push('/leaderboard'),
              child: const Text('Leaderboard', style: TextStyle(color: Color(0xFF00C853))),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _buildStatItem('Points', _points.toString(), Icons.star),
            _buildStatItem('Level', _level.toString(), Icons.trending_up),
            _buildStatItem('Badges', _badges.length.toString(), Icons.emoji_events),
          ],
        ),
        const SizedBox(height: 24),
        if (_badges.isEmpty)
          const Text('No badges earned yet. Keep saving!', style: TextStyle(color: Colors.white54, fontSize: 13))
        else
          SizedBox(
            height: 80,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: _badges.length,
              itemBuilder: (context, index) {
                final badge = _badges[index];
                return _buildBadgeItem(badge);
              },
            ),
          ),
      ],
    );
  }

  Widget _buildStatItem(String label, String value, IconData icon) {
    return Container(
      width: (MediaQuery.of(context).size.width - 64) / 3,
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(icon, color: const Color(0xFF00C853), size: 20),
          const SizedBox(height: 8),
          Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16)),
          Text(label, style: const TextStyle(color: Colors.white54, fontSize: 11)),
        ],
      ),
    );
  }

  Widget _buildBadgeItem(Map<String, dynamic> badge) {
    return Container(
      width: 70,
      margin: const EdgeInsets.only(right: 12),
      child: Column(
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF00C853), Color(0xFF00E676)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF00C853).withOpacity(0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Icon(Icons.emoji_events, color: Colors.white, size: 24),
          ),
          const SizedBox(height: 4),
          Text(
            badge['name'] ?? '',
            style: const TextStyle(color: Colors.white70, fontSize: 10),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class S_SignOutButton extends StatelessWidget {
  final WidgetRef ref;
  const S_SignOutButton({super.key, required this.ref});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: () async {
        await Supabase.instance.client.auth.signOut();
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Signed out successfully')),
          );
        }
      },
      icon: const Icon(Icons.logout, color: Colors.red),
      label: const Text('Sign Out', style: TextStyle(color: Colors.red)),
      style: OutlinedButton.styleFrom(
        side: const BorderSide(color: Colors.red),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}
