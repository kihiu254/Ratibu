import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/marketplace_models.dart';
import '../services/credit_score_service.dart';

class MarketplaceScreen extends StatefulWidget {
  const MarketplaceScreen({super.key});

  @override
  State<MarketplaceScreen> createState() => _MarketplaceScreenState();
}

class _MarketplaceScreenState extends State<MarketplaceScreen> {
  final _service = CreditScoreService();
  final _businessController = TextEditingController();
  final _displayController = TextEditingController();
  final _categoryController = TextEditingController();
  final _notesController = TextEditingController();
  String _role = 'vendor';
  bool _loading = true;
  bool _submitting = false;
  MarketplaceOverview? _overview;
  CreditScoreBreakdown? _breakdown;

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
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final overview = await _service.fetchMarketplaceOverview();
      final breakdown = await _service.fetchCreditScoreBreakdown();
      if (!mounted) return;
      setState(() {
        _overview = overview;
        _breakdown = breakdown;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load marketplace: $e')),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _requestRole() async {
    setState(() => _submitting = true);
    try {
      final result = await _service.requestMarketplaceRole(
        role: _role,
        businessName: _businessController.text.trim().isEmpty ? null : _businessController.text.trim(),
        displayName: _displayController.text.trim().isEmpty ? null : _displayController.text.trim(),
        serviceCategory: _categoryController.text.trim().isEmpty ? null : _categoryController.text.trim(),
        notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
      );
      if (result['ok'] != true) {
        throw Exception(result['message'] ?? 'Application failed');
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result['message'] ?? 'Application submitted')),
      );
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

  @override
  Widget build(BuildContext context) {
    final currentUser = Supabase.instance.client.auth.currentUser;
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
                  onPressed: () => context.go('/login?redirectTo=/marketplace'),
                  child: const Text('Go to Login'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final overview = _overview;
    final breakdown = _breakdown;

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
                  _buildScoreCard(overview?.user),
                  const SizedBox(height: 16),
                  _buildEligibility(overview?.eligibleRoles),
                  const SizedBox(height: 16),
                  _buildChamaRoles(overview?.chamaRoles ?? const <ChamaRoleSummary>[]),
                  if (breakdown != null) ...[
                    const SizedBox(height: 16),
                    _buildScoreBreakdown(breakdown),
                  ],
                  const SizedBox(height: 16),
                  _buildRoleForm(),
                  const SizedBox(height: 16),
                  _buildWalletLink(),
                  const SizedBox(height: 16),
                  _buildProfiles(overview?.profiles ?? const <MarketplaceProfileRecord>[]),
                  const SizedBox(height: 16),
                  _buildApplications(overview?.applications ?? const <MarketplaceApplicationRecord>[]),
                ],
              ),
            ),
    );
  }

  Widget _buildScoreCard(MarketplaceUserSnapshot? user) {
    final score = user?.creditScore ?? 500;
    final tier = user?.creditTier ?? 'starter';
    final wallet = user?.walletBalance ?? 0;
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
            Text(
              'Wallet balance: KES ${NumberFormatHelper.format(wallet)}',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEligibility(MarketplaceRoleEligibility? eligible) {
    final roles = eligible ??
        const MarketplaceRoleEligibility(
          vendor: false,
          rider: false,
          agent: false,
        );
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Role Eligibility', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 12),
            _roleLine('Vendor', roles.vendor),
            _roleLine('Agent', roles.agent),
            _roleLine('Rider', roles.rider),
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

  Widget _buildChamaRoles(List<ChamaRoleSummary> rows) {
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
              ...rows.map(
                (row) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(row.chamaName),
                  subtitle: Text('${row.role} role • +${row.scoreWeight} score weight'),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildScoreBreakdown(CreditScoreBreakdown breakdown) {
    final components = breakdown.components;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Score Breakdown', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            Text(breakdown.summary),
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                _scorePill('Base ${components['base_score'] ?? 500}'),
                _scorePill('Rewards +${components['points_component'] ?? 0}'),
                _scorePill('Refs +${components['referral_component'] ?? 0}'),
                _scorePill('Savings +${components['contribution_component'] ?? 0}'),
                _scorePill('Penalty ${components['penalty_component'] ?? 0}'),
              ],
            ),
            const SizedBox(height: 12),
            const Text(
              'Chama leadership roles can improve your score: admin +20, treasurer +15, secretary +10.',
              style: TextStyle(color: Colors.black54),
            ),
          ],
        ),
      ),
    );
  }

  Widget _scorePill(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF0f172a),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
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
            TextField(
              controller: _businessController,
              decoration: const InputDecoration(labelText: 'Business name'),
            ),
            TextField(
              controller: _displayController,
              decoration: const InputDecoration(labelText: 'Display name'),
            ),
            TextField(
              controller: _categoryController,
              decoration: const InputDecoration(labelText: 'Service category'),
            ),
            TextField(
              controller: _notesController,
              decoration: const InputDecoration(labelText: 'Notes'),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _submitting ? null : _requestRole,
              child: _submitting
                  ? const CircularProgressIndicator()
                  : const Text('Submit Application'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWalletLink() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Wallet', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            const Text('Open the wallet screen to send money and review transfer history.'),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => context.push('/wallet'),
              child: const Text('Open Wallet'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfiles(List<MarketplaceProfileRecord> rows) {
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
              ...rows.map(
                (row) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(row.displayName ?? row.businessName ?? row.role),
                  subtitle: Text([
                    if (row.tillNumber != null) 'Till ${row.tillNumber}',
                    if (row.agentNumber != null) 'Agent ${row.agentNumber}',
                    if (row.riderCode != null) 'Rider ${row.riderCode}',
                    if (row.deliveryZone != null) 'Zone ${row.deliveryZone}',
                  ].join(' · ')),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildApplications(List<MarketplaceApplicationRecord> rows) {
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
              ...rows.map(
                (row) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(row.role),
                  subtitle: Text(row.businessName ?? row.displayName ?? ''),
                  trailing: Text(row.status),
                ),
              ),
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
