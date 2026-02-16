import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../providers/chama_provider.dart';
import '../utils/notification_helper.dart';

class CreatePaymentPromptScreen extends ConsumerStatefulWidget {
  final String chamaId;

  const CreatePaymentPromptScreen({super.key, required this.chamaId});

  @override
  ConsumerState<CreatePaymentPromptScreen> createState() => _CreatePaymentPromptScreenState();
}

class _CreatePaymentPromptScreenState extends ConsumerState<CreatePaymentPromptScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _amountController = TextEditingController();
  
  DateTime? _dueDate;
  bool _isLoading = false;

  @override
  void dispose() {
    _titleController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _selectDate(BuildContext context) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 7)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (context, child) {
        return Theme(
          data: ThemeData.dark().copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFF00C853),
              onPrimary: Colors.white,
              surface: Color(0xFF1e293b),
              onSurface: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null && picked != _dueDate) {
      setState(() {
        _dueDate = picked;
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final double amount = double.parse(_amountController.text.trim());
      
      await ref.read(chamaServiceProvider).createPaymentPrompt(
        chamaId: widget.chamaId,
        title: _titleController.text.trim(),
        amount: amount,
        dueDate: _dueDate,
      );

      // Refresh prompts list
      ref.invalidate(chamaPromptsProvider(widget.chamaId));

      if (mounted) {
        NotificationHelper.sendNotification(
          title: 'Payment Request Sent!',
          message: 'Your payment request for KES ${_amountController.text} has been sent out.',
          type: 'info',
        );

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Payment request sent to members!')),
        );
        context.pop(); // Return to Details
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
        title: const Text('Request Payment'),
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
                'Send Payment Prompt',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Notify all members to make a contribution.',
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 32),

              // Title
              TextFormField(
                controller: _titleController,
                style: const TextStyle(color: Colors.white),
                decoration: _inputDecoration('Title (e.g. Feb Contribution)', Icons.title),
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

              // Due Date
              InkWell(
                onTap: () => _selectDate(context),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2C2C2C),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.transparent),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_today, color: Color(0xFF00C853)),
                      const SizedBox(width: 12),
                      Text(
                        _dueDate == null
                            ? 'Select Due Date (Optional)'
                            : 'Due: ${DateFormat('MMM d, y').format(_dueDate!)}',
                        style: TextStyle(
                          color: _dueDate == null ? Colors.grey : Colors.white,
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 32),

              // Submit Button
              SizedBox(
                height: 50,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF00C853),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 24, 
                          width: 24, 
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                        )
                      : const Text('Send Request', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String label, IconData icon) {
    return InputDecoration(
      labelText: label,
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
