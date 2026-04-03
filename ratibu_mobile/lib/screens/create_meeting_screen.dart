import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../providers/chama_provider.dart';
import '../utils/notification_helper.dart';

class CreateMeetingScreen extends ConsumerStatefulWidget {
  final String chamaId;
  const CreateMeetingScreen({super.key, required this.chamaId});

  @override
  ConsumerState<CreateMeetingScreen> createState() =>
      _CreateMeetingScreenState();
}

class _CreateMeetingScreenState extends ConsumerState<CreateMeetingScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _venueController = TextEditingController();

  DateTime? _selectedDate;
  TimeOfDay? _selectedTime;
  bool _isLoading = false;
  bool _isVirtual = false;

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _venueController.dispose();
    super.dispose();
  }

  /// Generates a deterministic Jitsi room name from chamaId + date
  String _generateJitsiRoom() {
    final date = _selectedDate ?? DateTime.now();
    final slug = 'ratibu-${widget.chamaId.substring(0, 8)}-'
        '${date.year}${date.month.toString().padLeft(2, '0')}${date.day.toString().padLeft(2, '0')}';
    return slug;
  }

  String get _jitsiUrl => 'https://meet.jit.si/${_generateJitsiRoom()}';

  Future<void> _selectDate(BuildContext context) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (context, child) => Theme(
        data: ThemeData.dark().copyWith(
          colorScheme: const ColorScheme.dark(
            primary: Color(0xFF00C853),
            onPrimary: Colors.white,
            surface: Color(0xFF1e293b),
            onSurface: Colors.white,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _selectedDate = picked);
  }

  Future<void> _selectTime(BuildContext context) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 10, minute: 0),
      builder: (context, child) => Theme(
        data: ThemeData.dark().copyWith(
          colorScheme: const ColorScheme.dark(
            primary: Color(0xFF00C853),
            onPrimary: Colors.white,
            surface: Color(0xFF1e293b),
            onSurface: Colors.white,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _selectedTime = picked);
  }

  Future<void> _scheduleLocalReminders(
      DateTime meetingTime, String title) async {
    final reminders = [
      const Duration(hours: 24),
      const Duration(hours: 2),
      const Duration(minutes: 30),
    ];
    final labels = ['24 hours', '2 hours', '30 minutes'];
    for (int i = 0; i < reminders.length; i++) {
      final notifyAt = meetingTime.subtract(reminders[i]);
      if (notifyAt.isAfter(DateTime.now())) {
        await NotificationHelper.scheduleOfflineNotification(
          title: '⏰ Meeting in ${labels[i]}',
          message: '"$title" starts in ${labels[i]}.',
          scheduledTime: notifyAt,
        );
      }
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedDate == null || _selectedTime == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select date and time')),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      final meetingDateTime = DateTime(
        _selectedDate!.year,
        _selectedDate!.month,
        _selectedDate!.day,
        _selectedTime!.hour,
        _selectedTime!.minute,
      );

      // Auto-generate Jitsi room URL for virtual meetings
      final videoLink = _isVirtual ? _jitsiUrl : null;

      await ref.read(chamaServiceProvider).createMeeting(
            chamaId: widget.chamaId,
            title: _titleController.text.trim(),
            description: _descriptionController.text.trim(),
            date: meetingDateTime,
            venue: _isVirtual
                ? 'Online (Ratibu Meet)'
                : _venueController.text.trim(),
            videoLink: videoLink,
          );

      await _scheduleLocalReminders(
          meetingDateTime, _titleController.text.trim());
      ref.invalidate(chamaMeetingsProvider(widget.chamaId));

      if (mounted) {
        NotificationHelper.sendNotification(
          title: 'Meeting Scheduled!',
          message: 'Meeting "${_titleController.text}" has been scheduled.',
          type: 'info',
        );
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Meeting scheduled!'),
            backgroundColor: Color(0xFF00C853),
          ),
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
        title: const Text('Schedule Meeting'),
        backgroundColor: const Color(0xFF0f172a),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      backgroundColor: const Color(0xFF0f172a),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('New Meeting',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              const Text('Schedule a gathering for this Chama.',
                  style: TextStyle(color: Colors.grey)),
              const SizedBox(height: 28),

              // Title
              TextFormField(
                controller: _titleController,
                style: const TextStyle(color: Colors.white),
                decoration: _dec('Meeting Title', Icons.title),
                validator: (v) => v == null || v.isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 16),

              // Description
              TextFormField(
                controller: _descriptionController,
                style: const TextStyle(color: Colors.white),
                decoration: _dec('Agenda / Description', Icons.description),
                maxLines: 3,
              ),
              const SizedBox(height: 16),

              // Date & Time
              Row(
                children: [
                  Expanded(
                    child: _picker(
                      icon: Icons.calendar_today,
                      label: _selectedDate == null
                          ? 'Select Date'
                          : DateFormat('MMM d, y').format(_selectedDate!),
                      hasValue: _selectedDate != null,
                      onTap: () => _selectDate(context),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _picker(
                      icon: Icons.access_time,
                      label: _selectedTime == null
                          ? 'Select Time'
                          : _selectedTime!.format(context),
                      hasValue: _selectedTime != null,
                      onTap: () => _selectTime(context),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Virtual toggle
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF1e293b),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: _isVirtual
                        ? const Color(0xFF00C853).withValues(alpha: 0.4)
                        : Colors.white10,
                  ),
                ),
                child: SwitchListTile(
                  title: const Text('Virtual Meeting',
                      style: TextStyle(
                          color: Colors.white, fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    _isVirtual
                        ? 'Powered by Ratibu Meet. Opens in your browser or meeting app.'
                        : 'Toggle to enable a virtual meeting link',
                    style: TextStyle(
                      color:
                          _isVirtual ? const Color(0xFF00C853) : Colors.white38,
                      fontSize: 12,
                    ),
                  ),
                  value: _isVirtual,
                  activeColor: const Color(0xFF00C853),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  onChanged: (val) => setState(() => _isVirtual = val),
                ),
              ),

              // Jitsi room preview
              if (_isVirtual && _selectedDate != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFF00C853).withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: const Color(0xFF00C853).withValues(alpha: 0.2)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.videocam,
                          color: Color(0xFF00C853), size: 18),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Room auto-generated',
                                style: TextStyle(
                                    color: Color(0xFF00C853),
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold)),
                            Text(
                              _jitsiUrl,
                              style: const TextStyle(
                                  color: Colors.white54, fontSize: 11),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              // Physical venue
              if (!_isVirtual) ...[
                const SizedBox(height: 16),
                TextFormField(
                  controller: _venueController,
                  style: const TextStyle(color: Colors.white),
                  decoration: _dec('Physical Venue', Icons.location_on),
                  validator: (v) => !_isVirtual && (v == null || v.isEmpty)
                      ? 'Required'
                      : null,
                ),
              ],

              const SizedBox(height: 32),

              SizedBox(
                height: 52,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF00C853),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2))
                      : const Text('Schedule Meeting',
                          style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _picker({
    required IconData icon,
    required String label,
    required bool hasValue,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFF1e293b),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white10),
        ),
        child: Row(
          children: [
            Icon(icon, color: const Color(0xFF00C853), size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: hasValue ? Colors.white : Colors.grey,
                  fontSize: 13,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _dec(String label, IconData icon) => InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: Colors.grey),
        prefixIcon: Icon(icon, color: const Color(0xFF00C853)),
        filled: true,
        fillColor: const Color(0xFF1e293b),
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
