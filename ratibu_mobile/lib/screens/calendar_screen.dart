import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../utils/jitsi_meeting_helper.dart';

class CalendarScreen extends StatefulWidget {
  final String? chamaId;

  const CalendarScreen({super.key, this.chamaId});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  bool _loading = true;
  DateTime _focusedMonth = DateTime.now();
  DateTime? _selectedDay;
  List<Map<String, dynamic>> _meetings = [];

  Future<T> _retry<T>(Future<T> Function() action) async {
    Object? lastError;
    for (var i = 0; i < 3; i++) {
      try {
        return await action();
      } catch (e) {
        lastError = e;
        if (i == 2) rethrow;
        await Future<void>.delayed(Duration(milliseconds: 300 * (i + 1)));
      }
    }
    throw lastError ?? Exception('Request failed');
  }

  @override
  void initState() {
    super.initState();
    _selectedDay = DateTime(_focusedMonth.year, _focusedMonth.month, DateTime.now().day);
    _loadMeetings();
  }

  Future<void> _loadMeetings() async {
    setState(() => _loading = true);
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) {
        if (mounted) {
          setState(() {
            _meetings = [];
            _loading = false;
          });
        }
        return;
      }

      final meetings = widget.chamaId != null && widget.chamaId!.isNotEmpty
          ? await _retry(() => Supabase.instance.client
              .from('meetings')
              .select('id, title, description, date, venue, video_link, chama_id, chamas(name)')
              .eq('chama_id', widget.chamaId!)
              .order('date', ascending: true))
          : await _retry(() async {
              final membership = await Supabase.instance.client
                  .from('chama_members')
                  .select('chama_id')
                  .eq('user_id', user.id)
                  .eq('status', 'active');

              final chamaIds = (membership as List)
                  .map((m) => m['chama_id'] as String)
                  .toList();

              if (chamaIds.isEmpty) {
                return <Map<String, dynamic>>[];
              }

              final rows = await Supabase.instance.client
                  .from('meetings')
                  .select('id, title, description, date, venue, video_link, chama_id, chamas(name)')
                  .inFilter('chama_id', chamaIds)
                  .order('date', ascending: true);
              return rows;
            });

      if (mounted) {
        setState(() {
          _meetings = List<Map<String, dynamic>>.from(meetings);
          _loading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading calendar meetings: $e');
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  List<Map<String, dynamic>> get _monthMeetings {
    return _meetings.where((meeting) {
      final date = DateTime.tryParse(meeting['date']?.toString() ?? '')?.toLocal();
      if (date == null) return false;
      return date.year == _focusedMonth.year && date.month == _focusedMonth.month;
    }).toList();
  }

  List<Map<String, dynamic>> get _selectedDayMeetings {
    final selected = _selectedDay;
    if (selected == null) return _monthMeetings;
    return _monthMeetings.where((meeting) {
      final date = DateTime.tryParse(meeting['date']?.toString() ?? '')?.toLocal();
      return date != null && DateUtils.isSameDay(date, selected);
    }).toList();
  }

  int _daysInMonth(DateTime month) {
    final nextMonth = DateTime(month.year, month.month + 1, 1);
    return nextMonth.subtract(const Duration(days: 1)).day;
  }

  int _leadingEmptyDays(DateTime month) {
    final firstDay = DateTime(month.year, month.month, 1);
    return (firstDay.weekday % 7);
  }

  Map<DateTime, int> _meetingCountsForMonth() {
    final counts = <DateTime, int>{};
    for (final meeting in _monthMeetings) {
      final rawDate = DateTime.tryParse(meeting['date']?.toString() ?? '')?.toLocal();
      if (rawDate == null) continue;
      final key = DateTime(rawDate.year, rawDate.month, rawDate.day);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }

  Future<void> _joinMeeting(Map<String, dynamic> meeting) async {
    final link = meeting['video_link']?.toString() ?? '';
    if (link.isEmpty) return;

    final uri = Uri.tryParse(link);
    final roomName = uri?.pathSegments.isNotEmpty == true ? uri!.pathSegments.last : link;
    final user = Supabase.instance.client.auth.currentUser;

    await joinRatibuMeeting(
      context: context,
      roomName: roomName,
      title: meeting['title']?.toString() ?? 'Meeting',
      displayName: user?.email,
      email: user?.email,
    );
  }

  void _changeMonth(int delta) {
    setState(() {
      _focusedMonth = DateTime(_focusedMonth.year, _focusedMonth.month + delta, 1);
      _selectedDay = DateTime(_focusedMonth.year, _focusedMonth.month, 1);
    });
  }

  @override
  Widget build(BuildContext context) {
    final monthLabel = DateFormat('MMMM yyyy').format(_focusedMonth);
    final counts = _meetingCountsForMonth();
    final daysInMonth = _daysInMonth(_focusedMonth);
    final leadingEmpty = _leadingEmptyDays(_focusedMonth);
    final selectedMeetings = _selectedDayMeetings;

    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        title: const Text('Calendar'),
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: _loadMeetings,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C853)))
          : RefreshIndicator(
              onRefresh: _loadMeetings,
              color: const Color(0xFF00C853),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Container(
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
                            IconButton(
                              onPressed: () => _changeMonth(-1),
                              icon: const Icon(Icons.chevron_left, color: Colors.white),
                            ),
                            Text(
                              monthLabel,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            IconButton(
                              onPressed: () => _changeMonth(1),
                              icon: const Icon(Icons.chevron_right, color: Colors.white),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: 7,
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 7,
                            mainAxisSpacing: 8,
                            crossAxisSpacing: 8,
                          ),
                          itemBuilder: (context, index) {
                            const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
                            return Center(
                              child: Text(
                                labels[index],
                                style: const TextStyle(
                                  color: Colors.white54,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 8),
                        GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: leadingEmpty + daysInMonth,
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 7,
                            mainAxisSpacing: 8,
                            crossAxisSpacing: 8,
                          ),
                          itemBuilder: (context, index) {
                            if (index < leadingEmpty) {
                              return const SizedBox.shrink();
                            }

                            final day = index - leadingEmpty + 1;
                            final date = DateTime(_focusedMonth.year, _focusedMonth.month, day);
                            final isSelected = _selectedDay != null && DateUtils.isSameDay(date, _selectedDay);
                            final meetingCount = counts[date] ?? 0;

                            return InkWell(
                              onTap: () => setState(() => _selectedDay = date),
                              borderRadius: BorderRadius.circular(14),
                              child: Container(
                                decoration: BoxDecoration(
                                  color: isSelected ? const Color(0xFF00C853) : const Color(0xFF0f172a),
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                    color: meetingCount > 0 ? const Color(0xFF00C853) : Colors.white10,
                                  ),
                                ),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      '$day',
                                      style: TextStyle(
                                        color: isSelected ? Colors.white : Colors.white,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    if (meetingCount > 0) ...[
                                      const SizedBox(height: 4),
                                      Container(
                                        width: 6,
                                        height: 6,
                                        decoration: const BoxDecoration(
                                          color: Color(0xFF00C853),
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    DateFormat('EEE, d MMM').format(_selectedDay ?? _focusedMonth),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (selectedMeetings.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1e293b),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white10),
                      ),
                      child: const Text(
                        'No meetings scheduled for this day.',
                        style: TextStyle(color: Colors.white54),
                      ),
                    )
                  else
                    ...selectedMeetings.map((meeting) {
                      final date = DateTime.tryParse(meeting['date']?.toString() ?? '')?.toLocal();
                      final isPast = date != null && date.isBefore(DateTime.now());
                      final isVirtual = (meeting['video_link'] ?? '').toString().isNotEmpty;
                      final chamaName = (meeting['chamas'] as Map<String, dynamic>?)?['name'] ?? 'Chama';

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
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
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        meeting['title']?.toString() ?? 'Meeting',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        chamaName.toString(),
                                        style: const TextStyle(color: Color(0xFF00C853)),
                                      ),
                                    ],
                                  ),
                                ),
                                if (date != null)
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        DateFormat('MMM d').format(date),
                                        style: const TextStyle(color: Colors.white),
                                      ),
                                      Text(
                                        DateFormat('h:mm a').format(date),
                                        style: const TextStyle(color: Colors.white54),
                                      ),
                                    ],
                                  ),
                              ],
                            ),
                            if ((meeting['description'] ?? '').toString().isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Text(
                                meeting['description'].toString(),
                                style: const TextStyle(color: Colors.white70),
                              ),
                            ],
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Icon(
                                  isVirtual ? Icons.videocam : Icons.place,
                                  size: 16,
                                  color: Colors.white54,
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    isVirtual ? 'Virtual Meeting' : (meeting['venue'] ?? 'TBD').toString(),
                                    style: const TextStyle(color: Colors.white54),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                if (isVirtual && !isPast)
                                  ElevatedButton.icon(
                                    onPressed: () => _joinMeeting(meeting),
                                    icon: const Icon(Icons.videocam, size: 14),
                                    label: const Text('Join'),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF00C853),
                                      foregroundColor: Colors.white,
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }
}
