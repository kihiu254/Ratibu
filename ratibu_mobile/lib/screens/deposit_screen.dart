import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/mpesa_service.dart';
import '../services/transaction_authorization_service.dart';
import '../providers/auth_provider.dart';
import '../utils/notification_helper.dart';
import '../widgets/qr_code_display.dart';

class DepositScreen extends ConsumerStatefulWidget {
  final String? chamaId;
  final String? savingsTargetId;
  final String? initialAmount;

  const DepositScreen({
    super.key,
    this.chamaId,
    this.savingsTargetId,
    this.initialAmount,
  });

  @override
  ConsumerState<DepositScreen> createState() => _DepositScreenState();
}

class _DepositScreenState extends ConsumerState<DepositScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _phoneController = TextEditingController();
  final _mpesaService = MpesaService();
  final _transactionAuthorizationService = TransactionAuthorizationService();
  bool _isLoading = false;
  bool _isQrLoading = false;
  bool _isSuccess = false;
  String _phoneOption = 'mine';
  String? _myNumber;
  String? _savingsTargetName;

  String? _normalizePhone(String? value) {
    if (value == null) return null;
    final cleaned = value.replaceAll(RegExp(r'[\s\-\(\)]'), '').trim();
    if (cleaned.isEmpty) return null;
    if (cleaned.startsWith('+')) return cleaned.substring(1);
    return cleaned;
  }

  @override
  void initState() {
    super.initState();
    if (widget.initialAmount != null) {
      _amountController.text = widget.initialAmount!;
    }
    _loadUserPhone();
    if (widget.savingsTargetId != null) _loadSavingsTargetName();
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
      final authUser = Supabase.instance.client.auth.currentUser;
      final phone = _normalizePhone(profile?['phone'] as String?) ??
          _normalizePhone(authUser?.userMetadata?['phone']?.toString()) ??
          _normalizePhone(authUser?.phone);
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

  Future<void> _loadSavingsTargetName() async {
    try {
      final row = await Supabase.instance.client
          .from('user_savings_targets')
          .select('name')
          .eq('id', widget.savingsTargetId!)
          .maybeSingle();
      if (mounted) setState(() => _savingsTargetName = row?['name'] as String?);
    } catch (_) {}
  }

  @override
  void dispose() {
    _amountController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  String get _depositTarget {
    if (_savingsTargetName != null) return _savingsTargetName!;
    if (widget.chamaId != null) return 'Chama';
    return 'Wallet';
  }

  Future<void> _handleDeposit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final amount = double.parse(_amountController.text.trim());
      final userId = ref.read(authProvider).mapState(
            authenticated: (s) => s.user.id,
          );
      if (userId == null) throw 'User not authenticated';

      String phone;
      if (_phoneOption == 'mine') {
        if (_myNumber == null || _myNumber!.isEmpty) {
          throw 'Profile missing phone number. Please select "Other Number".';
        }
        phone = _myNumber!;
      } else {
        phone = _phoneController.text.trim();
      }

      if (widget.chamaId == null && widget.savingsTargetId == null) {
        throw 'Please select a destination account from the Accounts page.';
      }

      final approved = await _transactionAuthorizationService.confirmTransaction(
        context,
        actionLabel: 'deposit',
        amount: amount,
      );
      if (!approved) {
        return;
      }

      await _mpesaService.initiateStkPush(
        phoneNumber: phone,
        amount: amount,
        userId: userId,
        chamaId: widget.chamaId,
        savingsTargetId: widget.savingsTargetId,
      );

      if (mounted) {
        setState(() => _isSuccess = true);
        NotificationHelper.showToast(
          context,
          title: 'STK Push Sent!',
          message: 'Follow the prompt on your phone to complete payment.',
          type: 'success',
        );
        final user = ref.read(authProvider).mapState(authenticated: (s) => s.user);
        if (user?.email != null) {
          NotificationHelper.sendEmail(
            to: user!.email!,
            subject: 'Deposit Initiated - Ratibu',
            html: '''
              <div style="font-family:sans-serif;padding:20px;border:1px solid #eee;border-radius:10px;">
                <h2 style="color:#00C853;">Deposit Initiated</h2>
                <p>You initiated a deposit of <b>KES $amount</b> to <b>$_depositTarget</b> via M-Pesa.</p>
                <p>Enter your PIN on the STK push prompt to complete.</p>
                <br><p>Best regards,<br>The Ratibu Team</p>
              </div>
            ''',
          );
        }
        Future.delayed(const Duration(seconds: 3), () {
          if (mounted) context.pop();
        });
      }
    } catch (e) {
      if (mounted) {
        NotificationHelper.showToast(
          context,
          title: 'Deposit Failed',
          message: e.toString(),
          type: 'error',
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleQrGeneration() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isQrLoading = true);
    try {
      final amount = double.parse(_amountController.text.trim());
      if (widget.chamaId == null && widget.savingsTargetId == null) {
        throw 'Please select a destination account.';
      }
      final qrData = await _mpesaService.generateQrCode(
        amount: amount,
        merchantName: 'Ratibu - $_depositTarget',
        refNo: 'Deposit-${DateTime.now().millisecondsSinceEpoch}',
      );
      if (mounted && qrData['QRCode'] != null) {
        showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (context) => QrCodeDisplay(
            qrCodeBase64: qrData['QRCode'],
            amount: amount,
            chamaName: _depositTarget,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        NotificationHelper.showToast(
          context,
          title: 'QR Generation Failed',
          message: e.toString(),
          type: 'error',
        );
      }
    } finally {
      if (mounted) setState(() => _isQrLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Deposit to $_depositTarget',
            style: const TextStyle(color: Colors.white)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      backgroundColor: const Color(0xFF0f172a),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1e293b),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                      color: const Color(0xFF00C853).withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    Image.network(
                      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Mjpesa.png/320px-Mjpesa.png',
                      height: 40,
                      errorBuilder: (c, e, s) =>
                          const Icon(Icons.phone_android, color: Colors.green, size: 40),
                    ),
                    const SizedBox(width: 16),
                    const Expanded(
                      child: Text('M-Pesa Express (STK Push)',
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              const Text('Enter Amount (KES)',
                  style: TextStyle(color: Colors.white70, fontSize: 14)),
              const SizedBox(height: 8),
              TextFormField(
                controller: _amountController,
                style: const TextStyle(
                    color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  prefixText: 'KES ',
                  prefixStyle: const TextStyle(
                      color: Color(0xFF00C853), fontWeight: FontWeight.bold),
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
                  if (v == null || v.isEmpty) return 'Please enter an amount';
                  if (double.tryParse(v) == null) return 'Invalid number';
                  if (double.parse(v) <= 0) return 'Amount must be > 0';
                  return null;
                },
              ),
              const SizedBox(height: 24),
              const Text('Select Phone Number',
                  style: TextStyle(color: Colors.white70, fontSize: 14)),
              const SizedBox(height: 8),
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF1e293b),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white24),
                ),
                child: Column(
                  children: [
                    RadioListTile<String>(
                      title: Text(
                        'My Number (${_myNumber ?? 'Not found'})',
                        style: const TextStyle(color: Colors.white),
                      ),
                      value: 'mine',
                      groupValue: _phoneOption,
                      activeColor: const Color(0xFF00C853),
                      onChanged: (v) {
                        if (v == null) return;
                        setState(() {
                          _phoneOption = v;
                          if (_myNumber != null) {
                            _phoneController.text =
                                _myNumber!.replaceFirst('+', '');
                          }
                        });
                      },
                    ),
                    const Divider(height: 1, color: Colors.white10),
                    RadioListTile<String>(
                      title: const Text('Other Number',
                          style: TextStyle(color: Colors.white)),
                      value: 'other',
                      groupValue: _phoneOption,
                      activeColor: const Color(0xFF00C853),
                      onChanged: (v) {
                        if (v == null) return;
                        setState(() {
                          _phoneOption = v;
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
                  style: const TextStyle(color: Colors.white),
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText: 'Enter M-Pesa Number (254...)',
                    labelStyle: const TextStyle(color: Colors.white70),
                    prefixIcon: const Icon(Icons.phone, color: Colors.white70),
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
                    if (v == null || v.isEmpty) return 'Required';
                    final clean = v.replaceAll(RegExp(r'\s+'), '');
                    final valid = RegExp(r'^(254[71]\d{8}|0[71]\d{8})$').hasMatch(clean);
                    if (!valid) return 'Format: 07XXXXXXXX, 01XXXXXXXX or 254...';
                    return null;
                  },
                ),
              ],
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isLoading ? null : _handleDeposit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00C853),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: _isLoading
                    ? const SizedBox(
                        height: 24,
                        width: 24,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2))
                    : Text(
                        _isSuccess ? 'Request Sent ✅' : 'Pay via STK Push',
                        style: const TextStyle(
                            fontSize: 18, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: _isQrLoading ? null : _handleQrGeneration,
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFF00C853)),
                  foregroundColor: const Color(0xFF00C853),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: _isQrLoading
                    ? const SizedBox(
                        height: 24,
                        width: 24,
                        child: CircularProgressIndicator(
                            color: Color(0xFF00C853), strokeWidth: 2))
                    : const Text('Generate QR Code',
                        style: TextStyle(
                            fontSize: 18, fontWeight: FontWeight.bold)),
              ),
              if (_isSuccess)
                const Padding(
                  padding: EdgeInsets.only(top: 16),
                  child: Text(
                    'Follow the prompt on your M-Pesa phone to complete.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.greenAccent, fontSize: 13),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
