import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/wallet_service.dart';

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  final _service = WalletService();
  final _phoneController = TextEditingController();
  final _amountController = TextEditingController();
  final _noteController = TextEditingController();
  bool _sending = false;
  late Future<WalletOverview?> _future;

  @override
  void initState() {
    super.initState();
    _future = _service.fetchOverview();
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _amountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    setState(() {
      _future = _service.fetchOverview();
    });
    await _future;
  }

  Future<void> _sendMoney() async {
    final phone = _phoneController.text.trim();
    final amount = double.tryParse(_amountController.text.trim());
    if (phone.isEmpty || amount == null || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a valid recipient and amount')));
      return;
    }

    setState(() => _sending = true);
    try {
      final result = await _service.sendMoney(
        receiverPhone: phone,
        amount: amount,
        note: _noteController.text.trim().isEmpty ? null : _noteController.text.trim(),
      );
      if (result['ok'] != true) {
        throw Exception(result['message']?.toString() ?? 'Transfer failed');
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result['message']?.toString() ?? 'Transfer completed')));
      _phoneController.clear();
      _amountController.clear();
      _noteController.clear();
      await _refresh();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = Supabase.instance.client.auth.currentUser;
    if (currentUser == null) {
      return Scaffold(
        backgroundColor: const Color(0xFF0f172a),
        appBar: AppBar(
          title: const Text('Wallet'),
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
                  'Log in to view your wallet balance and send money to Ratibu members.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 18),
                FilledButton(
                  onPressed: () => context.go('/login?redirectTo=/wallet'),
                  child: const Text('Go to Login'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        title: const Text('Wallet'),
        backgroundColor: const Color(0xFF0f172a),
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: () => context.push('/marketplace'),
            icon: const Icon(Icons.shield),
            tooltip: 'Marketplace',
          ),
        ],
      ),
      body: FutureBuilder<WalletOverview?>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final overview = snapshot.data;
          final user = overview?.user;
          final transfers = overview?.transfers ?? const <WalletTransferRecord>[];
          final balance = user?['wallet_balance'] ?? 0;
          final score = user?['credit_score'] ?? 500;
          final tier = user?['credit_tier'] ?? 'starter';

          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                _WalletHero(balance: balance, score: score, tier: tier),
                const SizedBox(height: 16),
                _TransferForm(
                  phoneController: _phoneController,
                  amountController: _amountController,
                  noteController: _noteController,
                  sending: _sending,
                  onSend: _sendMoney,
                ),
                const SizedBox(height: 16),
                _QuickLinks(onOpenProducts: () => context.push('/products')),
                const SizedBox(height: 16),
                _TransferHistory(transfers: transfers),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _WalletHero extends StatelessWidget {
  const _WalletHero({
    required this.balance,
    required this.score,
    required this.tier,
  });

  final Object? balance;
  final Object? score;
  final Object? tier;

  @override
  Widget build(BuildContext context) {
    final amount = (balance as num?)?.toDouble() ?? 0;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          colors: [Color(0xFF0f172a), Color(0xFF1e293b)],
        ),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Wallet balance', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(
            'KES ${amount.toStringAsFixed(0)}',
            style: const TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _Pill(label: 'Credit score ${score ?? 500}'),
              _Pill(label: 'Tier ${tier ?? 'starter'}'),
              const _Pill(label: 'Low-cost internal transfers'),
            ],
          ),
        ],
      ),
    );
  }
}

class _TransferForm extends StatelessWidget {
  const _TransferForm({
    required this.phoneController,
    required this.amountController,
    required this.noteController,
    required this.sending,
    required this.onSend,
  });

  final TextEditingController phoneController;
  final TextEditingController amountController;
  final TextEditingController noteController;
  final bool sending;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Send Money', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 12),
            TextField(
              controller: phoneController,
              decoration: const InputDecoration(labelText: 'Recipient phone'),
            ),
            TextField(
              controller: amountController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Amount'),
            ),
            TextField(
              controller: noteController,
              decoration: const InputDecoration(labelText: 'Note'),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: sending ? null : onSend,
              child: sending ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Transfer'),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickLinks extends StatelessWidget {
  const _QuickLinks({required this.onOpenProducts});

  final VoidCallback onOpenProducts;

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Next steps', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                FilledButton.tonal(
                  onPressed: () => context.push('/marketplace'),
                  child: const Text('Marketplace'),
                ),
                FilledButton.tonal(
                  onPressed: onOpenProducts,
                  child: const Text('Products'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _TransferHistory extends StatelessWidget {
  const _TransferHistory({required this.transfers});

  final List<WalletTransferRecord> transfers;

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Recent transfers', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 12),
            if (transfers.isEmpty)
              const Text('No transfers yet.')
            else
              ...transfers.map(
                (transfer) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(
                    backgroundColor: transfer.direction == 'outgoing'
                        ? const Color(0x1A00C853)
                        : const Color(0x1A38BDF8),
                    child: Icon(
                      transfer.direction == 'outgoing' ? Icons.north_east : Icons.south_west,
                      color: transfer.direction == 'outgoing' ? const Color(0xFF00C853) : const Color(0xFF38BDF8),
                    ),
                  ),
                  title: Text('${transfer.direction == 'outgoing' ? '-' : '+'} KES ${transfer.amount.toStringAsFixed(0)}'),
                  subtitle: Text([
                    if (transfer.note != null && transfer.note!.isNotEmpty) transfer.note!,
                    transfer.status.toUpperCase(),
                  ].join(' · ')),
                  trailing: Text(
                    _formatDate(transfer.createdAt),
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime value) {
    return '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')}/${value.year}';
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
    );
  }
}
