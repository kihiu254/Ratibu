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
  ConsumerState<CreateMeetingScreen> createState() => _CreateMeetingScreenState();
}

class _CreateMeetingScreenState extends ConsumerState<CreateMeetingScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _venueController = TextEditingController();
  final _videoLinkController = TextEditingController(); // For Google Meet/Zoom
  
  DateTime? _selectedDate;
  TimeOfDay? _selectedTime;
  bool _isLoading = false;
  bool _isVirtual = false;

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _venueController.dispose();
    _videoLinkController.dispose();
    super.dispose();
  }

  Future<void> _selectDate(BuildContext context) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
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
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  Future<void> _selectTime(BuildContext context) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 10, minute: 0),
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
    if (picked != null) {
      setState(() => _selectedTime = picked);
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
      final DateTime meetingDateTime = DateTime(
        _selectedDate!.year,
        _selectedDate!.month,
        _selectedDate!.day,
        _selectedTime!.hour,
        _selectedTime!.minute,
      );

      await ref.read(chamaServiceProvider).createMeeting(
        chamaId: widget.chamaId,
        title: _titleController.text.trim(),
        description: _descriptionController.text.trim(),
        date: meetingDateTime,
        venue: _isVirtual ? 'Online' : _venueController.text.trim(),
        videoLink: _isVirtual ? _videoLinkController.text.trim() : null,
      );

      // Refresh meetings list
      ref.invalidate(chamaMeetingsProvider(widget.chamaId));

      if (mounted) {
        NotificationHelper.sendNotification(
          title: 'Meeting Scheduled!',
          message: 'A new meeting for your Chama has been scheduled successfully.',
          type: 'info',
        );

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Meeting scheduled successfully!')),
        );
        context.pop(); // Return to details
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
                'New Meeting',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Schedule a gathering for this Chama.',
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 32),

              // Title
              TextFormField(
                controller: _titleController,
                style: const TextStyle(color: Colors.white),
                decoration: _inputDecoration('Meeting Title', Icons.title),
                validator: (value) => value == null || value.isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 16),

              // Description
              TextFormField(
                controller: _descriptionController,
                style: const TextStyle(color: Colors.white),
                decoration: _inputDecoration('Agenda / Description', Icons.description),
                maxLines: 3,
              ),
              const SizedBox(height: 16),

              // Date & Time Row
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () => _selectDate(context),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFF2C2C2C),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.calendar_today, color: Color(0xFF00C853), size: 20),
                            const SizedBox(width: 8),
                            Text(
                              _selectedDate == null
                                  ? 'Select Date'
                                  : DateFormat('MMM d, y').format(_selectedDate!),
                              style: TextStyle(
                                color: _selectedDate == null ? Colors.grey : Colors.white,
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
                      onTap: () => _selectTime(context),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFF2C2C2C),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.access_time, color: Color(0xFF00C853), size: 20),
                            const SizedBox(width: 8),
                            Text(
                              _selectedTime == null
                                  ? 'Select Time'
                                  : _selectedTime!.format(context),
                              style: TextStyle(
                                color: _selectedTime == null ? Colors.grey : Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Virtual Toggle
              SwitchListTile(
                title: const Text('Virtual Meeting (Google Meet/Zoom)', style: TextStyle(color: Colors.white)),
                value: _isVirtual,
                activeColor: const Color(0xFF00C853),
                contentPadding: EdgeInsets.zero,
                onChanged: (val) => setState(() => _isVirtual = val),
              ),

              if (_isVirtual) ...[
                TextFormField(
                  controller: _videoLinkController,
                  style: const TextStyle(color: Colors.white),
                  decoration: _inputDecoration('Video Link URL', Icons.link),
                  validator: (value) {
                    if (_isVirtual && (value == null || value.isEmpty)) {
                      return 'Required for virtual meetings';
                    }
                    return null;
                  },
                ),
              ] else ...[
                TextFormField(
                  controller: _venueController,
                  style: const TextStyle(color: Colors.white),
                  decoration: _inputDecoration('Physical Venue', Icons.location_on),
                  validator: (value) {
                    if (!_isVirtual && (value == null || value.isEmpty)) {
                      return 'Required for physical meetings';
                    }
                    return null;
                  },
                ),
              ],
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
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Schedule Meeting',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
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
