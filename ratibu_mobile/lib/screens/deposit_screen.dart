import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../services/mpesa_service.dart';
import '../providers/auth_provider.dart';
import '../utils/notification_helper.dart';
import '../widgets/qr_code_display.dart';

class DepositScreen extends ConsumerStatefulWidget {
  final String? chamaId; // Made optional to support generic "Deposit" later, but enforcing for now

  const DepositScreen({super.key, this.chamaId});

  @override
  ConsumerState<DepositScreen> createState() => _DepositScreenState();
}

class _DepositScreenState extends ConsumerState<DepositScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _phoneController = TextEditingController();
  final _mpesaService = MpesaService();
  DateTime? _dueDate;
  bool _isLoading = false;
  bool _isQrLoading = false;
  bool _isSuccess = false;
  String _phoneOption = 'mine'; // 'mine' or 'other'
  String? _myNumber;

  @override
  void initState() {
    super.initState();
    // Pre-fill phone number if available from user profile
    final user = ref.read(authProvider).mapState(
          authenticated: (state) => state.user,
        );
    // In a real app, you'd fetch the phone from the 'users' table metadata/profile
     if (user?.phone != null) {
       _myNumber = user!.phone;
       _phoneController.text = _myNumber!.replaceFirst('+', '');
     } else {
       _phoneOption = 'other';
     }
  }

  @override
  void dispose() {
    _amountController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _handleDeposit() async {
    if (_formKey.currentState!.validate()) {
      setState(() => _isLoading = true);
      try {
        final amount = double.tryParse(_amountController.text.trim());
        if (amount == null) throw 'Invalid amount format';
        String phone;
        
        // DEBUG: Print user details to console
        final user = ref.read(authProvider).mapState(
            authenticated: (state) => state.user,
        );
        print('DEBUG - User Phone: ${user?.phone}');
        print('DEBUG - User Metadata: ${user?.userMetadata}');
        
        if (_phoneOption == 'mine') {
            var userPhone = user?.phone;
            
            // Fallback to metadata if top-level phone is empty
            if (userPhone == null || userPhone.isEmpty) {
               userPhone = user?.userMetadata?['phone'] as String?;
            }

            if (userPhone == null || userPhone.isEmpty) {
               throw 'Profile missing phone number. Please select "Other Number".';
            }
            phone = userPhone.replaceFirst('+', '');
        } else {
             phone = _phoneController.text.trim();
        }
        
        // Use user ID 
        final userId = ref.read(authProvider).mapState(
          authenticated: (state) => state.user.id,
        );
        
        if (userId == null) throw 'User not authenticated';
        
        // For now, require chamaId. In future, we can allow "Wallet" deposits.
        if (widget.chamaId == null) {
          throw 'Please select a Chama to deposit to (Feature coming soon: Wallet Deposit)';
        }

        await _mpesaService.initiateStkPush(
          phoneNumber: phone,
          amount: amount,
          userId: userId,
          chamaId: widget.chamaId!, 
        );

        if (mounted) {
          setState(() {
            _isSuccess = true;
          });

          NotificationHelper.showToast(
            context,
            title: 'STK Push Sent!',
            message: 'Follow the prompt on your phone to complete payment.',
            type: 'success',
          );
          
          // Wait a bit then pop
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
        if (mounted) {
          setState(() => _isLoading = false);
        }
      }
    }
  }

  Future<void> _handleQrGeneration() async {
    if (_formKey.currentState!.validate()) {
      setState(() => _isQrLoading = true);
      try {
        final amount = double.tryParse(_amountController.text.trim());
        if (amount == null) throw 'Invalid amount format';
        
        // For now, require chamaId. 
        if (widget.chamaId == null) {
          throw 'Please select a Chama to generate QR (Feature coming soon: Wallet Deposit)';
        }

        final qrData = await _mpesaService.generateQrCode(
          amount: amount,
          merchantName: 'Ratibu Chama', // In real app, fetch from chama details
          refNo: 'Deposit-${DateTime.now().millisecond}',
        );

        if (mounted && qrData['QRCode'] != null) {
          showModalBottomSheet(
            context: context,
            isScrollControlled: true,
            backgroundColor: Colors.transparent,
            builder: (context) => QrCodeDisplay(
              qrCodeBase64: qrData['QRCode'],
              amount: amount,
              chamaName: 'the Chama', // In real app, fetch from chama details
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
        if (mounted) {
          setState(() => _isQrLoading = false);
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Deposit Funds', style: TextStyle(color: Colors.white)),
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
                  border: Border.all(color: const Color(0xFF00C853).withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    Image.network(
                      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Mjpesa.png/320px-Mjpesa.png', // M-Pesa Logo placeholder
                      height: 40,
                      errorBuilder: (c, e, s) => const Icon(Icons.phone_android, color: Colors.green, size: 40),
                    ),
                    const SizedBox(width: 16),
                    const Expanded(
                      child: Text(
                        'M-Pesa Express (STK Push)',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              
              // Amount Input
              const Text(
                'Enter Amount (KES)',
                style: TextStyle(color: Colors.white70, fontSize: 14),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _amountController,
                style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                keyboardType: TextInputType.number,
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
                validator: (value) {
                  if (value == null || value.isEmpty) return 'Please enter an amount';
                  if (double.tryParse(value) == null) return 'Invalid number format';
                  if (double.parse(value) <= 0) return 'Amount must be greater than 0';
                  return null;
                },
              ),
              
              const SizedBox(height: 24),
              // Phone Number Selection
              const SizedBox(height: 16),
              const Text(
                'Select Phone Number',
                style: TextStyle(color: Colors.white70, fontSize: 14),
              ),
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
                      onChanged: (value) {
                        setState(() {
                          _phoneOption = value!;
                          if (_myNumber != null) {
                            _phoneController.text = _myNumber!.replaceFirst('+', '');
                          }
                        });
                      },
                    ),
                    Divider(height: 1, color: Colors.white10),
                    RadioListTile<String>(
                      title: const Text(
                        'Other Number',
                        style: TextStyle(color: Colors.white),
                      ),
                      value: 'other',
                      groupValue: _phoneOption,
                      activeColor: const Color(0xFF00C853),
                      onChanged: (value) {
                        setState(() {
                          _phoneOption = value!;
                          _phoneController.clear();
                        });
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              
              if (_phoneOption == 'other')
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
                  validator: (value) {
                    if (value == null || value.isEmpty) return 'Required';
                    if (!RegExp(r'^254\d{9}$').hasMatch(value)) {
                      return 'Format: 2547XXXXXXXX';
                    }
                    return null;
                  },
                ),
                
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isLoading ? null : _handleDeposit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00C853),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isLoading
                    ? const SizedBox(
                        height: 24,
                        width: 24,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : Text(
                        _isSuccess ? 'Request Sent ✅' : 'Pay via STK Push',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
              ),
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: _isQrLoading ? null : _handleQrGeneration,
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFF00C853)),
                  foregroundColor: const Color(0xFF00C853),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isQrLoading
                    ? const SizedBox(
                        height: 24,
                        width: 24,
                        child: CircularProgressIndicator(
                          color: Color(0xFF00C853),
                          strokeWidth: 2,
                        ),
                      )
                    : const Text(
                        'Generate QR Code',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
              ),
              if (_isSuccess)
                const Padding(
                  padding: EdgeInsets.only(top: 16),
                  child: Text(
                    'Follow the prompt on your M-Pesa phone to complete transaction.',
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
