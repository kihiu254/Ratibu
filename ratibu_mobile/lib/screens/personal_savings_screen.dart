import 'package:flutter/material.dart';
import '../models/savings_target.dart';
import '../services/savings_target_service.dart';

class PersonalSavingsScreen extends StatefulWidget {
  const PersonalSavingsScreen({super.key});

  @override
  State<PersonalSavingsScreen> createState() => _PersonalSavingsScreenState();
}

class _PersonalSavingsScreenState extends State<PersonalSavingsScreen> {
  final _service = SavingsTargetService();
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _destinationController = TextEditingController();
  final _targetAmountController = TextEditingController();
  final _currentAmountController = TextEditingController(text: '0');
  final _allocationValueController = TextEditingController(text: '100');
  final _notesController = TextEditingController();

  List<SavingsTarget> _targets = [];
  bool _loading = true;
  bool _saving = false;
  bool _showForm = false;
  bool _autoAllocate = true;
  String _purpose = 'emergency';
  String _allocationType = 'percentage';

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
    super.dispose();
  }

  Future<void> _loadTargets() async {
    setState(() => _loading = true);
    try {
      final targets = await _service.getSavingsTargets();
      if (mounted) {
        setState(() {
          _targets = targets;
        });
      }
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

    setState(() => _saving = true);
    try {
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
      );

      _formKey.currentState!.reset();
      _nameController.clear();
      _destinationController.clear();
      _targetAmountController.clear();
      _currentAmountController.text = '0';
      _allocationValueController.text = '100';
      _notesController.clear();

      if (mounted) {
        setState(() {
          _showForm = false;
          _purpose = 'emergency';
          _allocationType = 'percentage';
          _autoAllocate = true;
        });
      }

      await _loadTargets();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Savings plan created successfully!')),
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
      case 'daily_payments':
        return 'Daily payments';
      case 'bill_payment':
        return 'Bill payment';
      case 'school_fees':
        return 'School fees';
      case 'emergency':
        return 'Emergency fund';
      default:
        return '${purpose[0].toUpperCase()}${purpose.substring(1)}';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        title: const Text('Personal Savings'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          TextButton.icon(
            onPressed: () => setState(() => _showForm = !_showForm),
            icon: const Icon(Icons.add, color: Color(0xFF00C853)),
            label: Text(_showForm ? 'Close' : 'Add', style: const TextStyle(color: Color(0xFF00C853))),
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
              'Create savings plans for any viable goal and decide how future deposits should support them.',
              style: TextStyle(color: Colors.white70, fontSize: 14),
            ),
            const SizedBox(height: 16),
            if (_showForm) _buildForm(),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(32),
                child: Center(child: CircularProgressIndicator(color: Color(0xFF00C853))),
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
                    Icon(Icons.savings_outlined, color: Color(0xFF00C853), size: 40),
                    SizedBox(height: 12),
                    Text('No savings plans yet.', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    SizedBox(height: 8),
                    Text(
                      'Start one for emergencies, school fees, investments, business growth, bills, rent, or any custom goal.',
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
          children: [
            _buildField(_nameController, 'Savings plan name'),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _purpose,
              dropdownColor: const Color(0xFF0f172a),
              style: const TextStyle(color: Colors.white),
              decoration: _inputDecoration('Purpose'),
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
              onChanged: (value) {
                if (value != null) setState(() => _purpose = value);
              },
            ),
            const SizedBox(height: 12),
            _buildField(_destinationController, 'Destination label'),
            const SizedBox(height: 12),
            _buildField(_targetAmountController, 'Target amount (KES)', keyboardType: TextInputType.number),
            const SizedBox(height: 12),
            _buildField(_currentAmountController, 'Current saved (KES)', keyboardType: TextInputType.number),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _allocationType,
              dropdownColor: const Color(0xFF0f172a),
              style: const TextStyle(color: Colors.white),
              decoration: _inputDecoration('Allocation type'),
              items: const [
                DropdownMenuItem(value: 'percentage', child: Text('Percentage')),
                DropdownMenuItem(value: 'fixed_amount', child: Text('Fixed amount')),
              ],
              onChanged: (value) {
                if (value != null) {
                  setState(() {
                    _allocationType = value;
                    _allocationValueController.text = value == 'percentage' ? '100' : _allocationValueController.text;
                  });
                }
              },
            ),
            const SizedBox(height: 12),
            _buildField(
              _allocationValueController,
              _allocationType == 'percentage' ? 'Allocation %' : 'Allocation amount (KES)',
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            _buildField(_notesController, 'Notes', maxLines: 3, requiredField: false),
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              activeThumbColor: const Color(0xFF00C853),
              value: _autoAllocate,
              onChanged: (value) => setState(() => _autoAllocate = value),
              title: const Text('Enable auto allocation', style: TextStyle(color: Colors.white)),
              subtitle: const Text('Track how savings should move toward this plan', style: TextStyle(color: Colors.white54)),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _saving ? null : _createTarget,
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF00C853)),
                child: Text(_saving ? 'Saving...' : 'Save savings plan'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTargetCard(SavingsTarget target) {
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
                    Text(target.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 4),
                    Text(target.destinationLabel?.isNotEmpty == true ? target.destinationLabel! : _formatPurpose(target.purpose), style: const TextStyle(color: Colors.white54)),
                  ],
                ),
              ),
              TextButton(
                onPressed: () => _toggleStatus(target),
                child: Text(target.status == 'active' ? 'Pause' : 'Activate'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('KES ${target.currentAmount.toStringAsFixed(0)}', style: const TextStyle(color: Colors.white54)),
              Text('KES ${target.targetAmount.toStringAsFixed(0)}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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
                ? 'Auto allocation: ${target.allocationValue.toStringAsFixed(0)}% per matched saving'
                : 'Auto allocation: KES ${target.allocationValue.toStringAsFixed(0)} per matched saving',
            style: const TextStyle(color: Colors.white54, fontSize: 12),
          ),
          if (target.notes != null && target.notes!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(target.notes!, style: const TextStyle(color: Colors.white38, fontSize: 12)),
          ],
        ],
      ),
    );
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

  InputDecoration _inputDecoration(String label) {
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
}
