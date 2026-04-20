import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
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
  String _buyFor = 'self';
  String _phoneOption = 'mine';
  String _billType = 'prepaid';
  String? _myNumber;
  bool _debugLoading = false;
  String _debugAction = '';
  Map<String, dynamic>? _debugRequest;
  Map<String, dynamic>? _debugResponse;
  String _statusReference = '';
  List<Map<String, String>> _favorites = [];
  final List<Map<String, String>> _defaultMeters = const [
    {'label': 'House 24-three Steers', 'value': '0175115472516'},
    {'label': 'Office Main Line', 'value': '254716242252'},
  ];

  @override
  void initState() {
    super.initState();
    _billType = widget.initialType == 'postpaid' ? 'postpaid' : 'prepaid';
    _loadUserPhone();
    _loadFavorites();
  }

  Future<void> _loadFavorites() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getStringList('ratibu.kplc.favorites') ?? [];
      final parsed = raw
          .map((entry) {
            try {
              final decoded = jsonDecode(entry);
              if (decoded is Map<String, dynamic> &&
                  decoded['label'] is String &&
                  decoded['value'] is String) {
                return {
                  'label': decoded['label'] as String,
                  'value': decoded['value'] as String,
                };
              }
            } catch (_) {}
            return null;
          })
          .whereType<Map<String, String>>()
          .toList();
      if (!mounted) return;
      setState(() {
        _favorites = parsed;
      });
    } catch (_) {}
  }

  Future<void> _saveFavorites() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(
        'ratibu.kplc.favorites',
        _favorites.map(jsonEncode).toList(),
      );
    } catch (_) {}
  }

  Future<void> _removeFavoriteMeter(String value) async {
    final next = _favorites.where((item) => item['value'] != value).toList();
    if (next.length == _favorites.length) return;
    setState(() {
      _favorites = next;
    });
    await _saveFavorites();
    _showToast(
      title: 'Favourite removed',
      message: 'The meter was removed from your favourites.',
      type: 'success',
    );
  }

  void _addFavoriteMeter() {
    final cleaned = _meterController.text.replaceAll(RegExp(r'[\s\-\(\)]'), '').trim();
    final meterError = _validateMeterNumber(cleaned);
    if (meterError != null) {
      _showToast(
        title: 'Invalid Meter',
        message: meterError,
        type: 'error',
      );
      return;
    }

    final exists = _favorites.any((item) => item['value'] == cleaned);
    if (exists) {
      _showToast(
        title: 'Already saved',
        message: 'That meter is already in your favourites.',
        type: 'info',
      );
      return;
    }

    setState(() {
      _favorites = [
        {
          'label': cleaned.length > 12 ? 'Meter ${cleaned.substring(cleaned.length - 4)}' : 'Meter $cleaned',
          'value': cleaned,
        },
        ..._favorites,
      ].take(6).toList();
    });
    _saveFavorites();
    _showToast(
      title: 'Favourite saved',
      message: 'The meter was added to your favourites.',
      type: 'success',
    );
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

  String? _validateMeterNumber(String? value) {
    final cleaned = value?.replaceAll(RegExp(r'[\s\-\(\)]'), '').trim() ?? '';
    if (cleaned.isEmpty) return 'Enter a meter/account number.';
    if (!RegExp(r'^\d{6,15}$').hasMatch(cleaned)) {
      return 'Meter/account numbers should be 6 to 15 digits.';
    }
    const dummyValues = {
      '000000',
      '0000000',
      '00000000',
      '000000000',
      '0000000000',
      '111111',
      '1111111',
      '11111111',
      '111111111',
      '1111111111',
      '123456',
      '1234567',
      '12345678',
      '123456789',
      '1234567890',
      '999999',
      '9999999',
      '99999999',
      '999999999',
      '9999999999',
    };
    if (dummyValues.contains(cleaned)) {
      return 'That looks like a dummy meter number. Please enter a real KPLC meter/account number.';
    }
    if (RegExp(r'^(\d)\1+$').hasMatch(cleaned)) {
      return 'That looks like a placeholder meter number. Please enter a real KPLC meter/account number.';
    }
    return null;
  }

  @override
  void dispose() {
    _meterController.dispose();
    _amountController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  String _billCode() => _billType == 'prepaid' ? '888880' : '888888';

  void _showToast({
    required String title,
    required String message,
    String type = 'success',
  }) {
    if (!mounted) return;
    NotificationHelper.showToast(
      context,
      title: title,
      message: message,
      type: type,
    );
  }

  String _firstString(List<dynamic> values, {String fallback = ''}) {
    for (final value in values) {
      if (value is String && value.trim().isNotEmpty) return value.trim();
      if (value is num || value is bool) return value.toString();
    }
    return fallback;
  }

  Map<String, dynamic>? _asMap(dynamic value) {
    return value is Map<String, dynamic> ? value : null;
  }

  bool _isMissingGatewayError(Object error) {
    final message = error.toString().toLowerCase();
    return message.contains('requested function was not found') ||
        message.contains('not_found') ||
        message.contains('functionexception(status: 404');
  }

  bool _isKcbConfigIssueMessage(String message) {
    return message.contains('missing kcb buni credentials') ||
        message.contains('kcb vending validation failed') ||
        message.contains('kcb buni not configured') ||
        message.contains('kcb gateway is not configured') ||
        message.contains('kcb_buni_not_configured');
  }

  Map<String, dynamic> _kcbSummary() {
    final Map<String, dynamic>? response = _debugResponse;
    final Map<String, dynamic>? data = _asMap(response?['data']) ?? response;
    final Map<String, dynamic>? requestPayload = _asMap(data?['requestPayload']);
    final Map<String, dynamic>? transactionInfo = _asMap(requestPayload?['transactionInfo']);
    final Map<String, dynamic>? billerData = _asMap(requestPayload?['billerData']);
    final Map<String, dynamic>? payload = _asMap(data?['payload']);
    final successValue = data?['success'];
    final errorValue = data?['error'];

    final status = _firstString([
      data?['status'],
      data?['responseStatus'],
      data?['responseCode'],
      data?['resultCode'],
      data?['code'],
      successValue == true ? 'success' : successValue == false ? 'failed' : '',
      errorValue ?? '',
    ], fallback: 'PENDING').toUpperCase();

    final message = _firstString([
      data?['message'],
      data?['responseDescription'],
      data?['description'],
      data?['resultDesc'],
      data?['reason'],
      data?['detail'],
      errorValue,
    ], fallback: 'KCB returned a response.');

    final reference = _firstString([
      transactionInfo?['transactionReference'],
      transactionInfo?['originatorRequestId'],
      transactionInfo?['billReference'],
      transactionInfo?['billerRef'],
      payload?['originatorRequestId'],
      data?['reference'],
    ], fallback: 'Not provided');

    final amount = _firstString([
      transactionInfo?['transactionAmount'],
      data?['amount'],
    ]);

    final billerCode = _firstString([
      billerData?['billerCode'],
      data?['billerCode'],
    ]);

    return {
      'status': status,
      'message': message,
      'reference': reference,
      'amount': amount,
      'billerCode': billerCode,
      'action': response?['action']?.toString() ?? 'unknown',
    };
  }

  Color _statusColor(String status) {
    final normalized = status.toLowerCase();
    if (normalized.contains('success') || normalized.contains('approved') || normalized.contains('ok')) {
      return const Color(0xFF00C853);
    }
    if (normalized.contains('fail') || normalized.contains('reject') || normalized.contains('error')) {
      return const Color(0xFFFF6B6B);
    }
    return const Color(0xFF38BDF8);
  }

  Widget _kcbResultCard() {
    final summary = _kcbSummary();
    final color = _statusColor(summary['status'] as String? ?? '');
    final rawRequest = _debugRequest ?? const {};
    final rawResponse = _debugResponse ?? const {};

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.25)),
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
                    const Text('KCB Result', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text(
                      'A compact summary of the latest KCB response.',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.65), fontSize: 12),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: color.withValues(alpha: 0.25)),
                ),
                child: Text(
                  summary['status'] as String? ?? 'PENDING',
                  style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 11),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _summaryTile('Reference', summary['reference'] as String? ?? 'Not provided'),
          const SizedBox(height: 10),
          _summaryTile('Message', summary['message'] as String? ?? 'KCB returned a response.'),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _miniStat('Action', summary['action'] as String? ?? 'unknown')),
              const SizedBox(width: 8),
              Expanded(child: _miniStat('Amount', summary['amount'] as String? ?? 'n/a')),
              const SizedBox(width: 8),
              Expanded(child: _miniStat('Biller', summary['billerCode'] as String? ?? 'n/a')),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Status reference: ${_statusReference.isEmpty ? 'none yet' : _statusReference}',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.65), fontSize: 12),
          ),
          const SizedBox(height: 10),
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            collapsedIconColor: const Color(0xFF00C853),
            iconColor: const Color(0xFF00C853),
            title: const Text(
              'Raw payloads',
              style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
            ),
            children: [
              _rawJsonBlock('Last Request', rawRequest),
              const SizedBox(height: 12),
              _rawJsonBlock('Last Response', rawResponse),
            ],
          ),
        ],
      ),
    );
  }

  Widget _summaryTile(String label, String value) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF111827),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: const TextStyle(color: Colors.white54, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.3)),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _miniStat(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF111827),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Colors.white54, fontSize: 10, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _rawJsonBlock(String title, Map<String, dynamic> data) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF111827),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          SelectableText(
            const JsonEncoder.withIndent('  ').convert(data),
            style: const TextStyle(color: Colors.white70, fontFamily: 'monospace', fontSize: 12),
          ),
        ],
      ),
    );
  }

  Map<String, dynamic> _basePayload({
    required String phone,
    required double amount,
  }) {
    return {
      'billerCode': _billCode(),
      'accountReference': _meterController.text.trim(),
      'amount': amount,
      'phoneNumber': phone,
      'billName': _billType == 'prepaid' ? 'KPLC Prepaid Token' : 'KPLC Postpaid Bill',
      'transactionType': 'bill_payment',
      'source': 'ratibu_mobile',
    };
  }

  Future<void> _runDebugAction(
    String action,
    Map<String, dynamic> payload, {
    String? statusReference,
  }) async {
    setState(() {
      _debugLoading = true;
      _debugAction = action;
      _debugRequest = {
        'action': action,
        'payload': payload,
      };
      _debugResponse = null;
    });

    try {
      Map<String, dynamic> response;
      if (action == 'validate-request') {
        response = await _mpesaService.debugKcbGateway(
          action: 'validate-request',
          payload: payload,
        );
        if (mounted) {
          setState(() {
            _statusReference = response['data']?['requestPayload']?['transactionInfo']?['transactionReference']?.toString() ??
                response['data']?['requestPayload']?['transactionInfo']?['originatorRequestId']?.toString() ??
                _statusReference;
          });
        }
      } else if (action == 'vendor-confirmation') {
        response = await _mpesaService.previewKcbPurchase(
          phoneNumber: payload['phoneNumber'] as String? ?? '',
          amount: (payload['transactionAmount'] as num?)?.toDouble() ?? 0,
          billerCode: payload['billerCode'] as String? ?? _billCode(),
          accountReference: payload['billReference'] as String? ?? '',
          billName: payload['billName'] as String? ?? 'KPLC Payment',
          transactionReference: payload['transactionReference'] as String?,
          narration: payload['narration'] as String?,
        );
        if (mounted) {
          setState(() {
            _statusReference = response['data']?['requestPayload']?['transactionInfo']?['transactionReference']?.toString() ??
                _statusReference;
          });
        }
      } else {
        response = await _mpesaService.checkKcbTransactionStatus(
          originatorRequestId: statusReference ?? payload['originatorRequestId'] as String? ?? '',
        );
        if (mounted && (statusReference ?? '').isNotEmpty) {
          setState(() => _statusReference = statusReference!);
        }
      }

      if (!mounted) return;
      setState(() => _debugResponse = response);
    } catch (e) {
      final message = e.toString().toLowerCase();
      if (_isMissingGatewayError(e)) {
        if (mounted) {
          setState(() {
            _debugResponse = {
              'success': false,
              'action': action,
              'message': 'KCB gateway has not been deployed yet. Deploy the new edge function to enable this test.',
              'error': 'Requested function was not found',
            };
          });
        }
        _showToast(
          title: 'KCB gateway missing',
          message: 'Deploy the new edge function and try again.',
          type: 'warning',
        );
      } else if (_isKcbConfigIssueMessage(message)) {
        if (mounted) {
          setState(() {
            _debugResponse = {
              'success': false,
              'action': action,
              'message': 'KCB is not configured yet. Ratibu can still continue with STK after validation is skipped.',
              'error': 'Missing KCB Buni credentials',
              'code': 'KCB_BUNI_NOT_CONFIGURED',
              'configurable': true,
            };
          });
        }
        _showToast(
          title: 'KCB not configured',
          message: 'That validation step is optional for now. Ratibu will continue with STK.',
          type: 'warning',
        );
      } else {
        rethrow;
      }
    } finally {
      if (mounted) {
        setState(() {
          _debugLoading = false;
          _debugAction = '';
        });
      }
    }
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
      final meterError = _validateMeterNumber(meterOrAccount);
      if (meterError != null) {
        throw meterError;
      }

      final isPrepaid = _billType == 'prepaid';
      try {
        await _mpesaService.initiateBillPayment(
          phoneNumber: phone,
          amount: amount,
          userId: userId,
          billerCode: _billCode(),
          accountReference: meterOrAccount,
          billName: isPrepaid ? 'KPLC Prepaid Token' : 'KPLC Postpaid Bill',
        );
      } catch (e) {
        final message = e.toString().toLowerCase();
        final isKcbConfigIssue = message.contains('missing kcb buni credentials') ||
            message.contains('kcb vending validation failed') ||
            message.contains('kcb buni not configured') ||
            message.contains('kcb gateway is not configured');
        if (!isKcbConfigIssue) rethrow;
        if (mounted) {
          _showToast(
            title: 'KCB validation skipped',
            message: 'KCB is not configured yet, so Ratibu is continuing with the normal STK prompt.',
            type: 'warning',
          );
        }
      }

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
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF0F172A), Color(0xFF102A43), Color(0xFF00C853)],
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
                      'Buy Tokens',
                      style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _buyFor == 'self'
                          ? 'Buy KPLC tokens or bill payment for your own meter with the Ratibu flow.'
                          : 'Buy KPLC tokens or bill payment for another meter without changing the flow.',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.75), height: 1.4),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1e293b),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Buy for', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: ChoiceChip(
                            label: const Text('Buy for self'),
                            selected: _buyFor == 'self',
                            onSelected: (_) => setState(() => _buyFor = 'self'),
                            selectedColor: const Color(0xFF00C853).withValues(alpha: 0.18),
                            labelStyle: TextStyle(
                              color: _buyFor == 'self' ? Colors.white : Colors.white70,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: ChoiceChip(
                            label: const Text('Buy for other'),
                            selected: _buyFor == 'other',
                            onSelected: (_) => setState(() => _buyFor = 'other'),
                            selectedColor: const Color(0xFF00C853).withValues(alpha: 0.18),
                            labelStyle: TextStyle(
                              color: _buyFor == 'other' ? Colors.white : Colors.white70,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Container(
                width: double.infinity,
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
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Favorites', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                    TextButton(
                          onPressed: _addFavoriteMeter,
                          child: const Text('Save current meter'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          GestureDetector(
                          onTap: _addFavoriteMeter,
                            child: Container(
                              width: 84,
                              height: 84,
                              margin: const EdgeInsets.only(right: 12),
                              decoration: BoxDecoration(
                                color: const Color(0xFF0F172A),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: Colors.white10, style: BorderStyle.solid),
                              ),
                              child: const Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text('+', style: TextStyle(color: Color(0xFF00C853), fontSize: 28, fontWeight: FontWeight.bold)),
                                  SizedBox(height: 4),
                                  Text('Save', style: TextStyle(color: Colors.white70, fontSize: 11)),
                                ],
                              ),
                            ),
                          ),
                          ...((_favorites.isNotEmpty ? _favorites : _defaultMeters).map(
                            (item) {
                              final isSaved = _favorites.any((fav) => fav['value'] == item['value']);
                              return SizedBox(
                                width: 220,
                                height: 84,
                                child: Stack(
                                  children: [
                                    GestureDetector(
                                      onTap: () => setState(() => _meterController.text = item['value'] ?? ''),
                                      child: Container(
                                        width: 220,
                                        height: 84,
                                        margin: const EdgeInsets.only(right: 12),
                                        padding: const EdgeInsets.all(12),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF0F172A),
                                          borderRadius: BorderRadius.circular(20),
                                          border: Border.all(color: Colors.white10),
                                        ),
                                        child: Row(
                                          children: [
                                            Container(
                                              width: 48,
                                              height: 48,
                                              decoration: const BoxDecoration(
                                                color: Color(0xFF00C853),
                                                shape: BoxShape.circle,
                                              ),
                                              child: Center(
                                                child: Text(
                                                  (item['label'] ?? '?').substring(0, 1),
                                                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 12),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                mainAxisAlignment: MainAxisAlignment.center,
                                                children: [
                                                  Text(
                                                    item['label'] ?? '',
                                                    maxLines: 1,
                                                    overflow: TextOverflow.ellipsis,
                                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                                                  ),
                                                  const SizedBox(height: 4),
                                                  Text(
                                                    item['value'] ?? '',
                                                    maxLines: 1,
                                                    overflow: TextOverflow.ellipsis,
                                                    style: const TextStyle(color: Colors.white54, fontSize: 11),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                    if (isSaved)
                                      Positioned(
                                        right: 0,
                                        top: 0,
                                        child: GestureDetector(
                                          onTap: () => _removeFavoriteMeter(item['value'] ?? ''),
                                          child: Container(
                                            width: 28,
                                            height: 28,
                                            decoration: BoxDecoration(
                                              color: const Color(0xFF111827),
                                              shape: BoxShape.circle,
                                              border: Border.all(color: Colors.white10),
                                            ),
                                            child: const Icon(Icons.close, size: 16, color: Colors.white70),
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              );
                            },
                          )),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
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
                validator: (v) => _validateMeterNumber(v),
              ),
              const SizedBox(height: 8),
              Text(
                'We block obvious dummy meters here, but a KPLC lookup API is needed to confirm whether a meter is truly registered.',
                style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 11, height: 1.4),
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
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _debugLoading
                          ? null
                          : () async {
                              final phone = _phoneOption == 'mine'
                                  ? _myNumber
                                  : _normalizePhone(_phoneController.text.trim());
                              if (phone == null || phone.isEmpty) {
                                _showToast(
                                  title: 'Missing Phone',
                                  message: 'Enter a valid M-Pesa number first.',
                                  type: 'error',
                                );
                                return;
                              }
                              await _runDebugAction(
                                'validate-request',
                                _basePayload(phone: phone, amount: double.tryParse(_amountController.text.trim()) ?? 0),
                              );
                              if (mounted) {
                                _showToast(
                                  title: 'Validation',
                                  message: 'KCB validation response loaded.',
                                );
                              }
                            },
                      child: Text(_debugLoading && _debugAction == 'validate-request' ? 'Validating...' : 'Debug Validate'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _debugLoading
                          ? null
                          : () async {
                              final phone = _phoneOption == 'mine'
                                  ? _myNumber
                                  : _normalizePhone(_phoneController.text.trim());
                              if (phone == null || phone.isEmpty) {
                                _showToast(
                                  title: 'Missing Phone',
                                  message: 'Enter a valid M-Pesa number first.',
                                  type: 'error',
                                );
                                return;
                              }
                              final amount = double.tryParse(_amountController.text.trim()) ?? 0;
                              await _runDebugAction(
                                'vendor-confirmation',
                                {
                                  ..._basePayload(phone: phone, amount: amount),
                                  'transactionAmount': amount.toString(),
                                  'chargeFees': '0',
                                  'transactionReference': _statusReference.isNotEmpty
                                      ? _statusReference
                                      : DateTime.now().microsecondsSinceEpoch.toString(),
                                  'billReference': _meterController.text.trim(),
                                  'narration': _billType == 'prepaid' ? 'token purchase' : 'postpaid bill payment',
                                },
                              );
                              if (mounted) {
                                _showToast(
                                  title: 'Purchase',
                                  message: 'KCB purchase response loaded.',
                                );
                              }
                            },
                      child: Text(_debugLoading && _debugAction == 'vendor-confirmation' ? 'Purchasing...' : 'Debug Purchase'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: _debugLoading
                      ? null
                      : () async {
                          final ref = _statusReference.isNotEmpty
                              ? _statusReference
                              : _meterController.text.trim();
                          if (ref.isEmpty) {
                            _showToast(
                              title: 'Missing Reference',
                              message: 'Run purchase first or enter a status reference.',
                              type: 'error',
                            );
                            return;
                          }
                          await _runDebugAction(
                            'transaction-status',
                            {'originatorRequestId': ref},
                            statusReference: ref,
                          );
                          if (mounted) {
                            _showToast(
                              title: 'Status',
                              message: 'KCB status response loaded.',
                            );
                          }
                        },
                  child: Text(_debugLoading && _debugAction == 'transaction-status' ? 'Checking...' : 'Debug Status'),
                ),
              ),
              const SizedBox(height: 16),
              _kcbResultCard(),
              const SizedBox(height: 16),
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
