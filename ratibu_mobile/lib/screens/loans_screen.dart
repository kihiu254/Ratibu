import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const loanProducts = [
  (
    title: 'Chama Booster',
    description: 'For registered chamas only.',
    formula: 'Loan amount = 3x chama savings',
    badge: 'Chama only',
  ),
  (
    title: 'Business Loan',
    description: 'For Ratibu vendors who are members of a chama.',
    formula: 'Loan amount = 3.5x vendor savings',
    badge: 'Vendor + chama',
  ),
  (
    title: 'Personal Loan',
    description: 'For members with strong financial discipline in their groups.',
    formula: 'Loan amount = 3x member savings',
    badge: 'Member discipline',
  ),
];

class LoansScreen extends StatefulWidget {
  const LoansScreen({super.key});

  @override
  State<LoansScreen> createState() => _LoansScreenState();
}

class _LoansScreenState extends State<LoansScreen> {
  final _fmt = NumberFormat('#,##0');
  bool _loading = true;
  List<Map<String, dynamic>> _loans = [];
  List<Map<String, dynamic>> _requests = [];
  double _totalBorrowed = 0;
  double _activeBalance = 0;

  @override
  void initState() {
    super.initState();
    _loadLoans();
  }

  Future<void> _loadLoans() async {
    setState(() => _loading = true);
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      final response = await Supabase.instance.client
          .from('loans')
          .select('id, amount, interest_rate, duration_months, status, disbursement_date, due_date, created_at, chamas(name)')
          .eq('borrower_id', user.id)
          .order('created_at', ascending: false);

      final requestResponse = await Supabase.instance.client
          .from('loan_requests')
          .select('id, amount, purpose, term_months, status, notes, created_at, updated_at')
          .eq('borrower_id', user.id)
          .order('created_at', ascending: false);

      final rows = List<Map<String, dynamic>>.from(response as List);
      final requests = List<Map<String, dynamic>>.from(requestResponse as List);
      double total = 0;
      double active = 0;

      for (final row in rows) {
        final amount = (row['amount'] as num? ?? 0).toDouble();
        total += amount;
        final status = (row['status'] as String? ?? '').toLowerCase();
        if (status == 'approved' || status == 'active' || status == 'pending') {
          active += amount;
        }
      }

      if (!mounted) return;
      setState(() {
        _loans = rows;
        _requests = requests;
        _totalBorrowed = total;
        _activeBalance = active;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loans = [];
        _requests = [];
        _totalBorrowed = 0;
        _activeBalance = 0;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _statusLabel(String? status) {
    final value = (status ?? 'pending').toLowerCase();
    switch (value) {
      case 'active':
        return 'Active';
      case 'approved':
        return 'Approved';
      case 'repaid':
        return 'Repaid';
      case 'defaulted':
        return 'Defaulted';
      default:
        return 'Pending';
    }
  }

  Color _statusColor(String? status) {
    final value = (status ?? 'pending').toLowerCase();
    switch (value) {
      case 'active':
      case 'approved':
        return const Color(0xFF00C853);
      case 'repaid':
        return const Color(0xFF38BDF8);
      case 'defaulted':
        return Colors.redAccent;
      default:
        return const Color(0xFFF59E0B);
    }
  }

  String _formatDate(dynamic value) {
    if (value == null) return 'Not set';
    final parsed = DateTime.tryParse(value.toString());
    if (parsed == null) return value.toString();
    return DateFormat('dd MMM yyyy').format(parsed.toLocal());
  }

  Future<void> _openLoanRequestDialog({String presetPurpose = 'Working capital'}) async {
    final amountController = TextEditingController();
    final purposeController = TextEditingController(text: presetPurpose);
    final termController = TextEditingController(text: '3');
    final notesController = TextEditingController();
    final messenger = ScaffoldMessenger.of(context);

    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: const Color(0xFF1e293b),
        title: const Text('Request Loan', style: TextStyle(color: Colors.white)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: amountController,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Colors.white),
                decoration: _inputDecoration('Amount (KES)'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: purposeController,
                style: const TextStyle(color: Colors.white),
                decoration: _inputDecoration('Purpose'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: termController,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Colors.white),
                decoration: _inputDecoration('Term (months)'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: notesController,
                maxLines: 3,
                style: const TextStyle(color: Colors.white),
                decoration: _inputDecoration('Notes'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
          ),
          TextButton(
            onPressed: () async {
              final navigator = Navigator.of(dialogContext);
              final amount = double.tryParse(amountController.text.trim());
              final purpose = purposeController.text.trim();
              final term = int.tryParse(termController.text.trim()) ?? 3;
              if (amount == null || amount <= 0 || purpose.isEmpty) {
                if (mounted) {
                  messenger.showSnackBar(
                    const SnackBar(content: Text('Enter a valid amount and purpose')),
                  );
                }
                return;
              }

              try {
                final user = Supabase.instance.client.auth.currentUser;
                if (user == null) throw 'You need to log in first.';
                await Supabase.instance.client.from('loan_requests').insert({
                  'borrower_id': user.id,
                  'amount': amount,
                  'purpose': purpose,
                  'term_months': term,
                  'notes': notesController.text.trim(),
                });
                if (!mounted) return;
                navigator.pop();
                await _loadLoans();
                messenger.showSnackBar(
                  const SnackBar(
                    content: Text('Loan request submitted successfully!'),
                    backgroundColor: Color(0xFF00C853),
                  ),
                );
              } catch (e) {
                if (mounted) {
                  messenger.showSnackBar(
                    SnackBar(content: Text('Failed to submit request: $e')),
                  );
                }
              }
            },
            child: const Text('Submit', style: TextStyle(color: Color(0xFF00C853))),
          ),
        ],
      ),
    );
  }

  InputDecoration _inputDecoration(String label) => InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: Colors.white60),
        filled: true,
        fillColor: const Color(0xFF0f172a),
        enabledBorder: OutlineInputBorder(
          borderSide: const BorderSide(color: Colors.white24),
          borderRadius: BorderRadius.circular(12),
        ),
        focusedBorder: OutlineInputBorder(
          borderSide: const BorderSide(color: Color(0xFF00C853)),
          borderRadius: BorderRadius.circular(12),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        title: const Text('Loans & Credit'),
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: RefreshIndicator(
        onRefresh: _loadLoans,
        color: const Color(0xFF00C853),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF111827), Color(0xFF1e293b)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.white10),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Loans built into Ratibu',
                    style: TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Track your loan records, status, and repayment timeline from one place.',
                    style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w900, height: 1.2),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _SummaryChip(
                          label: 'Total Borrowed',
                          value: 'KES ${_fmt.format(_totalBorrowed)}',
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _SummaryChip(
                          label: 'Active Balance',
                          value: 'KES ${_fmt.format(_activeBalance)}',
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Loan products',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            ...loanProducts.map((product) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _LoanProductCard(
                  title: product.title,
                  description: product.description,
                  formula: product.formula,
                  badge: product.badge,
                  onRequest: () => _openLoanRequestDialog(presetPurpose: product.title),
                ),
              );
            }),
            const SizedBox(height: 4),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _openLoanRequestDialog(),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00C853),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                icon: const Icon(Icons.add_circle_outline),
                label: const Text('Request Loan'),
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                _NavChip(label: 'KCB M-PESA', onTap: () => context.push('/kcb-mpesa')),
                _NavChip(label: 'Products', onTap: () => context.push('/products')),
                _NavChip(label: 'Statement', onTap: () => context.push('/statement?accountType=all&accountName=All+Transactions')),
              ],
            ),
            const SizedBox(height: 20),
            if (_loading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 32),
                  child: CircularProgressIndicator(color: Color(0xFF00C853)),
                ),
              )
            else if (_loans.isEmpty)
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFF1e293b),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'No loans found yet.',
                      style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Your loan history will appear here once a loan is approved or disbursed. You can still explore KCB M-PESA and the rest of the product suite.',
                      style: TextStyle(color: Colors.white70, height: 1.5),
                    ),
                    const SizedBox(height: 14),
                    ElevatedButton(
                      onPressed: () => context.push('/kcb-mpesa'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF00C853),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Open KCB M-PESA'),
                    ),
                  ],
                ),
              ),
            if (_loans.isEmpty) ...[
              const SizedBox(height: 16),
              const Text(
                'Loan options',
                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              _LoanOptionCard(
                icon: Icons.account_balance,
                title: 'KCB M-PESA Loans',
                description: 'Check the KCB hub for savings-linked loan journeys and related payment flows.',
                actionLabel: 'Open Hub',
                onTap: () => context.push('/kcb-mpesa'),
              ),
              const SizedBox(height: 12),
              _LoanOptionCard(
                icon: Icons.inventory_2,
                title: 'Products & Credit',
                description: 'Review the Ratibu product suite, including loans, credit, and automation features.',
                actionLabel: 'Open Products',
                onTap: () => context.push('/products'),
              ),
              const SizedBox(height: 12),
              _LoanOptionCard(
                icon: Icons.receipt_long,
                title: 'Loan-related statements',
                description: 'See any loan-related debits, repayments, and disbursement activity in your statement.',
                actionLabel: 'Open Statement',
                onTap: () => context.push('/statement?accountType=all&accountName=All+Transactions'),
              ),
            ] else ...[
              ..._loans.map(
                (loan) => Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: _LoanCard(
                    loan: loan,
                    fmt: _fmt,
                    statusLabel: _statusLabel(loan['status'] as String?),
                    statusColor: _statusColor(loan['status'] as String?),
                    formatDate: _formatDate,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 18),
            const Text(
              'Loan requests',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            if (_requests.isEmpty)
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: const Color(0xFF1e293b),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white10),
                ),
                child: const Text(
                  'No loan requests yet. Tap Request Loan to submit one.',
                  style: TextStyle(color: Colors.white70),
                ),
              )
            else
              ..._requests.map(
                (request) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _LoanRequestCard(request: request),
                ),
              ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFF111827),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.white10),
              ),
              child: const Text(
                'Loans on Ratibu are tracked from the same account that stores your chamas and transactions, so your statement stays in sync with the rest of the app.',
                style: TextStyle(color: Colors.white70, height: 1.5),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryChip extends StatelessWidget {
  final String label;
  final String value;

  const _SummaryChip({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Colors.white54, fontSize: 12)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

class _NavChip extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _NavChip({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      label: Text(label),
      onPressed: onTap,
      backgroundColor: const Color(0xFF1e293b),
      labelStyle: const TextStyle(color: Colors.white),
      side: const BorderSide(color: Colors.white12),
    );
  }
}

class _LoanProductCard extends StatelessWidget {
  final String title;
  final String description;
  final String formula;
  final String badge;
  final VoidCallback onRequest;

  const _LoanProductCard({
    required this.title,
    required this.description,
    required this.formula,
    required this.badge,
    required this.onRequest,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: const Color(0xFF00C853).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              badge,
              style: const TextStyle(
                color: Color(0xFF00C853),
                fontSize: 10,
                fontWeight: FontWeight.w900,
                letterSpacing: 0.8,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            title,
            style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          Text(
            description,
            style: const TextStyle(color: Colors.white70, height: 1.4),
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.04),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Amount formula',
                  style: TextStyle(color: Colors.white54, fontSize: 12),
                ),
                const SizedBox(height: 4),
                Text(
                  formula,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: onRequest,
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white,
              side: const BorderSide(color: Color(0xFF00C853)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
            icon: const Icon(Icons.arrow_forward),
            label: const Text('Request this loan'),
          ),
        ],
      ),
    );
  }
}

class _LoanCard extends StatelessWidget {
  final Map<String, dynamic> loan;
  final NumberFormat fmt;
  final String statusLabel;
  final Color statusColor;
  final String Function(dynamic value) formatDate;

  const _LoanCard({
    required this.loan,
    required this.fmt,
    required this.statusLabel,
    required this.statusColor,
    required this.formatDate,
  });

  @override
  Widget build(BuildContext context) {
    final amount = (loan['amount'] as num? ?? 0).toDouble();
    final rate = (loan['interest_rate'] as num?)?.toDouble();
    final duration = loan['duration_months'];
    final chama = loan['chamas'] is Map ? (loan['chamas'] as Map)['name']?.toString() : null;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white10),
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
                      chama?.isNotEmpty == true ? chama! : 'Personal Loan',
                      style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Created ${formatDate(loan['created_at'])}',
                      style: const TextStyle(color: Colors.white54, fontSize: 12),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: statusColor.withValues(alpha: 0.35)),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: _LoanStat(label: 'Amount', value: 'KES ${fmt.format(amount)}')),
              const SizedBox(width: 10),
              Expanded(
                child: _LoanStat(
                  label: 'Interest',
                  value: rate == null ? '0%' : '${rate.toStringAsFixed(rate % 1 == 0 ? 0 : 1)}%',
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _LoanStat(
                  label: 'Duration',
                  value: duration == null ? 'n/a' : '$duration months',
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Due ${formatDate(loan['due_date'])}',
            style: const TextStyle(color: Colors.white70, fontSize: 13),
          ),
          const SizedBox(height: 4),
          Text(
            'Disbursement ${formatDate(loan['disbursement_date'])}',
            style: const TextStyle(color: Colors.white54, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _LoanStat extends StatelessWidget {
  final String label;
  final String value;

  const _LoanStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Colors.white54, fontSize: 11)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

class _LoanOptionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final String actionLabel;
  final VoidCallback onTap;

  const _LoanOptionCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.actionLabel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF00C853).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: const Color(0xFF00C853)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                Text(description, style: const TextStyle(color: Colors.white70, height: 1.4)),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: onTap,
                  child: Text(actionLabel, style: const TextStyle(color: Color(0xFF00C853), fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LoanRequestCard extends StatelessWidget {
  final Map<String, dynamic> request;

  const _LoanRequestCard({required this.request});

  @override
  Widget build(BuildContext context) {
    final amount = (request['amount'] as num? ?? 0).toDouble();
    final term = request['term_months'];
    final status = (request['status'] as String? ?? 'pending').toLowerCase();
    final purpose = request['purpose']?.toString() ?? 'Loan request';
    final notes = request['notes']?.toString() ?? '';

    final color = switch (status) {
      'approved' => const Color(0xFF00C853),
      'rejected' => Colors.redAccent,
      'disbursed' => const Color(0xFF38BDF8),
      _ => const Color(0xFFF59E0B),
    };

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  purpose,
                  style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: color.withValues(alpha: 0.35)),
                ),
                child: Text(
                  status.toUpperCase(),
                  style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text('KES ${NumberFormat('#,##0').format(amount)}', style: const TextStyle(color: Colors.white70)),
          const SizedBox(height: 4),
          Text('Term: ${term ?? 3} months', style: const TextStyle(color: Colors.white54, fontSize: 12)),
          if (notes.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(notes, style: const TextStyle(color: Colors.white60, height: 1.4)),
          ],
        ],
      ),
    );
  }
}
