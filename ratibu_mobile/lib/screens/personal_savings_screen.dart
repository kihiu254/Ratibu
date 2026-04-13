import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/savings_target.dart';
import '../services/savings_target_service.dart';

class PersonalSavingsScreen extends ConsumerStatefulWidget {
  const PersonalSavingsScreen({super.key});

  @override
  ConsumerState<PersonalSavingsScreen> createState() => _PersonalSavingsScreenState();
}

class _PersonalSavingsScreenState extends ConsumerState<PersonalSavingsScreen> {
  final _service = SavingsTargetService();
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _destinationController = TextEditingController();
  final _targetAmountController = TextEditingController();
  final _currentAmountController = TextEditingController(text: '0');
  final _allocationValueController = TextEditingController(text: '100');
  final _notesController = TextEditingController();
  final _earlyPenaltyController = TextEditingController(text: '5');

  List<SavingsTarget> _targets = [];
  bool _loading = true;
  bool _saving = false;
  bool _showForm = false;
  bool _autoAllocate = true;
  String _purpose = 'emergency';
  String _allocationType = 'percentage';
  bool _isLocked = false;
  int _savingsPeriodMonths = 12;
  double _earlyWithdrawalPenaltyPercent = 5;
  int _lockPeriodMonths = 12;

  @override
  void initState() {
    super.initState();
    _loadTargets();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _destinationController.dispose();
    _targetAmountController.dispose();
    _currentAmountController.dispose();
    _allocationValueController.dispose();
    _notesController.dispose();
    _earlyPenaltyController.dispose();
    super.dispose();
  }

  Future<void> _loadTargets() async {
    setState(() => _loading = true);
    try {
      // Ensure session is available before querying
      final session = Supabase.instance.client.auth.currentSession;
      if (session == null) {
        // Try recovering session
        await Supabase.instance.client.auth.refreshSession();
      }
      final targets = await _service.getSavingsTargets();
      if (mounted) setState(() => _targets = targets);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load savings plans: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createTarget() async {
    if (!_formKey.currentState!.validate()) return;

    // Ensure session before insert
    final session = Supabase.instance.client.auth.currentSession;
    if (session == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Session expired. Please log in again.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      _earlyWithdrawalPenaltyPercent =
          double.tryParse(_earlyPenaltyController.text.trim()) ?? 5;
      await _service.createSavingsTarget(
        name: _nameController.text.trim(),
        purpose: _purpose,
        destinationLabel: _destinationController.text.trim(),
        targetAmount: double.parse(_targetAmountController.text.trim()),
        currentAmount: double.tryParse(_currentAmountController.text.trim()) ?? 0,
        autoAllocate: _autoAllocate,
        allocationType: _allocationType,
        allocationValue: double.parse(_allocationValueController.text.trim()),
        notes: _notesController.text.trim(),
        isLocked: _isLocked,
        lockPeriodMonths: _isLocked ? _lockPeriodMonths : null,
        savingsPeriodMonths: _isLocked ? _lockPeriodMonths : _savingsPeriodMonths,
        earlyWithdrawalPenaltyPercent: _isLocked ? 0 : _earlyWithdrawalPenaltyPercent,
      );

      _formKey.currentState!.reset();
      _nameController.clear();
      _destinationController.clear();
      _targetAmountController.clear();
      _currentAmountController.text = '0';
      _allocationValueController.text = '100';
      _notesController.clear();
      _earlyPenaltyController.text = '5';

      if (mounted) {
        setState(() {
          _showForm = false;
          _purpose = 'emergency';
          _allocationType = 'percentage';
          _autoAllocate = true;
          _isLocked = false;
          _savingsPeriodMonths = 12;
          _earlyWithdrawalPenaltyPercent = 5;
          _lockPeriodMonths = 12;
        });
      }

      await _loadTargets();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Savings plan created!'),
            backgroundColor: Color(0xFF00C853),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create savings plan: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _showTransactionSheet(SavingsTarget target, String type) async {
    final amountController = TextEditingController();
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1e293b),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        bool processing = false;
        return StatefulBuilder(
          builder: (ctx, setModalState) => Padding(
            padding: EdgeInsets.only(
              left: 24, right: 24, top: 24,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '${type == 'deposit' ? 'Deposit to' : 'Withdraw from'} ${target.name}',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white54),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                Text(
                  'Current balance: KES ${target.currentAmount.toStringAsFixed(0)}',
                  style: const TextStyle(color: Colors.white54, fontSize: 13),
                ),
                if (!target.isLocked && target.savingsPeriodMonths != null)
                  Text(
                    'Early withdrawals may incur a ${target.earlyWithdrawalPenaltyPercent.toStringAsFixed(1)}% penalty.',
                    style: const TextStyle(color: Colors.amberAccent, fontSize: 12),
                  ),
                const SizedBox(height: 16),
                TextField(
                  controller: amountController,
                  autofocus: true,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  style: const TextStyle(color: Colors.white),
                  decoration: _inputDecoration('Amount (KES)'),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: processing
                      ? null
                      : () async {
                          final amount = double.tryParse(amountController.text.trim());
                          if (amount == null || amount <= 0) return;
                          if (type == 'withdraw' && amount > target.currentAmount) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Amount exceeds available balance')),
                            );
                            return;
                          }
                          setModalState(() => processing = true);
                          try {
                            final result = await _service.processSavingsTransaction(
                              targetId: target.id,
                              amount: amount,
                              type: type == 'deposit' ? 'deposit' : 'withdrawal',
                            );
                            final next = (result['next_amount'] as num?)?.toDouble() ?? target.currentAmount;
                            if (!mounted || !context.mounted || !ctx.mounted) return;

                            setState(() {
                              final idx = _targets.indexWhere((t) => t.id == target.id);
                              if (idx != -1) {
                                _targets = List.of(_targets)..[idx] = SavingsTarget.fromMap({
                                  'id': target.id,
                                  'name': target.name,
                                  'purpose': target.purpose,
                                  'destination_label': target.destinationLabel,
                                  'target_amount': target.targetAmount,
                                  'current_amount': next,
                                  'auto_allocate': target.autoAllocate,
                                  'allocation_type': target.allocationType,
                                  'allocation_value': target.allocationValue,
                                  'status': target.status,
                                  'notes': target.notes,
                                  'savings_period_months': target.savingsPeriodMonths,
                                  'savings_period_started_at': target.savingsPeriodStartedAt?.toIso8601String(),
                                  'early_withdrawal_penalty_percent': target.earlyWithdrawalPenaltyPercent,
                                  'is_locked': target.isLocked,
                                  'lock_period_months': target.lockPeriodMonths,
                                  'lock_until': target.lockUntil?.toIso8601String(),
                                  'lock_started_at': target.lockStartedAt?.toIso8601String(),
                                });
                              }
                            });
                            Navigator.pop(ctx);
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                              content: Text(result['message']?.toString() ?? (type == 'deposit' ? 'Deposit recorded' : 'Withdrawal recorded')),
                              backgroundColor: const Color(0xFF00C853),
                            ));
                          } catch (e) {
                            setModalState(() => processing = false);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Transaction failed: $e')),
                              );
                            }
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: type == 'deposit' ? const Color(0xFF00C853) : Colors.red,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(
                    processing ? 'Processing...' : type == 'deposit' ? 'Confirm Deposit' : 'Confirm Withdrawal',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
    amountController.dispose();
  }

  Future<void> _toggleStatus(SavingsTarget target) async {
    try {
      await _service.updateSavingsTargetStatus(
        targetId: target.id,
        status: target.status == 'active' ? 'paused' : 'active',
      );
      await _loadTargets();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update status: $e')),
        );
      }
    }
  }

  String _formatPurpose(String purpose) {
    switch (purpose) {
      case 'daily_payments': return 'Daily payments';
      case 'bill_payment': return 'Bill payment';
      case 'school_fees': return 'School fees';
      case 'emergency': return 'Emergency fund';
      default: return '${purpose[0].toUpperCase()}${purpose.substring(1)}';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        title: const Text('Personal Savings',
            style: TextStyle(color: Colors.white)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          TextButton.icon(
            onPressed: () => setState(() => _showForm = !_showForm),
            icon: Icon(_showForm ? Icons.close : Icons.add,
                color: const Color(0xFF00C853)),
            label: Text(_showForm ? 'Close' : 'Add',
                style: const TextStyle(color: Color(0xFF00C853))),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadTargets,
        color: const Color(0xFF00C853),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text(
              'Create savings plans for any goal and decide how future deposits should support them.',
              style: TextStyle(color: Colors.white70, fontSize: 14),
            ),
            const SizedBox(height: 16),
            if (_showForm) _buildForm(),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(32),
                child: Center(
                    child: CircularProgressIndicator(color: Color(0xFF00C853))),
              )
            else if (_targets.isEmpty)
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: const Color(0xFF1e293b),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white10),
                ),
                child: const Column(
                  children: [
                    Icon(Icons.savings_outlined,
                        color: Color(0xFF00C853), size: 40),
                    SizedBox(height: 12),
                    Text('No savings plans yet.',
                        style: TextStyle(
                            color: Colors.white, fontWeight: FontWeight.bold)),
                    SizedBox(height: 8),
                    Text(
                      'Tap "Add" to create a plan for emergencies, school fees, rent, investments, or any custom goal.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white54),
                    ),
                  ],
                ),
              )
            else
              ..._targets.map(_buildTargetCard),
          ],
        ),
      ),
    );
  }

  Widget _buildForm() {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white10),
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildField(_nameController, 'Savings plan name'),
            const SizedBox(height: 12),
            _buildDropdown<String>(
              label: 'Purpose',
              value: _purpose,
              items: const [
                DropdownMenuItem(value: 'emergency', child: Text('Emergency fund')),
                DropdownMenuItem(value: 'rent', child: Text('Rent')),
                DropdownMenuItem(value: 'daily_payments', child: Text('Daily payments')),
                DropdownMenuItem(value: 'bill_payment', child: Text('Bill payment')),
                DropdownMenuItem(value: 'school_fees', child: Text('School fees')),
                DropdownMenuItem(value: 'business', child: Text('Business capital')),
                DropdownMenuItem(value: 'investment', child: Text('Investment')),
                DropdownMenuItem(value: 'withdrawal', child: Text('Withdrawal reserve')),
                DropdownMenuItem(value: 'custom', child: Text('Custom')),
              ],
              onChanged: (v) { if (v != null) setState(() => _purpose = v); },
            ),
            const SizedBox(height: 12),
            _buildField(_destinationController, 'Destination label (optional)',
                requiredField: false),
            const SizedBox(height: 12),
            _buildField(_targetAmountController, 'Target amount (KES)',
                keyboardType: TextInputType.number),
            const SizedBox(height: 12),
            _buildField(_currentAmountController, 'Current saved (KES)',
                keyboardType: TextInputType.number),
            const SizedBox(height: 12),
            _buildDropdown<String>(
              label: 'Allocation type',
              value: _allocationType,
              items: const [
                DropdownMenuItem(value: 'percentage', child: Text('Percentage')),
                DropdownMenuItem(value: 'fixed_amount', child: Text('Fixed amount')),
              ],
              onChanged: (v) {
                if (v != null) {
                  setState(() {
                    _allocationType = v;
                    if (v == 'percentage') _allocationValueController.text = '100';
                  });
                }
              },
            ),
            const SizedBox(height: 12),
            _buildField(
              _allocationValueController,
              _allocationType == 'percentage'
                  ? 'Allocation %'
                  : 'Allocation amount (KES)',
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              activeThumbColor: const Color(0xFF00C853),
              value: _isLocked,
              onChanged: (v) => setState(() => _isLocked = v),
              title: const Text('Lock savings account',
                  style: TextStyle(color: Colors.white)),
              subtitle: const Text(
                'Deposits are allowed, but withdrawals unlock on a set date',
                style: TextStyle(color: Colors.white54),
              ),
            ),
            const SizedBox(height: 12),
            if (_isLocked)
              _buildDropdown<int>(
                label: 'Lock period',
                value: _lockPeriodMonths,
                items: const [
                  DropdownMenuItem(value: 3, child: Text('3 months')),
                  DropdownMenuItem(value: 6, child: Text('6 months')),
                  DropdownMenuItem(value: 12, child: Text('12 months')),
                  DropdownMenuItem(value: 24, child: Text('24 months')),
                  DropdownMenuItem(value: 36, child: Text('36 months')),
                ],
                onChanged: (v) { if (v != null) setState(() => _lockPeriodMonths = v); },
              )
            else ...[
              _buildDropdown<int>(
                label: 'Savings period',
                value: _savingsPeriodMonths,
                items: const [
                  DropdownMenuItem(value: 3, child: Text('3 months')),
                  DropdownMenuItem(value: 6, child: Text('6 months')),
                  DropdownMenuItem(value: 12, child: Text('12 months')),
                  DropdownMenuItem(value: 24, child: Text('24 months')),
                  DropdownMenuItem(value: 36, child: Text('36 months')),
                ],
                onChanged: (v) { if (v != null) setState(() => _savingsPeriodMonths = v); },
              ),
              const SizedBox(height: 12),
              _buildField(
                _earlyPenaltyController,
                'Early withdrawal penalty (%)',
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                requiredField: false,
              ),
            ],
            _buildField(_notesController, 'Notes (optional)',
                maxLines: 3, requiredField: false),
            const SizedBox(height: 4),
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              activeThumbColor: const Color(0xFF00C853),
              value: _autoAllocate,
              onChanged: (v) => setState(() => _autoAllocate = v),
              title: const Text('Enable auto allocation',
                  style: TextStyle(color: Colors.white)),
              subtitle: const Text(
                  'Track how savings should move toward this plan',
                  style: TextStyle(color: Colors.white54)),
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _saving ? null : _createTarget,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF00C853),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(_saving ? 'Saving...' : 'Save Savings Plan',
                  style: const TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTargetCard(SavingsTarget target) {
    final savingsEndsAt = target.savingsPeriodEndsAt;
    final savingsActive = target.isSavingsPeriodActive;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
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
                    Text(target.name,
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 16)),
                    const SizedBox(height: 4),
                    Text(
                      target.destinationLabel?.isNotEmpty == true
                          ? target.destinationLabel!
                          : _formatPurpose(target.purpose),
                      style: const TextStyle(color: Colors.white54),
                    ),
                  ],
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    tooltip: 'Deposit',
                    icon: const Icon(Icons.arrow_downward_rounded, color: Color(0xFF00C853)),
                    onPressed: () => _showTransactionSheet(target, 'deposit'),
                  ),
                  IconButton(
                    tooltip: 'Withdraw',
                    icon: Icon(
                      Icons.arrow_upward_rounded,
                      color: target.currentAmount > 0 ? Colors.redAccent : Colors.white24,
                    ),
                    onPressed: target.currentAmount > 0
                        ? () => _showTransactionSheet(target, 'withdraw')
                        : null,
                  ),
                  TextButton(
                    onPressed: () => _toggleStatus(target),
                    child: Text(
                      target.status == 'active' ? 'Pause' : 'Activate',
                      style: TextStyle(
                        color: target.status == 'active' ? Colors.orange : const Color(0xFF00C853),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('KES ${target.currentAmount.toStringAsFixed(0)}',
                  style: const TextStyle(color: Colors.white54)),
              Text('KES ${target.targetAmount.toStringAsFixed(0)}',
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: target.progressPercent / 100,
              minHeight: 8,
              backgroundColor: Colors.white12,
              valueColor:
                  const AlwaysStoppedAnimation(Color(0xFF00C853)),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            target.allocationType == 'percentage'
                ? 'Auto allocation: ${target.allocationValue.toStringAsFixed(0)}% per matched saving'
                : 'Auto allocation: KES ${target.allocationValue.toStringAsFixed(0)} per matched saving',
            style: const TextStyle(color: Colors.white54, fontSize: 12),
          ),
          if (target.isLocked && target.lockUntil != null) ...[
            const SizedBox(height: 6),
            Text(
              'Locked until ${_formatLockDate(target.lockUntil!)}',
              style: const TextStyle(color: Colors.orangeAccent, fontSize: 12),
            ),
          ] else if (target.savingsPeriodMonths != null && savingsEndsAt != null) ...[
            const SizedBox(height: 6),
            Text(
              'Savings period: ${target.savingsPeriodMonths} months${savingsActive ? ', early withdrawal penalty applies' : ', penalty-free now'}',
              style: const TextStyle(color: Colors.white54, fontSize: 12),
            ),
          ],
          if (!target.isLocked) ...[
            const SizedBox(height: 6),
            Text(
              'Early withdrawal penalty: ${target.earlyWithdrawalPenaltyPercent.toStringAsFixed(1)}%',
              style: const TextStyle(color: Colors.amberAccent, fontSize: 12),
            ),
          ],
          if (target.notes != null && target.notes!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(target.notes!,
                style: const TextStyle(color: Colors.white38, fontSize: 12)),
          ],
        ],
      ),
    );
  }

  String _formatLockDate(DateTime date) {
    final day = date.day.toString().padLeft(2, '0');
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '$day ${months[date.month - 1]} ${date.year}';
  }

  Widget _buildField(
    TextEditingController controller,
    String label, {
    TextInputType keyboardType = TextInputType.text,
    int maxLines = 1,
    bool requiredField = true,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      maxLines: maxLines,
      style: const TextStyle(color: Colors.white),
      decoration: _inputDecoration(label),
      validator: (value) {
        if (!requiredField) return null;
        if (value == null || value.trim().isEmpty) return '$label is required';
        return null;
      },
    );
  }

  Widget _buildDropdown<T>({
    required String label,
    required T value,
    required List<DropdownMenuItem<T>> items,
    required ValueChanged<T?> onChanged,
  }) {
    return DropdownButtonFormField<T>(
      initialValue: value,
      dropdownColor: const Color(0xFF0f172a),
      isExpanded: true,
      style: const TextStyle(color: Colors.white, fontSize: 16),
      iconEnabledColor: Colors.white54,
      decoration: _inputDecoration(label),
      items: items,
      onChanged: onChanged,
    );
  }

  InputDecoration _inputDecoration(String label) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: Colors.white60),
      filled: true,
      fillColor: const Color(0xFF0f172a),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Colors.white24),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFF00C853)),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Colors.red),
      ),
    );
  }
}
