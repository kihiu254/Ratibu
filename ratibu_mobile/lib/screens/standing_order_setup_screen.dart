import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../providers/chama_provider.dart';
import '../utils/notification_helper.dart';

class StandingOrderSetupScreen extends ConsumerStatefulWidget {
  final String chamaId;

  const StandingOrderSetupScreen({super.key, required this.chamaId});

  @override
  ConsumerState<StandingOrderSetupScreen> createState() => _StandingOrderSetupScreenState();
}

class _StandingOrderSetupScreenState extends ConsumerState<StandingOrderSetupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _amountController = TextEditingController();
  
  DateTime? _startDate;
  DateTime? _endDate;
  String _frequency = '4'; // Default Monthly
  bool _isLoading = false;
  String? _userPhone;

  @override
  void initState() {
    super.initState();
    _fetchUserData();
  }

  Future<void> _fetchUserData() async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      final data = await Supabase.instance.client
          .from('profiles')
          .select('phone_number')
          .eq('id', user.id)
          .single();
      
      if (mounted) {
        setState(() {
          _userPhone = data['phone_number'];
        });
      }
    } catch (e) {
      debugPrint('Error fetching user phone: $e');
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _selectStartDate(BuildContext context) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 30)),
      builder: (context, child) => _datePickerTheme(child!),
    );
    if (picked != null) {
      setState(() => _startDate = picked);
    }
  }

  Future<void> _selectEndDate(BuildContext context) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _startDate?.add(const Duration(days: 90)) ?? DateTime.now().add(const Duration(days: 91)),
      firstDate: _startDate?.add(const Duration(days: 1)) ?? DateTime.now().add(const Duration(days: 2)),
      lastDate: DateTime.now().add(const Duration(days: 3650)),
      builder: (context, child) => _datePickerTheme(child!),
    );
    if (picked != null) {
      setState(() => _endDate = picked);
    }
  }

  Widget _datePickerTheme(Widget child) {
    return Theme(
      data: ThemeData.dark().copyWith(
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF00C853),
          onPrimary: Colors.white,
          surface: Color(0xFF1e293b),
          onSurface: Colors.white,
        ),
      ),
      child: child,
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_startDate == null || _endDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select both start and end dates')),
      );
      return;
    }

    if (_userPhone == null || _userPhone!.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please update your phone number in profile first'), backgroundColor: Colors.orange),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final DateFormat formatter = DateFormat('yyyy-MM-dd');
      
      await ref.read(chamaServiceProvider).createStandingOrder(
        chamaId: widget.chamaId,
        name: _nameController.text.trim(),
        amount: double.tryParse(_amountController.text.trim()) ?? 0.0,
        startDate: formatter.format(_startDate!),
        endDate: formatter.format(_endDate!),
        frequency: _frequency,
        phoneNumber: _userPhone!,
      );

      if (mounted) {
        NotificationHelper.sendNotification(
          title: 'Automation Initiated!',
          message: 'Please check your phone for the M-Pesa PIN prompt to authorize the standing order.',
          type: 'success',
        );

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Standing Order initiated! Authorization requested.')),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Automate Payments'),
        backgroundColor: const Color(0xFF1A1A1A),
        foregroundColor: Colors.white,
      ),
      backgroundColor: const Color(0xFF121212),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'M-Pesa Ratiba',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Set up recurring payments to this Chama automatically.',
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 32),

              // Name
              TextFormField(
                controller: _nameController,
                style: const TextStyle(color: Colors.white),
                decoration: _inputDecoration('Automation Name', Icons.label, placeholder: 'e.g. Monthly Contribution'),
                validator: (value) => value == null || value.isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 16),

              // Amount
              TextFormField(
                controller: _amountController,
                style: const TextStyle(color: Colors.white),
                keyboardType: TextInputType.number,
                decoration: _inputDecoration('Amount (KES)', Icons.monetization_on),
                validator: (value) {
                  if (value == null || value.isEmpty) return 'Required';
                  if (double.tryParse(value) == null) return 'Invalid number';
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Frequency
              DropdownButtonFormField<String>(
                value: _frequency,
                dropdownColor: const Color(0xFF2C2C2C),
                style: const TextStyle(color: Colors.white),
                decoration: _inputDecoration('Frequency', Icons.refresh),
                items: const [
                  DropdownMenuItem(value: '2', child: Text('Daily')),
                  DropdownMenuItem(value: '3', child: Text('Weekly')),
                  DropdownMenuItem(value: '4', child: Text('Monthly')),
                  DropdownMenuItem(value: '8', child: Text('Yearly')),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _frequency = val);
                },
              ),
              const SizedBox(height: 16),

              // Dates Row
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () => _selectStartDate(context),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFF2C2C2C),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Start Date', style: TextStyle(color: Colors.grey, fontSize: 12)),
                            const SizedBox(height: 4),
                            Text(
                              _startDate == null
                                  ? 'Select'
                                  : DateFormat('MMM d, y').format(_startDate!),
                              style: TextStyle(
                                color: _startDate == null ? Colors.grey : Colors.white,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: InkWell(
                      onTap: () => _selectEndDate(context),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFF2C2C2C),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('End Date', style: TextStyle(color: Colors.grey, fontSize: 12)),
                            const SizedBox(height: 4),
                            Text(
                              _endDate == null
                                  ? 'Select'
                                  : DateFormat('MMM d, y').format(_endDate!),
                              style: TextStyle(
                                color: _endDate == null ? Colors.grey : Colors.white,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Info Box
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.blue.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.blue.withOpacity(0.2)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, color: Colors.blue, size: 20),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'You will receive an M-PESA PIN prompt to authorize this setup. ${_userPhone != null ? "Request will be sent to $_userPhone" : ""}',
                        style: const TextStyle(color: Colors.blue, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),

              // Submit Button
              SizedBox(
                height: 56,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF00C853),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 8,
                    shadowColor: const Color(0xFF00C853).withOpacity(0.3),
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text(
                          'SET UP AUTOMATION',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, letterSpacing: 1.2),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String label, IconData icon, {String? placeholder}) {
    return InputDecoration(
      labelText: label,
      hintText: placeholder,
      hintStyle: const TextStyle(color: Colors.grey, fontSize: 14),
      labelStyle: const TextStyle(color: Colors.grey),
      prefixIcon: Icon(icon, color: const Color(0xFF00C853)),
      filled: true,
      fillColor: const Color(0xFF2C2C2C),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFF00C853)),
      ),
    );
  }
}

extension on InputDecoration {
  InputDecoration placeholder(String text) {
     return copyWith(hintText: text);
  }
}
