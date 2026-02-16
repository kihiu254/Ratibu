import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationHelper {
  static final _supabase = Supabase.instance.client;
  static final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();

  static Future<void> sendNotification({
    required String title,
    required String message,
    String type = 'info',
    String? userId,
  }) async {
    try {
      final targetUserId = userId ?? _supabase.auth.currentUser?.id;
      if (targetUserId == null) return;

      // 1. Save to Supabase (Mobile App Inbox)
      await _supabase.from('notifications').insert({
        'user_id': targetUserId,
        'title': title,
        'message': message,
        'type': type,
        'is_read': false,
        'created_at': DateTime.now().toIso8601String(),
      });

      // 2. Show Local OS Notification (Alert Banner)
      const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
        'ratibu_alerts',
        'Ratibu Alerts',
        channelDescription: 'Notifications for Ratibu actions',
        importance: Importance.max,
        priority: Priority.high,
        ticker: 'ticker',
      );
      const NotificationDetails platformDetails = NotificationDetails(android: androidDetails);
      
      await _localNotifications.show(
        DateTime.now().millisecond, // Unique ID
        title,
        message,
        platformDetails,
      );
    } catch (e) {
      // Silent error for notifications to avoid blocking UI
      print('Error sending notification: $e');
    }
  }
}
