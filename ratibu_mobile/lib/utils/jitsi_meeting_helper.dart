import 'package:flutter/material.dart';
import 'package:jitsi_meet_flutter_sdk/jitsi_meet_flutter_sdk.dart';

final JitsiMeet _jitsiMeet = JitsiMeet();

String _fallbackDisplayName(String? value) {
  final trimmed = value?.trim() ?? '';
  return trimmed.isEmpty ? 'Member' : trimmed;
}

String _fallbackEmail(String? value) {
  final trimmed = value?.trim() ?? '';
  return trimmed;
}

Future<void> joinRatibuMeeting({
  required BuildContext context,
  required String roomName,
  required String title,
  String? displayName,
  String? email,
}) async {
  final normalizedRoom = roomName.trim();
  if (normalizedRoom.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Missing meeting room name')),
    );
    return;
  }

  try {
    final options = JitsiMeetConferenceOptions(
      serverURL: 'https://meet.jit.si',
      room: normalizedRoom,
      configOverrides: {
        'startWithAudioMuted': false,
        'startWithVideoMuted': false,
        'subject': title,
      },
      featureFlags: {
        FeatureFlags.welcomePageEnabled: false,
        FeatureFlags.preJoinPageEnabled: false,
        FeatureFlags.preJoinPageHideDisplayName: true,
        FeatureFlags.unsafeRoomWarningEnabled: false,
      },
      userInfo: JitsiMeetUserInfo(
        displayName: _fallbackDisplayName(displayName),
        email: _fallbackEmail(email),
      ),
    );

    await _jitsiMeet.join(options);
  } catch (error) {
    if (!context.mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Failed to open meeting: $error')),
    );
  }
}
