import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/update_service.dart';

class UpdatesScreen extends StatefulWidget {
  const UpdatesScreen({super.key});

  @override
  State<UpdatesScreen> createState() => _UpdatesScreenState();
}

class _UpdatesScreenState extends State<UpdatesScreen> {
  PackageInfo? _packageInfo;
  AppUpdate? _availableUpdate;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _initAndCheck();
  }

  Future<void> _initAndCheck() async {
    final info = await PackageInfo.fromPlatform();
    final update = await UpdateService.checkForUpdate();
    if (mounted) {
      setState(() {
        _packageInfo = info;
        _availableUpdate = update;
        _isLoading = false;
      });
    }
  }

  Future<void> _launchUpdate() async {
    if (_availableUpdate == null) return;
    final url = Uri.parse(_availableUpdate!.downloadUrl);
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('App Updates'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildVersionCard(),
                  const SizedBox(height: 32),
                  if (_availableUpdate != null)
                    _buildUpdateSection()
                  else
                    _buildUpToDateSection(),
                ],
              ),
            ),
    );
  }

  Widget _buildVersionCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF00C853).withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.info_outline, color: Color(0xFF00C853)),
          ),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Current Version',
                style: TextStyle(color: Colors.grey, fontSize: 13),
              ),
              Text(
                '${_packageInfo?.version ?? "..."} (${_packageInfo?.buildNumber ?? "..."})',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildUpdateSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.system_update_alt, color: Color(0xFF00C853)),
            const SizedBox(width: 12),
            const Text(
              'New Update Available!',
              style: TextStyle(
                color: Color(0xFF00C853),
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Text(
          'Version ${_availableUpdate!.version} is now available.',
          style: const TextStyle(color: Colors.white, fontSize: 16),
        ),
        const SizedBox(height: 8),
        if (_availableUpdate!.releaseNotes.isNotEmpty) ...[
          const Text(
            'Release Notes:',
            style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            _availableUpdate!.releaseNotes,
            style: const TextStyle(color: Colors.grey),
          ),
        ],
        const SizedBox(height: 32),
        SizedBox(
          width: double.infinity,
          height: 56,
          child: ElevatedButton(
            onPressed: _launchUpdate,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF00C853),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            child: const Text(
              'Download and Install',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildUpToDateSection() {
    return Center(
      child: Column(
        children: [
          Icon(Icons.check_circle_outline, size: 64, color: Colors.grey[700]),
          const SizedBox(height: 16),
          const Text(
            'You are using the latest version',
            style: TextStyle(color: Colors.grey, fontSize: 16),
          ),
          const SizedBox(height: 32),
          TextButton(
            onPressed: () {
              setState(() => _isLoading = true);
              _initAndCheck();
            },
            child: const Text('Check for Updates'),
          ),
        ],
      ),
    );
  }
}
