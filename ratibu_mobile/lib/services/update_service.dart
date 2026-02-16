import 'package:package_info_plus/package_info_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AppUpdate {
  final String version;
  final int buildNumber;
  final String releaseNotes;
  final String downloadUrl;
  final bool isMandatory;

  AppUpdate({
    required this.version,
    required this.buildNumber,
    required this.releaseNotes,
    required this.downloadUrl,
    required this.isMandatory,
  });

  factory AppUpdate.fromMap(Map<String, dynamic> map) {
    return AppUpdate(
      version: map['version'],
      buildNumber: map['build_number'],
      releaseNotes: map['release_notes'] ?? '',
      downloadUrl: map['download_url'],
      isMandatory: map['is_mandatory'] ?? false,
    );
  }
}

class UpdateService {
  static final _supabase = Supabase.instance.client;

  static Future<AppUpdate?> checkForUpdate() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final currentBuildNumber = int.parse(packageInfo.buildNumber);

      final response = await _supabase
          .from('app_updates')
          .select()
          .eq('platform', 'android')
          .order('build_number', ascending: false)
          .limit(1)
          .maybeSingle();

      if (response != null) {
        final update = AppUpdate.fromMap(response);
        if (update.buildNumber > currentBuildNumber) {
          return update;
        }
      }
    } catch (e) {
      print('Error checking for updates: $e');
    }
    return null;
  }
}
