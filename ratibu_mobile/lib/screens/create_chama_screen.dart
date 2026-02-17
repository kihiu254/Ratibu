import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/chama_provider.dart';
import '../utils/notification_helper.dart';

class CreateChamaScreen extends ConsumerStatefulWidget {
  const CreateChamaScreen({super.key});

  @override
  ConsumerState<CreateChamaScreen> createState() => _CreateChamaScreenState();
}

class _CreateChamaScreenState extends ConsumerState<CreateChamaScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _descController = TextEditingController();
  final _amountController = TextEditingController(); // Contribution amount
  
  String _frequency = 'Monthly'; // Default
  bool _isLoading = false;

  final List<String> _frequencies = ['Daily', 'Weekly', 'Monthly', 'Bi-Weekly'];

  @override
  void dispose() {
    _nameController.dispose();
    _descController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final double amount = double.parse(_amountController.text.trim());
      
      await ref.read(chamaServiceProvider).createChama(
        name: _nameController.text.trim(),
        description: _descController.text.trim(),
        contributionAmount: amount,
        frequency: _frequency.toLowerCase(),
      );

      // Refresh the list of chamas so the new one appears on the dashboard
      ref.invalidate(myChamasProvider);

      if (mounted) {
        NotificationHelper.showToast(
          context,
          title: 'Chama Created!',
          message: 'Your new Chama "${_nameController.text}" has been created successfully.',
          type: 'success',
        );
        context.pop(); // Return to dashboard
      }
    } catch (e) {
      if (mounted) {
        NotificationHelper.showToast(
          context,
          title: 'Error',
          message: e.toString(),
          type: 'error',
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
        title: const Text('Create New Chama'),
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
                'Start a Group',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Create a space for your friends or community to save and invest together.',
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 32),

              // Chama Name
              TextFormField(
                controller: _nameController,
                style: const TextStyle(color: Colors.white),
                decoration: _inputDecoration('Chama Name', Icons.group),
                validator: (value) => value == null || value.isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 16),

              // Description
              TextFormField(
                controller: _descController,
                style: const TextStyle(color: Colors.white),
                decoration: _inputDecoration('Description (Optional)', Icons.description),
                maxLines: 3,
              ),
              const SizedBox(height: 16),

              // Contribution Amount
              TextFormField(
                controller: _amountController,
                style: const TextStyle(color: Colors.white),
                keyboardType: TextInputType.number,
                decoration: _inputDecoration('Target Contribution (KES)', Icons.monetization_on),
                validator: (value) {
                  if (value == null || value.isEmpty) return 'Required';
                  if (double.tryParse(value) == null) return 'Invalid number';
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Frequency Dropdown
              DropdownButtonFormField<String>(
                value: _frequency,
                dropdownColor: const Color(0xFF2C2C2C),
                style: const TextStyle(color: Colors.white),
                decoration: _inputDecoration('Contribution Frequency', Icons.calendar_today),
                items: _frequencies.map((f) => DropdownMenuItem(value: f, child: Text(f))).toList(),
                onChanged: (val) => setState(() => _frequency = val!),
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
                      : const Text('Create Chama', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
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
