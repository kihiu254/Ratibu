import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/transaction_authorization_service.dart';

class MpesaReversalScreen extends ConsumerStatefulWidget {
  const MpesaReversalScreen({super.key});

  @override
  ConsumerState<MpesaReversalScreen> createState() => _MpesaReversalScreenState();
}

class _MpesaReversalScreenState extends ConsumerState<MpesaReversalScreen> {
  final _formKey = GlobalKey<FormState>();
  final _transactionIdController = TextEditingController();
  final _amountController = TextEditingController();
  final _receiverPartyController = TextEditingController();
  final _remarksController = TextEditingController(text: 'Payment reversal');
  final _service = TransactionAuthorizationService();

  bool _isLoading = false;
  bool _isAdmin = false;

  @override
  void initState() {
    super.initState();
    _loadRole();
  }

  Future<void> _loadRole() async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;
      final row = await Supabase.instance.client
          .from('users')
          .select('system_role')
          .eq('id', user.id)
          .maybeSingle();
      final role = (row?['system_role'] ?? 'user').toString();
      if (mounted) {
        setState(() => _isAdmin = role == 'admin' || role == 'super_admin');
      }
    } catch (_) {
      if (mounted) setState(() => _isAdmin = false);
    }
  }

  @override
  void dispose() {
    _transactionIdController.dispose();
    _amountController.dispose();
    _receiverPartyController.dispose();
    _remarksController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_isAdmin) return;
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    try {
      await _service.requestMpesaReversal(
        transactionId: _transactionIdController.text.trim(),
        amount: double.parse(_amountController.text.trim()),
        receiverParty: _receiverPartyController.text.trim(),
        remarks: _remarksController.text.trim(),
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Reversal request sent.')),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Reversal failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        title: const Text('M-Pesa Reversal'),
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: _isAdmin
            ? Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1e293b),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white10),
                      ),
                      child: const Text(
                        'Submit a Safaricom Reversal request for a mistaken M-Pesa transaction. This uses the admin reversal credentials from the backend.',
                        style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.5),
                      ),
                    ),
                    const SizedBox(height: 20),
                    _field(
                      controller: _transactionIdController,
                      label: 'Transaction ID',
                      hint: 'e.g. PDU91HIVIT',
                    ),
                    const SizedBox(height: 16),
                    _field(
                      controller: _amountController,
                      label: 'Amount (KES)',
                      hint: 'Enter the reversal amount',
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 16),
                    _field(
                      controller: _receiverPartyController,
                      label: 'Receiver shortcode',
                      hint: 'Paybill / till number',
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 16),
                    _field(
                      controller: _remarksController,
                      label: 'Remarks',
                      hint: 'Payment reversal',
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF00C853),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                height: 24,
                                width: 24,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Text('Send Reversal Request', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              )
            : Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFF1e293b),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white10),
                ),
                child: const Text(
                  'Reversal tools are available to admins only. Ask an admin or super admin to submit this request.',
                  style: TextStyle(color: Colors.white70, height: 1.5),
                ),
              ),
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String label,
    required String hint,
    TextInputType keyboardType = TextInputType.text,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        hintStyle: const TextStyle(color: Colors.white38),
        labelStyle: const TextStyle(color: Colors.white70),
        filled: true,
        fillColor: const Color(0xFF1e293b),
        enabledBorder: OutlineInputBorder(
          borderSide: const BorderSide(color: Colors.white24),
          borderRadius: BorderRadius.circular(12),
        ),
        focusedBorder: OutlineInputBorder(
          borderSide: const BorderSide(color: Color(0xFF00C853)),
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      validator: (value) {
        if (value == null || value.trim().isEmpty) return 'Required';
        if (label == 'Amount (KES)' && double.tryParse(value.trim()) == null) {
          return 'Enter a valid amount';
        }
        return null;
      },
    );
  }
}
