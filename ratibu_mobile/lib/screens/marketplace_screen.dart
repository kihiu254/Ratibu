import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class MarketplaceScreen extends StatefulWidget {
  const MarketplaceScreen({super.key});

  @override
  State<MarketplaceScreen> createState() => _MarketplaceScreenState();
}

class _MarketplaceScreenState extends State<MarketplaceScreen> {
  final _supabase = Supabase.instance.client;
  final _businessController = TextEditingController();
  final _displayController = TextEditingController();
  final _categoryController = TextEditingController();
  final _notesController = TextEditingController();
  final _phoneController = TextEditingController();
  final _amountController = TextEditingController();
  final _transferNoteController = TextEditingController();
  String _role = 'vendor';
  bool _loading = true;
  bool _submitting = false;
  bool _transferring = false;
  Map<String, dynamic>? _overview;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _businessController.dispose();
    _displayController.dispose();
    _categoryController.dispose();
    _notesController.dispose();
    _phoneController.dispose();
    _amountController.dispose();
    _transferNoteController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) return;
      final data = await _supabase.rpc('get_marketplace_overview', params: {'p_user_id': user.id}) as dynamic;
      if (!mounted) return;
      setState(() {
        _overview = data is Map<String, dynamic> ? data : Map<String, dynamic>.from(data as Map);
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to load marketplace: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _requestRole() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;
    setState(() => _submitting = true);
    try {
      final data = await _supabase.rpc('request_marketplace_role', params: {
        'p_user_id': user.id,
        'p_role': _role,
        'p_business_name': _businessController.text.trim().isEmpty ? null : _businessController.text.trim(),
        'p_display_name': _displayController.text.trim().isEmpty ? null : _displayController.text.trim(),
        'p_service_category': _categoryController.text.trim().isEmpty ? null : _categoryController.text.trim(),
        'p_notes': _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
      }) as dynamic;
      final result = data is Map<String, dynamic> ? data : Map<String, dynamic>.from(data as Map);
      if (result['ok'] != true) {
        throw Exception(result['message'] ?? 'Application failed');
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result['message'] ?? 'Application submitted')));
      _businessController.clear();
      _displayController.clear();
      _categoryController.clear();
      _notesController.clear();
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _sendMoney() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;
    final amount = double.tryParse(_amountController.text.trim());
    if (_phoneController.text.trim().isEmpty || amount == null || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a valid recipient and amount')));
      return;
    }
    setState(() => _transferring = true);
    try {
      final data = await _supabase.rpc('internal_wallet_transfer', params: {
        'p_sender_user_id': user.id,
        'p_receiver_phone': _phoneController.text.trim(),
        'p_amount': amount,
        'p_note': _transferNoteController.text.trim().isEmpty ? null : _transferNoteController.text.trim(),
      }) as dynamic;
      final result = data is Map<String, dynamic> ? data : Map<String, dynamic>.from(data as Map);
      if (result['ok'] != true) {
        throw Exception(result['message'] ?? 'Transfer failed');
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result['message'] ?? 'Transfer completed')));
      _phoneController.clear();
      _amountController.clear();
      _transferNoteController.clear();
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _transferring = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = _supabase.auth.currentUser;
    if (currentUser == null) {
      return Scaffold(
        backgroundColor: const Color(0xFF0f172a),
        appBar: AppBar(
          title: const Text('Marketplace'),
          backgroundColor: const Color(0xFF0f172a),
          foregroundColor: Colors.white,
          elevation: 0,
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.lock_outline, color: Colors.white70, size: 52),
                const SizedBox(height: 16),
                const Text(
                  'Log in to check your credit score and access marketplace actions.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 18),
                FilledButton(
                  onPressed: () => context.go('/login'),
                  child: const Text('Go to Login'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final user = _overview?['user'] as Map<String, dynamic>?;
    final eligible = _overview?['eligible_roles'] as Map<String, dynamic>? ?? {};
    final chamaRoles = (_overview?['chama_roles'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final applications = (_overview?['applications'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final profiles = (_overview?['profiles'] as List?)?.cast<Map<String, dynamic>>() ?? [];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Marketplace'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _buildScoreCard(user),
                  const SizedBox(height: 16),
                  _buildEligibility(eligible),
                  const SizedBox(height: 16),
                  _buildChamaRoles(chamaRoles),
                  const SizedBox(height: 16),
                  _buildRoleForm(),
                  const SizedBox(height: 16),
                  _buildTransferForm(),
                  const SizedBox(height: 16),
                  _buildProfiles(profiles),
                  const SizedBox(height: 16),
                  _buildApplications(applications),
                ],
              ),
            ),
    );
  }

  Widget _buildScoreCard(Map<String, dynamic>? user) {
    final score = user?['credit_score'] ?? 500;
    final tier = user?['credit_tier'] ?? 'starter';
    final wallet = user?['wallet_balance'] ?? 0;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Credit Score', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text('$score', style: const TextStyle(fontSize: 42, fontWeight: FontWeight.w900)),
            Text('Tier: $tier'),
            const SizedBox(height: 16),
            Text('Wallet balance: KES ${NumberFormatHelper.format(wallet)}', style: const TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  Widget _buildEligibility(Map<String, dynamic> eligible) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Role Eligibility', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 12),
            _roleLine('Vendor', eligible['vendor'] == true),
            _roleLine('Agent', eligible['agent'] == true),
            _roleLine('Rider', eligible['rider'] == true),
          ],
        ),
      ),
    );
  }

  Widget _roleLine(String label, bool eligible) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(label),
      trailing: Chip(
        label: Text(eligible ? 'Eligible' : 'Locked'),
        backgroundColor: eligible ? const Color(0x1A00C853) : const Color(0x11000000),
      ),
    );
  }

  Widget _buildChamaRoles(List<Map<String, dynamic>> rows) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Chama Roles', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 12),
            if (rows.isEmpty)
              const Text('Your chama leadership roles will appear here.')
            else
              ...rows.map((row) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(row['chama_name']?.toString() ?? 'Chama'),
                    subtitle: Text(row['role']?.toString() ?? ''),
                  )),
          ],
        ),
      ),
    );
  }

  Widget _buildRoleForm() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Apply for a Role', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _role,
              items: const [
                DropdownMenuItem(value: 'vendor', child: Text('Vendor')),
                DropdownMenuItem(value: 'agent', child: Text('Agent')),
                DropdownMenuItem(value: 'rider', child: Text('Rider')),
              ],
              onChanged: (value) => setState(() => _role = value ?? 'vendor'),
              decoration: const InputDecoration(labelText: 'Role'),
            ),
            const SizedBox(height: 12),
            TextField(controller: _businessController, decoration: const InputDecoration(labelText: 'Business name')),
            TextField(controller: _displayController, decoration: const InputDecoration(labelText: 'Display name')),
            TextField(controller: _categoryController, decoration: const InputDecoration(labelText: 'Service category')),
            TextField(controller: _notesController, decoration: const InputDecoration(labelText: 'Notes')),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _submitting ? null : _requestRole,
              child: _submitting ? const CircularProgressIndicator() : const Text('Submit Application'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTransferForm() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Send Money', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 12),
            TextField(controller: _phoneController, decoration: const InputDecoration(labelText: 'Recipient phone')),
            TextField(controller: _amountController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Amount')),
            TextField(controller: _transferNoteController, decoration: const InputDecoration(labelText: 'Note')),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _transferring ? null : _sendMoney,
              child: _transferring ? const CircularProgressIndicator() : const Text('Transfer'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfiles(List<Map<String, dynamic>> rows) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Approved Profiles', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 12),
            if (rows.isEmpty)
              const Text('Approved vendor, agent, and rider profiles will appear here.')
            else
              ...rows.map((row) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(row['display_name']?.toString() ?? row['business_name']?.toString() ?? row['role']?.toString() ?? ''),
                    subtitle: Text([
                      if (row['till_number'] != null) 'Till ${row['till_number']}',
                      if (row['agent_number'] != null) 'Agent ${row['agent_number']}',
                      if (row['rider_code'] != null) 'Rider ${row['rider_code']}',
                    ].join(' · ')),
                  )),
          ],
        ),
      ),
    );
  }

  Widget _buildApplications(List<Map<String, dynamic>> rows) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Applications', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 12),
            if (rows.isEmpty)
              const Text('No marketplace applications yet.')
            else
              ...rows.map((row) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(row['role']?.toString() ?? ''),
                    subtitle: Text(row['business_name']?.toString() ?? row['display_name']?.toString() ?? ''),
                    trailing: Text(row['status']?.toString() ?? ''),
                  )),
          ],
        ),
      ),
    );
  }
}

class NumberFormatHelper {
  static String format(Object? value) {
    final number = num.tryParse(value?.toString() ?? '0') ?? 0;
    return number.toStringAsFixed(0);
  }
}
