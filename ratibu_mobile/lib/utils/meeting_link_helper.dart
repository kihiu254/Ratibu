import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

String normalizeMeetingLink(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return trimmed;

  try {
    final uri = Uri.parse(trimmed);
    if (uri.scheme.isEmpty) {
      return 'https://$trimmed';
    }
    return trimmed;
  } catch (_) {
    return trimmed;
  }
}

Future<void> openMeetingLink(
  BuildContext context,
  String link, {
  String? fallbackMessage,
}) async {
  final normalized = normalizeMeetingLink(link);
  if (normalized.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(fallbackMessage ?? 'Missing meeting link')),
    );
    return;
  }

  final uri = Uri.tryParse(normalized);
  if (uri == null) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(fallbackMessage ?? 'Invalid meeting link')),
    );
    return;
  }

  final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!opened && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(fallbackMessage ?? 'Failed to open meeting link')),
    );
  }
}
