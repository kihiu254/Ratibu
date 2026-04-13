import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../providers/auth_provider.dart';
import '../providers/home_provider.dart';
import '../services/security_service.dart';
import '../services/transaction_authorization_service.dart';
import '../services/savings_target_service.dart';
import '../utils/phone_utils.dart';
import '../models/savings_target.dart';

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
  String _kycStatus = 'pending';
  String _systemRole = 'user';
  List<String> _memberCategories = [];
  bool _biometricsEnabled = false;
  final _biometricService = BiometricService();
  final _transactionAuthorizationService = TransactionAuthorizationService();
  final _savingsTargetService = SavingsTargetService();
  List<SavingsTarget> _savingsTargets = [];
  bool _loadingSavingsTargets = false;
  final _adminPhoneController = TextEditingController();
  Map<String, dynamic>? _adminTargetUser;
  bool _adminSearching = false;
  bool _adminResetting = false;
  bool _adminPasswordResetting = false;

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
        _systemRole = data['system_role'] ?? 'user';
        
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
        _kycStatus = data['kyc_status'] ?? 'pending';
        _memberCategories = List<String>.from(data['member_category'] ?? []);
      });

      // Load Biometrics preference from SharedPreferences
      final prefs = await SharedPreferences.getInstance();
      setState(() {
        _biometricsEnabled = prefs.getBool('biometrics_enabled') ?? false;
        _loading = false;
      });

      await _loadSavingsTargets();
    } catch (e) {
      debugPrint('Error loading profile: $e');
      setState(() => _loading = false);
    }
  }

  Future<void> _loadSavingsTargets() async {
    setState(() => _loadingSavingsTargets = true);
    try {
      final targets = await _savingsTargetService.getSavingsTargets();
      if (mounted) {
        setState(() {
          _savingsTargets = targets;
        });
      }
    } catch (e) {
      debugPrint('Error loading savings targets: $e');
    } finally {
      if (mounted) {
        setState(() => _loadingSavingsTargets = false);
      }
    }
  }

  Future<void> _searchAdminTarget() async {
    final variants = kenyanPhoneVariants(_adminPhoneController.text);
    if (variants.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enter a valid phone number.')),
        );
      }
      return;
    }

    setState(() {
      _adminSearching = true;
      _adminTargetUser = null;
    });

    try {
      final result = await Supabase.instance.client
          .from('users')
          .select('id, first_name, last_name, email, phone, transaction_pin_hash, transaction_pin_enabled, transaction_pin_failed_attempts, transaction_pin_locked_until')
          .inFilter('phone', variants)
          .limit(1);

      final rows = List<Map<String, dynamic>>.from(result as List);
      if (rows.isEmpty) {
        throw 'No account found for that phone number.';
      }

      if (mounted) {
        setState(() => _adminTargetUser = rows.first);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _adminSearching = false);
      }
    }
  }

  Future<void> _adminResetTransactionPin() async {
    final target = _adminTargetUser;
    if (target == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: const Color(0xFF1e293b),
        title: const Text('Reset PIN', style: TextStyle(color: Colors.white)),
        content: Text(
          'Reset the transaction PIN for ${target['first_name'] ?? ''} ${target['last_name'] ?? ''}?',
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Reset', style: TextStyle(color: Color(0xFF00C853))),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _adminResetting = true);
    try {
      await _transactionAuthorizationService.adminResetTransactionPin(target['id'] as String);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Transaction PIN reset successfully.')),
        );
        setState(() => _adminTargetUser = null);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to reset PIN: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _adminResetting = false);
      }
    }
  }

  Future<void> _adminResetPassword() async {
    final target = _adminTargetUser;
    final email = target?['email'] as String?;
    if (target == null || email == null || email.trim().isEmpty) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: const Color(0xFF1e293b),
        title: const Text('Reset Password', style: TextStyle(color: Colors.white)),
        content: Text(
          'Send a password reset email to $email?',
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Send', style: TextStyle(color: Color(0xFF00C853))),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _adminPasswordResetting = true);
    try {
      await Supabase.instance.client.auth.resetPasswordForEmail(
        email,
        redirectTo: 'https://ratibu.vercel.app/reset-password',
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Password reset email sent.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to send password reset email: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _adminPasswordResetting = false);
      }
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

      final phoneVariants = kenyanPhoneVariants(_phoneController.text);
      if (phoneVariants.isEmpty) {
        throw 'Please enter a valid phone number.';
      }

      final duplicatePhone = await Supabase.instance.client
          .from('users')
          .select('id')
          .inFilter('phone', phoneVariants)
          .neq('id', user.id)
          .limit(1);

      if ((duplicatePhone as List).isNotEmpty) {
        throw 'This phone number is already linked to another Ratibu account.';
      }

      await Supabase.instance.client.from('users').upsert({
        'id': user.id,
        'first_name': _firstNameController.text,
        'last_name': _lastNameController.text,
        'phone': _phoneController.text,
        'bio': _bioController.text,
        'updated_at': DateTime.now().toIso8601String(),
      });

      // SYNC: Also update auth metadata so DepositScreen can find the phone number
      if (_phoneController.text.isNotEmpty) {
        await Supabase.instance.client.auth.updateUser(
          UserAttributes(
            data: { 'phone': _phoneController.text },
          ),
        );
      }

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
    _adminPhoneController.dispose();
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
      // appBar: AppBar(...),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      onPressed: () {
                        if (Navigator.canPop(context)) {
                          context.pop();
                        } else {
                          context.go('/dashboard');
                        }
                      },
                      icon: const Icon(Icons.arrow_back, color: Colors.white),
                    ),
                    const Text(
                      'Profile Settings',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    if (_saving)
                      const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    else
                      IconButton(
                        onPressed: _saveProfile,
                        icon: const Icon(Icons.check, color: Color(0xFF00C853)),
                      ),
                  ],
                ),
                const SizedBox(height: 24),
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
              const SizedBox(height: 12),
              
              // KYC Badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: _kycStatus == 'approved' 
                    ? const Color(0xFF00C853).withValues(alpha: 0.1) 
                    : Colors.amber.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(100),
                  border: Border.all(
                    color: _kycStatus == 'approved' 
                      ? const Color(0xFF00C853).withValues(alpha: 0.3) 
                      : Colors.amber.withValues(alpha: 0.3),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _kycStatus == 'approved' ? Icons.verified : Icons.shield_outlined,
                      size: 14,
                      color: _kycStatus == 'approved' ? const Color(0xFF00C853) : Colors.amber,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      _kycStatus == 'approved' ? 'Verified Member' : '${_kycStatus.toUpperCase()} Verification',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: _kycStatus == 'approved' ? const Color(0xFF00C853) : Colors.amber,
                      ),
                    ),
                  ],
                ),
              ),

              if (_kycStatus == 'not_started' || _kycStatus == 'rejected') ...[
                const SizedBox(height: 16),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 40),
                  child: ElevatedButton.icon(
                    onPressed: () => context.push('/kyc-form'),
                    icon: const Icon(Icons.shield_outlined, size: 18),
                    label: Text(_kycStatus == 'rejected' ? 'RE-SUBMIT KYC' : 'VERIFY PROFILE'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF00C853).withValues(alpha: 0.1),
                      foregroundColor: const Color(0xFF00C853),
                      elevation: 0,
                      side: const BorderSide(color: Color(0xFF00C853)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ] else if (_kycStatus == 'pending') ...[
                const SizedBox(height: 8),
                const Text(
                  'Your documents are under review (24-48 hrs)',
                  style: TextStyle(color: Colors.amber, fontSize: 12),
                  textAlign: TextAlign.center,
                ),
              ],

              if (_systemRole == 'admin' || _systemRole == 'super_admin') ...[
                const SizedBox(height: 24),
                _buildAdminPinResetSection(),
              ],
              
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
              
              // Dashboard Overview
              _buildDashboardOverview(),
              
               const SizedBox(height: 32),
               
               // Referral Section
               _buildReferralSection(),
               
               const SizedBox(height: 32),

               _buildSavingsTargetsSection(),

               const SizedBox(height: 32),
               
               // Achievements Section
               _buildAchievementsSection(),
              
              const SizedBox(height: 32),

              // App Updates Section
              _buildUpdatesCard(),
              
              const SizedBox(height: 32),

              // Categories Section
              _buildCategoriesSection(),
              
              const SizedBox(height: 32),

              // Security Section
              _buildSecuritySection(),
              const SizedBox(height: 16),
              _buildTransactionPinSection(),
              
              const SizedBox(height: 40),
              
              // Sign Out Button
              SignOutButton(ref: ref),
            ],
          ),
        ),
      ),
    ),
    );
  }

  Widget _buildDashboardOverview() {
    final homeState = ref.watch(homeProvider);
    final currencyFormat = NumberFormat.currency(symbol: 'KES ', decimalDigits: 2);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Dashboard Overview',
          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF1e293b), Color(0xFF0f172a)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.2),
                blurRadius: 10,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                   Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Total Balance',
                        style: TextStyle(color: Colors.white70, fontSize: 13),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        currencyFormat.format(homeState.totalBalance),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF00C853).withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.account_balance_wallet, color: Color(0xFF00C853), size: 20),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              const Divider(color: Colors.white10),
              const SizedBox(height: 12),
              const Text(
                'Recent Activity',
                style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              if (homeState.transactions.isEmpty)
                const Text('No recent transactions', style: TextStyle(color: Colors.white54, fontSize: 12))
              else
                ...homeState.transactions.take(2).map((tx) => Padding(
                  padding: const EdgeInsets.only(bottom: 8.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          tx.description ?? tx.type.toUpperCase(),
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Text(
                        '${tx.type == 'withdrawal' ? '-' : '+'} KES ${tx.amount.toStringAsFixed(0)}',
                        style: TextStyle(
                          color: tx.type == 'withdrawal' ? Colors.red[300] : const Color(0xFF00C853),
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                )),
              const SizedBox(height: 8),
              Center(
                child: TextButton(
                  onPressed: () {
                    // This is tricky since ProfileScreen is usually inside DashboardScreen tabs
                    // We can't easily switch tabs from here without a global state or parent notification
                    // But we can push the dashboard again or just leave it as a preview
                    // For now, let's just make it a preview as requested
                  },
                  child: const Text('View Full Dashboard', style: TextStyle(color: Color(0xFF00C853), fontSize: 12)),
                ),
              ),
            ],
          ),
        ),
      ],
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
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  _referralCode,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, letterSpacing: 2),
                ),
                Row(
                  children: [
                    GestureDetector(
                      onTap: () {
                        final shareUrl = 'https://ratibu.vercel.app/ref/$_referralCode';
                        SharePlus.instance.share(
                          ShareParams(
                            text: 'Join me on Ratibu! Use my referral code $_referralCode to sign up: $shareUrl',
                            subject: 'Join Ratibu',
                          ),
                        );
                      },
                      child: const Icon(Icons.share, color: Colors.white, size: 20),
                    ),
                    const SizedBox(width: 16),
                    GestureDetector(
                      onTap: () => GoRouter.of(context).push('/referrals'),
                      child: const Icon(Icons.arrow_forward_ios, color: Colors.white, size: 16),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSavingsTargetsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Savings Targets',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            TextButton.icon(
              onPressed: _showAddSavingsTargetDialog,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Add Target'),
              style: TextButton.styleFrom(foregroundColor: const Color(0xFF00C853)),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF1e293b),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
          ),
          child: _loadingSavingsTargets
              ? const Center(child: CircularProgressIndicator())
              : _savingsTargets.isEmpty
                  ? const Text(
                      'No personal savings targets yet. Add one for rent, daily payments, bill payment, or withdrawal planning.',
                      style: TextStyle(color: Colors.white54, fontSize: 13),
                    )
                  : Column(
                      children: _savingsTargets.map((target) {
                        final isActive = target.status == 'active';
                        final routeLabel = target.destinationLabel?.isNotEmpty == true
                            ? target.destinationLabel!
                            : _formatPurpose(target.purpose);

                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0f172a),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          target.name,
                                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          'Route to $routeLabel',
                                          style: const TextStyle(color: Colors.white54, fontSize: 12),
                                        ),
                                        if (target.savingsPeriodMonths != null)
                                          Text(
                                            'Savings period: ${target.savingsPeriodMonths} months',
                                            style: const TextStyle(color: Colors.white38, fontSize: 11),
                                          ),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: (target.status == 'completed'
                                              ? Colors.green
                                              : target.status == 'paused'
                                                  ? Colors.amber
                                                  : Colors.blue)
                                          .withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(100),
                                    ),
                                    child: Text(
                                      target.status.toUpperCase(),
                                      style: TextStyle(
                                        color: target.status == 'completed'
                                            ? Colors.greenAccent
                                            : target.status == 'paused'
                                                ? Colors.amber
                                                : Colors.lightBlueAccent,
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'KES ${target.currentAmount.toStringAsFixed(0)}',
                                    style: const TextStyle(color: Colors.white54, fontSize: 12),
                                  ),
                                  Text(
                                    'KES ${target.targetAmount.toStringAsFixed(0)}',
                                    style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(99),
                                child: LinearProgressIndicator(
                                  value: target.progressPercent / 100,
                                  minHeight: 8,
                                  backgroundColor: Colors.white12,
                                  valueColor: const AlwaysStoppedAnimation(Color(0xFF00C853)),
                                ),
                              ),
                              const SizedBox(height: 10),
                              Text(
                                target.allocationType == 'percentage'
                                    ? 'Auto allocation: ${target.allocationValue.toStringAsFixed(0)}% of matched savings'
                                    : 'Auto allocation: KES ${target.allocationValue.toStringAsFixed(0)} per matched savings event',
                                style: const TextStyle(color: Colors.white54, fontSize: 12),
                              ),
                              if (target.notes != null && target.notes!.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Text(
                                  target.notes!,
                                  style: const TextStyle(color: Colors.white38, fontSize: 12),
                                ),
                              ],
                              const SizedBox(height: 10),
                              Align(
                                alignment: Alignment.centerRight,
                                child: TextButton(
                                  onPressed: () async {
                                    final nextStatus = isActive ? 'paused' : 'active';
                                    await _savingsTargetService.updateSavingsTargetStatus(
                                      targetId: target.id,
                                      status: nextStatus,
                                    );
                                    await _loadSavingsTargets();
                                  },
                                  child: Text(isActive ? 'Pause target' : 'Activate target'),
                                ),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
        ),
      ],
    );
  }

  String _formatPurpose(String purpose) {
    switch (purpose) {
      case 'daily_payments':
        return 'Daily payments';
      case 'bill_payment':
        return 'Bill payment';
      default:
        return '${purpose[0].toUpperCase()}${purpose.substring(1)}';
    }
  }

  Future<void> _showAddSavingsTargetDialog() async {
    final nameController = TextEditingController();
    final destinationController = TextEditingController();
    final targetAmountController = TextEditingController();
    final currentAmountController = TextEditingController(text: '0');
    final allocationValueController = TextEditingController(text: '100');
    final notesController = TextEditingController();
    final earlyPenaltyController = TextEditingController(text: '5');
    String purpose = 'rent';
    String allocationType = 'percentage';
    bool autoAllocate = true;
    bool isLocked = false;
    int savingsPeriodMonths = 12;
    int lockPeriodMonths = 12;

    await showDialog<void>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1e293b),
              title: const Text('New Savings Target', style: TextStyle(color: Colors.white)),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildDialogField(controller: nameController, label: 'Target name'),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: purpose,
                      dropdownColor: const Color(0xFF0f172a),
                      style: const TextStyle(color: Colors.white),
                      decoration: _dialogDecoration('Purpose'),
                      items: const [
                        DropdownMenuItem(value: 'rent', child: Text('Rent')),
                        DropdownMenuItem(value: 'daily_payments', child: Text('Daily payments')),
                        DropdownMenuItem(value: 'bill_payment', child: Text('Bill payment')),
                        DropdownMenuItem(value: 'withdrawal', child: Text('Withdrawal reserve')),
                        DropdownMenuItem(value: 'custom', child: Text('Custom')),
                      ],
                      onChanged: (value) {
                        if (value != null) {
                          setModalState(() => purpose = value);
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    _buildDialogField(controller: destinationController, label: 'Destination label'),
                    const SizedBox(height: 12),
                    _buildDialogField(
                      controller: targetAmountController,
                      label: 'Target amount (KES)',
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 12),
                    _buildDialogField(
                      controller: currentAmountController,
                      label: 'Current saved (KES)',
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: allocationType,
                      dropdownColor: const Color(0xFF0f172a),
                      style: const TextStyle(color: Colors.white),
                      decoration: _dialogDecoration('Allocation type'),
                      items: const [
                        DropdownMenuItem(value: 'percentage', child: Text('Percentage')),
                        DropdownMenuItem(value: 'fixed_amount', child: Text('Fixed amount')),
                      ],
                      onChanged: (value) {
                        if (value != null) {
                          setModalState(() => allocationType = value);
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    _buildDialogField(
                      controller: allocationValueController,
                      label: allocationType == 'percentage' ? 'Allocation %' : 'Allocation amount (KES)',
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 12),
                    SwitchListTile.adaptive(
                      value: isLocked,
                      onChanged: (value) => setModalState(() => isLocked = value),
                      activeThumbColor: const Color(0xFF00C853),
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Lock savings account', style: TextStyle(color: Colors.white)),
                      subtitle: const Text('Deposits are allowed, withdrawals unlock on a set date', style: TextStyle(color: Colors.white54)),
                    ),
                    const SizedBox(height: 12),
                    if (isLocked)
                      DropdownButtonFormField<int>(
                        initialValue: lockPeriodMonths,
                        dropdownColor: const Color(0xFF0f172a),
                        style: const TextStyle(color: Colors.white),
                        decoration: _dialogDecoration('Lock period'),
                        items: const [
                          DropdownMenuItem(value: 3, child: Text('3 months')),
                          DropdownMenuItem(value: 6, child: Text('6 months')),
                          DropdownMenuItem(value: 12, child: Text('12 months')),
                          DropdownMenuItem(value: 24, child: Text('24 months')),
                          DropdownMenuItem(value: 36, child: Text('36 months')),
                        ],
                        onChanged: (value) {
                          if (value != null) setModalState(() => lockPeriodMonths = value);
                        },
                      )
                    else ...[
                      DropdownButtonFormField<int>(
                        initialValue: savingsPeriodMonths,
                        dropdownColor: const Color(0xFF0f172a),
                        style: const TextStyle(color: Colors.white),
                        decoration: _dialogDecoration('Savings period'),
                        items: const [
                          DropdownMenuItem(value: 3, child: Text('3 months')),
                          DropdownMenuItem(value: 6, child: Text('6 months')),
                          DropdownMenuItem(value: 12, child: Text('12 months')),
                          DropdownMenuItem(value: 24, child: Text('24 months')),
                          DropdownMenuItem(value: 36, child: Text('36 months')),
                        ],
                        onChanged: (value) {
                          if (value != null) setModalState(() => savingsPeriodMonths = value);
                        },
                      ),
                      const SizedBox(height: 12),
                      _buildDialogField(
                        controller: earlyPenaltyController,
                        label: 'Early withdrawal penalty (%)',
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      ),
                    ],
                    _buildDialogField(controller: notesController, label: 'Notes', maxLines: 3),
                    const SizedBox(height: 12),
                    SwitchListTile.adaptive(
                      value: autoAllocate,
                      onChanged: (value) => setModalState(() => autoAllocate = value),
                      activeThumbColor: const Color(0xFF00C853),
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Enable auto allocation', style: TextStyle(color: Colors.white)),
                      subtitle: const Text('Track how savings should flow toward this target', style: TextStyle(color: Colors.white54)),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: () async {
                    final targetAmount = double.tryParse(targetAmountController.text.trim());
                    final currentAmount = double.tryParse(currentAmountController.text.trim()) ?? 0;
                    final allocationValue = double.tryParse(allocationValueController.text.trim());
                    final earlyPenaltyPercent = double.tryParse(earlyPenaltyController.text.trim()) ?? 5;
                    final navigator = Navigator.of(context);
                    final messenger = ScaffoldMessenger.of(context);

                    if (nameController.text.trim().isEmpty || targetAmount == null || allocationValue == null) {
                      messenger.showSnackBar(
                        const SnackBar(content: Text('Please fill in the required target fields.')),
                      );
                      return;
                    }

                    await _savingsTargetService.createSavingsTarget(
                      name: nameController.text.trim(),
                      purpose: purpose,
                      destinationLabel: destinationController.text.trim(),
                      targetAmount: targetAmount,
                      currentAmount: currentAmount,
                      autoAllocate: autoAllocate,
                      allocationType: allocationType,
                      allocationValue: allocationValue,
                      notes: notesController.text.trim(),
                      isLocked: isLocked,
                      lockPeriodMonths: isLocked ? lockPeriodMonths : null,
                      savingsPeriodMonths: isLocked ? lockPeriodMonths : savingsPeriodMonths,
                      earlyWithdrawalPenaltyPercent: isLocked ? 0 : earlyPenaltyPercent,
                    );

                    if (!mounted) return;
                    navigator.pop();
                    await _loadSavingsTargets();
                    messenger.showSnackBar(
                      const SnackBar(content: Text('Savings target created successfully!')),
                    );
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF00C853)),
                  child: const Text('Save'),
                ),
              ],
            );
          },
        );
      },
    );
    earlyPenaltyController.dispose();
  }

  InputDecoration _dialogDecoration(String label) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: Colors.grey),
      filled: true,
      fillColor: const Color(0xFF0f172a),
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
    );
  }

  Widget _buildDialogField({
    required TextEditingController controller,
    required String label,
    TextInputType keyboardType = TextInputType.text,
    int maxLines = 1,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      maxLines: maxLines,
      style: const TextStyle(color: Colors.white),
      decoration: _dialogDecoration(label),
    );
  }

  Widget _buildSecuritySection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Security',
          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: const Color(0xFF1e293b),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
          ),
          child: Column(
            children: [
              _buildSecurityToggle(
                title: 'Face / Touch ID',
                subtitle: 'Unlock Ratibu with biometrics',
                value: _biometricsEnabled,
                icon: Icons.fingerprint,
                onChanged: _toggleBiometrics,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTransactionPinSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Transaction PIN',
          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1e293b),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Set or reset the PIN used to confirm deposits and withdrawals.',
                style: TextStyle(color: Colors.white70, fontSize: 13),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    try {
                      final success = await _transactionAuthorizationService.resetTransactionPin(context);
                      if (!success || !mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Transaction PIN saved successfully!')),
                      );
                    } catch (e) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Failed to update transaction PIN: $e')),
                        );
                      }
                    }
                  },
                  icon: const Icon(Icons.lock_reset, size: 18),
                  label: const Text('Reset Transaction PIN'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF00C853),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildAdminPinResetSection() {
    final target = _adminTargetUser;
    final hasPin = target?['transaction_pin_hash'] != null;
    final isLocked = target != null && (target['transaction_pin_enabled'] == false ||
        (target['transaction_pin_failed_attempts'] is num && (target['transaction_pin_failed_attempts'] as num) >= 3));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Member PIN Reset',
          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1e293b),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Reset a member PIN from mobile support tools.',
                style: TextStyle(color: Colors.white70, fontSize: 13),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _adminPhoneController,
                keyboardType: TextInputType.phone,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  labelText: 'Phone number',
                  labelStyle: const TextStyle(color: Colors.grey),
                  prefixIcon: const Icon(Icons.phone, color: Color(0xFF00C853)),
                  filled: true,
                  fillColor: const Color(0xFF0f172a),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _adminSearching ? null : _searchAdminTarget,
                  icon: _adminSearching
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.search, size: 18),
                  label: Text(_adminSearching ? 'Searching...' : 'Search member'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF00C853),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              if (target != null) ...[
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.04),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${target['first_name'] ?? ''} ${target['last_name'] ?? ''}'.trim(),
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${target['phone'] ?? ''}',
                        style: const TextStyle(color: Colors.white70, fontSize: 13),
                      ),
                      if (target['email'] != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          '${target['email'] ?? ''}',
                          style: const TextStyle(color: Colors.white54, fontSize: 12),
                        ),
                      ],
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _buildTinyStatusChip(
                            label: hasPin ? (isLocked ? 'Locked' : 'Set') : 'Not set',
                            color: hasPin ? (isLocked ? Colors.amber : const Color(0xFF00C853)) : Colors.white54,
                          ),
                          _buildTinyStatusChip(
                            label: 'Attempts: ${target['transaction_pin_failed_attempts'] ?? 0}',
                            color: Colors.white70,
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: _adminResetting ? null : _adminResetTransactionPin,
                          icon: _adminResetting
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Icon(Icons.lock_reset, size: 18),
                          label: Text(_adminResetting ? 'Resetting...' : 'Reset'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: const Color(0xFF0f172a),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: _adminPasswordResetting ? null : _adminResetPassword,
                          icon: _adminPasswordResetting
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Icon(Icons.mail_outline, size: 18),
                          label: Text(_adminPasswordResetting ? 'Sending...' : 'Send reset email'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: const Color(0xFF0f172a),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: () => context.push('/mpesa-reversal'),
                          icon: const Icon(Icons.undo, size: 18),
                          label: const Text('Reverse transaction'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: const Color(0xFF0f172a),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTinyStatusChip({required String label, required Color color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _buildSecurityToggle({
    required String title,
    required String subtitle,
    required bool value,
    required IconData icon,
    required Function(bool) onChanged,
  }) {
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: const Color(0xFF00C853).withValues(alpha: 0.1),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: const Color(0xFF00C853), size: 20),
      ),
      title: Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      subtitle: Text(subtitle, style: TextStyle(color: Colors.grey[400], fontSize: 12)),
      trailing: Switch.adaptive(
        value: value,
        activeThumbColor: const Color(0xFF00C853),
        onChanged: onChanged,
      ),
    );
  }

  Future<void> _toggleBiometrics(bool enabled) async {
    if (enabled) {
      final works = await _biometricService.authenticate();
      if (!works) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to verify biometrics.')),
          );
        }
        return;
      }
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('biometrics_enabled', enabled);
    setState(() => _biometricsEnabled = enabled);
    
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(enabled ? 'Biometrics enabled.' : 'Biometrics disabled.')),
      );
    }
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
                  color: const Color(0xFF00C853).withValues(alpha: 0.3),
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

  Widget _buildUpdatesCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF00C853).withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.system_update_alt, color: Color(0xFF00C853)),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Software Update',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                ),
                Text(
                  'Check for new app versions and features.',
                  style: TextStyle(color: Colors.grey[400], fontSize: 13),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => context.push('/updates'),
            icon: const Icon(Icons.arrow_forward_ios, color: Colors.grey, size: 16),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoriesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Member Categories',
          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        if (_memberCategories.isEmpty)
          Text(
            'No categories selected yet.',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontStyle: FontStyle.italic),
          )
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _memberCategories.map((cat) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
              ),
              child: Text(
                cat,
                style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold),
              ),
            )).toList(),
          ),
      ],
    );
  }
}

class SignOutButton extends ConsumerWidget {
  final WidgetRef ref;
  const SignOutButton({super.key, required this.ref});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return OutlinedButton.icon(
      onPressed: () async {
        // Use the provider to sign out, which updates the state and triggers navigation
        await ref.read(authProvider.notifier).signOut();
        
        // Navigation is handled by the auth state listener in the main app layout or login screen
        // But if we are in a tab, we might need to be popped or the router refreshed
        // transformAuth listens to the provider, so GoRouter should redirect automatically
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

