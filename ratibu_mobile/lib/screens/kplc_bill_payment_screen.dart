import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../providers/auth_provider.dart';
import '../services/mpesa_service.dart';
import '../services/transaction_authorization_service.dart';
import '../utils/notification_helper.dart';

class KplcBillPaymentScreen extends ConsumerStatefulWidget {
  final String initialType;

  const KplcBillPaymentScreen({super.key, this.initialType = 'prepaid'});

  @override
  ConsumerState<KplcBillPaymentScreen> createState() => _KplcBillPaymentScreenState();
}

class _KplcBillPaymentScreenState extends ConsumerState<KplcBillPaymentScreen> {
  final _formKey = GlobalKey<FormState>();
  final _meterController = TextEditingController();
  final _amountController = TextEditingController();
  final _phoneController = TextEditingController();
  final _mpesaService = MpesaService();
  final _authorizationService = TransactionAuthorizationService();

  bool _isLoading = false;
  String _phoneOption = 'mine';
  String _billType = 'prepaid';
  String? _myNumber;

  @override
  void initState() {
    super.initState();
    _billType = widget.initialType == 'postpaid' ? 'postpaid' : 'prepaid';
    _loadUserPhone();
  }

  Future<void> _loadUserPhone() async {
    try {
      final userId = ref.read(authProvider).mapState(
            authenticated: (s) => s.user.id,
          );
      if (userId == null) return;
      final profile = await Supabase.instance.client
          .from('users')
          .select('phone')
          .eq('id', userId)
          .maybeSingle();
      final phone = _normalizePhone(profile?['phone'] as String?);
      if (phone != null && phone.isNotEmpty) {
        setState(() {
          _myNumber = phone;
          _phoneController.text = phone;
        });
      } else {
        setState(() => _phoneOption = 'other');
      }
    } catch (_) {
      setState(() => _phoneOption = 'other');
    }
  }

  String? _normalizePhone(String? value) {
    if (value == null) return null;
    final cleaned = value.replaceAll(RegExp(r'[\s\-\(\)]'), '').trim();
    if (cleaned.isEmpty) return null;
    if (cleaned.startsWith('+')) return cleaned.substring(1);
    return cleaned;
  }

  @override
  void dispose() {
    _meterController.dispose();
    _amountController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);

    try {
      final amount = double.parse(_amountController.text.trim());
      final userId = ref.read(authProvider).mapState(
            authenticated: (s) => s.user.id,
          );
      if (userId == null) throw 'User not authenticated';

      final approved = await _authorizationService.confirmTransaction(
        context,
        actionLabel: 'bill payment',
        amount: amount,
      );
      if (!approved) return;

      final phone = _phoneOption == 'mine'
          ? _myNumber
          : _normalizePhone(_phoneController.text.trim());
      if (phone == null || phone.isEmpty) {
        throw 'Enter a valid phone number.';
      }

      final meterOrAccount = _meterController.text.trim();
      if (meterOrAccount.isEmpty) {
        throw 'Enter a meter or account number.';
      }

      final isPrepaid = _billType == 'prepaid';
      await _mpesaService.initiateBillPayment(
        phoneNumber: phone,
        amount: amount,
        userId: userId,
        billerCode: isPrepaid ? '888880' : '888888',
        accountReference: meterOrAccount,
        billName: isPrepaid ? 'KPLC Prepaid Token' : 'KPLC Postpaid Bill',
      );

      if (mounted) {
        NotificationHelper.showToast(
          context,
          title: 'Payment Started',
          message: 'Check your phone and approve the STK prompt.',
          type: 'success',
        );
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) context.pop();
        });
      }
    } catch (e) {
      if (mounted) {
        NotificationHelper.showToast(
          context,
          title: 'Payment Failed',
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
    final isPrepaid = _billType == 'prepaid';
    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        title: const Text('KPLC Electricity'),
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
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
                      'Electricity payments',
                      style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      isPrepaid
                          ? 'Buy KPLC tokens using paybill 888880.'
                          : 'Pay KPLC postpaid electricity bills using paybill 888888.',
                      style: const TextStyle(color: Colors.white70, height: 1.4),
                    ),
                    const SizedBox(height: 16),
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'prepaid', label: Text('Prepaid Tokens')),
                        ButtonSegment(value: 'postpaid', label: Text('Postpaid Bill')),
                      ],
                      selected: {_billType},
                      onSelectionChanged: (value) {
                        setState(() => _billType = value.first);
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              const Text('Meter / Account Number', style: TextStyle(color: Colors.white70)),
              const SizedBox(height: 8),
              TextFormField(
                controller: _meterController,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: isPrepaid ? 'Enter meter number' : 'Enter account number',
                  hintStyle: const TextStyle(color: Colors.white38),
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
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 16),
              const Text('Amount (KES)', style: TextStyle(color: Colors.white70)),
              const SizedBox(height: 8),
              TextFormField(
                controller: _amountController,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  prefixText: 'KES ',
                  prefixStyle: const TextStyle(color: Color(0xFF00C853), fontWeight: FontWeight.bold),
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
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Required';
                  final amount = double.tryParse(v.trim());
                  if (amount == null || amount <= 0) return 'Enter a valid amount';
                  return null;
                },
              ),
              const SizedBox(height: 16),
              const Text('Select Phone Number', style: TextStyle(color: Colors.white70)),
              const SizedBox(height: 8),
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF1e293b),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white24),
                ),
                child: Column(
                  children: [
                    _SelectableRow(
                      selected: _phoneOption == 'mine',
                      title: 'My Number (${_myNumber ?? 'Not found'})',
                      subtitle: 'Use the phone already linked to your profile.',
                      onTap: () {
                        setState(() {
                          _phoneOption = 'mine';
                          if (_myNumber != null) {
                            _phoneController.text = _myNumber!;
                          }
                        });
                      },
                    ),
                    const Divider(height: 1, color: Colors.white10),
                    _SelectableRow(
                      selected: _phoneOption == 'other',
                      title: 'Other Number',
                      subtitle: 'Use another M-Pesa line.',
                      onTap: () {
                        setState(() {
                          _phoneOption = 'other';
                          _phoneController.clear();
                        });
                      },
                    ),
                  ],
                ),
              ),
              if (_phoneOption == 'other') ...[
                const SizedBox(height: 16),
                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    hintText: 'Enter M-Pesa phone number',
                    hintStyle: const TextStyle(color: Colors.white38),
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
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Required';
                    return null;
                  },
                ),
              ],
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
                      : Text(
                          isPrepaid ? 'Pay KPLC Token' : 'Pay KPLC Bill',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'The same Ratibu transaction PIN is used here, in mobile deposits, and in USSD.',
                style: TextStyle(color: Colors.white54, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SelectableRow extends StatelessWidget {
  final bool selected;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _SelectableRow({
    required this.selected,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: selected ? const Color(0xFF00C853) : Colors.white54, width: 2),
              ),
              child: selected
                  ? const Center(
                      child: CircleAvatar(
                        radius: 6,
                        backgroundColor: Color(0xFF00C853),
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(subtitle, style: const TextStyle(color: Colors.white54, fontSize: 12)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
