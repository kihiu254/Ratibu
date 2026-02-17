import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/material.dart';
import '../widgets/ratibu_toast.dart';

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

      // 2. Show Local OS Notification (Alert Banner) - Keep this for background/system level
      const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
        'ratibu_alerts_v5', 
        'Ratibu Alerts & Pop-ups',
        channelDescription: 'Main notification channel for all alerts',
        importance: Importance.max,
        priority: Priority.high,
        showWhen: true,
        fullScreenIntent: true,
        category: AndroidNotificationCategory.status,
      );
      const NotificationDetails platformDetails = NotificationDetails(
        android: androidDetails,
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      );
      
      await _localNotifications.show(
        DateTime.now().millisecond, // Unique ID
        title,
        message,
        platformDetails,
        payload: 'notifications',
      );
    } catch (e) {
      print('Error sending notification: $e');
    }
  }

  // New method for in-app toasts
  static void showToast(BuildContext context, {required String title, required String message, String type = 'success'}) {
    RatibuToast.show(context, title: title, message: message, type: type);
  }
}
