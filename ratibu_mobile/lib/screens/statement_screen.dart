import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class StatementScreen extends StatefulWidget {
  final String accountType; // 'chama' | 'savings_target' | 'mshwari' | 'all'
  final String? accountId;
  final String accountName;

  const StatementScreen({
    super.key,
    required this.accountType,
    this.accountId,
    required this.accountName,
  });

  @override
  State<StatementScreen> createState() => _StatementScreenState();
}

class _StatementScreenState extends State<StatementScreen> {
  final _supabase = Supabase.instance.client;
  final _fmt = NumberFormat('#,##0');
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;

  Future<T> _retry<T>(Future<T> Function() action) async {
    Object? lastError;
    for (var i = 0; i < 3; i++) {
      try {
        return await action();
      } catch (e) {
        lastError = e;
        final message = e.toString().toLowerCase();
        if (i == 2 ||
            !(message.contains('connection reset by peer') ||
                message.contains('clientexception') ||
                message.contains('socketexception'))) {
          rethrow;
        }
        await Future<void>.delayed(Duration(milliseconds: 300 * (i + 1)));
      }
    }
    throw lastError ?? Exception('Request failed');
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) return;

      var q = _supabase
          .from('transactions')
          .select('id, type, amount, status, description, reference, created_at')
          .eq('user_id', user.id);

      if (widget.accountType == 'chama' && widget.accountId != null) {
        q = q.eq('chama_id', widget.accountId!);
      } else if (widget.accountType == 'savings_target' && widget.accountId != null) {
        q = q.eq('savings_target_id', widget.accountId!);
      } else if (widget.accountType == 'mshwari') {
        q = q.ilike('description', '%mshwari%');
      }

      final data = await _retry(() => q.order('created_at', ascending: false).limit(100));
      final rows = data as List? ?? const [];
      if (mounted) {
        setState(() => _rows = rows.map((row) => Map<String, dynamic>.from(row as Map)).toList());
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load statement: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _buildStatementText() {
    double credits = 0;
    double debits = 0;
    final buffer = StringBuffer();
    buffer.writeln('RATIBU TRANSACTION STATEMENT');
    buffer.writeln('Account: ${widget.accountName}');
    buffer.writeln('Generated: ${DateFormat('y MMM d, HH:mm').format(DateTime.now())}');
    buffer.writeln('');
    buffer.writeln('DATE                | DESCRIPTION                 | TYPE       | STATUS    | AMOUNT');
    buffer.writeln('-------------------- | --------------------------- | ---------- | --------- | -------------');
    for (final tx in _rows) {
      final type = tx['type']?.toString() ?? '';
      final isCredit = type == 'deposit' || type == 'credit';
      final amount = (tx['amount'] as num? ?? 0).toDouble();
      final status = tx['status']?.toString() ?? '';
      final desc = tx['description']?.toString() ?? type;
      final safeDesc = desc.isEmpty ? type : desc;
      final date = DateTime.tryParse(tx['created_at']?.toString() ?? '');
      if (isCredit) {
        credits += amount;
      } else {
        debits += amount;
      }
      final dateText = date != null ? DateFormat('yyyy-MM-dd HH:mm').format(date.toLocal()) : 'Unknown date';
      final rowAmount = '${isCredit ? '+' : '-'}KES ${_fmt.format(amount)}';
      buffer.writeln(
        '${dateText.padRight(20)} | ${_truncate(_capitalize(safeDesc), 27).padRight(27)} | '
        '${_truncate(type.toUpperCase(), 10).padRight(10)} | ${_truncate(status, 9).padRight(9)} | ${rowAmount.padLeft(13)}',
      );
      if (tx['reference'] != null) {
        buffer.writeln('Ref: ${tx['reference']}');
      }
      buffer.writeln('');
    }
    buffer.writeln('SUMMARY');
    buffer.writeln('Total credits : KES ${_fmt.format(credits)}');
    buffer.writeln('Total debits  : KES ${_fmt.format(debits)}');
    buffer.writeln('Net movement   : KES ${_fmt.format(credits - debits)}');
    return buffer.toString();
  }

  Future<void> _shareStatement() async {
    await SharePlus.instance.share(
      ShareParams(
        text: _buildStatementText(),
        subject: '${widget.accountName} statement',
      ),
    );
  }

  Future<void> _copyStatement() async {
    await Clipboard.setData(ClipboardData(text: _buildStatementText()));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Statement copied to clipboard')),
      );
    }
  }

  String _buildCsv() {
    final header = ['Date', 'Description', 'Type', 'Status', 'Amount', 'Reference'];
    final rows = _rows.map((tx) => [
      DateFormat('y-MM-dd HH:mm').format(DateTime.tryParse(tx['created_at']?.toString() ?? '') ?? DateTime.now()),
      tx['description']?.toString() ?? tx['type']?.toString() ?? '',
      tx['type']?.toString() ?? '',
      tx['status']?.toString() ?? '',
      (tx['amount'] as num? ?? 0).toStringAsFixed(2),
      tx['reference']?.toString() ?? '',
    ]).toList();

    return [
      header,
      ...rows,
    ].map((line) => line.map((value) => '"${value.toString().replaceAll('"', '""')}"').join(',')).join('\n');
  }

  Future<void> _exportCsv() async {
    final csv = _buildCsv();
    final dir = Directory.systemTemp.createTempSync('ratibu_statement_');
    final file = File('${dir.path}/${widget.accountName.replaceAll(RegExp(r'[^A-Za-z0-9]+'), '_').toLowerCase()}_statement.csv');
    await file.writeAsString(csv);

    await SharePlus.instance.share(
      ShareParams(
        text: 'Ratibu statement CSV',
        files: [XFile(file.path)],
      ),
    );
  }

  Future<void> _savePdf() async {
    final doc = pw.Document();
    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(24),
        build: (context) => [
          pw.Text(
            'RATIBU TRANSACTION STATEMENT',
            style: pw.TextStyle(fontSize: 20, fontWeight: pw.FontWeight.bold),
          ),
          pw.SizedBox(height: 8),
          pw.Text('Account: ${widget.accountName}'),
          pw.Text('Generated: ${DateFormat('y MMM d, HH:mm').format(DateTime.now())}'),
          pw.SizedBox(height: 16),
          pw.TableHelper.fromTextArray(
            headers: const ['Date', 'Description', 'Type', 'Status', 'Amount'],
            data: _rows.map((tx) {
              final date = DateTime.tryParse(tx['created_at']?.toString() ?? '');
              final type = tx['type']?.toString() ?? '';
              final isCredit = type == 'deposit' || type == 'credit';
              return [
                date != null ? DateFormat('y-MM-dd HH:mm').format(date.toLocal()) : 'Unknown date',
                tx['description']?.toString() ?? type,
                type,
                tx['status']?.toString() ?? '',
                '${isCredit ? '+' : '-'}KES ${_fmt.format((tx['amount'] as num? ?? 0).toDouble())}',
              ];
            }).toList(),
          ),
        ],
      ),
    );

    await Printing.layoutPdf(
      onLayout: (_) async => doc.save(),
      name: '${widget.accountName.replaceAll(RegExp(r'[^A-Za-z0-9]+'), '_').toLowerCase()}_statement.pdf',
    );
  }

  String _capitalize(String value) {
    if (value.isEmpty) return 'Transaction';
    return value[0].toUpperCase() + value.substring(1);
  }

  String _truncate(String value, int max) {
    if (value.length <= max) return value;
    return '${value.substring(0, max - 1)}…';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.accountName,
              style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const Text('Transaction statement', style: TextStyle(color: Colors.white54, fontSize: 12)),
          ],
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          IconButton(
            tooltip: 'Download PDF',
            onPressed: _rows.isEmpty ? null : _savePdf,
            icon: const Icon(Icons.picture_as_pdf, color: Colors.white),
          ),
          IconButton(
            tooltip: 'Export CSV',
            onPressed: _rows.isEmpty ? null : _exportCsv,
            icon: const Icon(Icons.table_view, color: Colors.white),
          ),
          IconButton(
            tooltip: 'Share statement',
            onPressed: _rows.isEmpty ? null : _shareStatement,
            icon: const Icon(Icons.ios_share, color: Colors.white),
          ),
          IconButton(
            tooltip: 'Copy statement',
            onPressed: _rows.isEmpty ? null : _copyStatement,
            icon: const Icon(Icons.copy, color: Colors.white),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C853)))
          : RefreshIndicator(
              onRefresh: _load,
              color: const Color(0xFF00C853),
              child: _rows.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 80),
                        Icon(Icons.receipt_long_outlined, color: Colors.white24, size: 48),
                        SizedBox(height: 12),
                        Center(
                          child: Text(
                            'No transactions yet for this account.',
                            style: TextStyle(color: Colors.white54),
                          ),
                        ),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _rows.length + 1,
                      separatorBuilder: (_, __) => const Divider(color: Colors.white10, height: 1),
                      itemBuilder: (_, i) {
                        if (i == _rows.length) {
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 24),
                            child: Center(
                              child: TextButton.icon(
                                onPressed: _shareStatement,
                                icon: const Icon(Icons.download, color: Color(0xFF00C853)),
                                label: const Text(
                                  'Save / Share Statement',
                                  style: TextStyle(color: Color(0xFF00C853)),
                                ),
                              ),
                            ),
                          );
                        }

                        final tx = _rows[i];
                        final type = tx['type']?.toString() ?? '';
                        final isCredit = type == 'deposit' || type == 'credit';
                        final amount = (tx['amount'] as num? ?? 0).toDouble();
                        final status = tx['status']?.toString() ?? '';
                        final desc = tx['description']?.toString() ?? type;
                        final safeDesc = desc.isEmpty ? type : desc;
                        final date = DateTime.tryParse(tx['created_at']?.toString() ?? '');

                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: isCredit
                                      ? const Color(0xFF00C853).withValues(alpha: 0.12)
                                      : Colors.red.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Icon(
                                  isCredit ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
                                  color: isCredit ? const Color(0xFF00C853) : Colors.redAccent,
                                  size: 18,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _capitalize(safeDesc),
                                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                                    ),
                                    if (date != null)
                                      Text(
                                        DateFormat('d MMM y, HH:mm').format(date.toLocal()),
                                        style: const TextStyle(color: Colors.white38, fontSize: 11),
                                      ),
                                    if (tx['reference'] != null)
                                      Text('Ref: ${tx['reference']}', style: const TextStyle(color: Colors.white38, fontSize: 11)),
                                  ],
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    '${isCredit ? '+' : '-'}KES ${_fmt.format(amount)}',
                                    style: TextStyle(
                                      color: isCredit ? const Color(0xFF00C853) : Colors.redAccent,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  Container(
                                    margin: const EdgeInsets.only(top: 4),
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: status == 'completed'
                                          ? const Color(0xFF00C853).withValues(alpha: 0.12)
                                          : status == 'pending'
                                              ? Colors.orange.withValues(alpha: 0.12)
                                              : Colors.red.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      status,
                                      style: TextStyle(
                                        fontSize: 10,
                                        color: status == 'completed'
                                            ? const Color(0xFF00C853)
                                            : status == 'pending'
                                                ? Colors.orange
                                                : Colors.redAccent,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
