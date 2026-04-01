import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../utils/notification_helper.dart';

class KycFormScreen extends ConsumerStatefulWidget {
  const KycFormScreen({super.key});

  @override
  ConsumerState<KycFormScreen> createState() => _KycFormScreenState();
}

class _KycFormScreenState extends ConsumerState<KycFormScreen> {
  int _currentStep = 0;
  bool _isLoading = false;
  
  final List<String> _categories = [
    "Bodabodas", "House-helps", "Sales-people", "Grocery Owners", 
    "Waiters", "Health Workers", "Caretakers", "Drivers",
    "Fundis", "Conductors", "Others"
  ];
  
  final List<String> _selectedCategories = [];
  
  File? _idFront;
  File? _idBack;
  File? _selfie;

  final ImagePicker _picker = ImagePicker();

  final TextEditingController _firstNameController = TextEditingController();
  final TextEditingController _middleNameController = TextEditingController();
  final TextEditingController _lastNameController = TextEditingController();
  final TextEditingController _idNumberController = TextEditingController();
  final TextEditingController _kraPinController = TextEditingController();
  final TextEditingController _dobController = TextEditingController();
  final TextEditingController _countyController = TextEditingController();
  final TextEditingController _subCountyController = TextEditingController();
  final TextEditingController _wardController = TextEditingController();
  final TextEditingController _occupationController = TextEditingController();
  final TextEditingController _incomeSourceController = TextEditingController();
  final TextEditingController _bankNameController = TextEditingController();
  final TextEditingController _accountNumberController = TextEditingController();
  final TextEditingController _nextOfKinNameController = TextEditingController();
  final TextEditingController _nextOfKinPhoneController = TextEditingController();
  final TextEditingController _nextOfKinRelationController = TextEditingController();
  final TextEditingController _otherCategoryController = TextEditingController();

  String? _selectedGender;
  DateTime? _selectedDob;

  @override
  void dispose() {
    _firstNameController.dispose();
    _middleNameController.dispose();
    _lastNameController.dispose();
    _idNumberController.dispose();
    _kraPinController.dispose();
    _dobController.dispose();
    _countyController.dispose();
    _subCountyController.dispose();
    _wardController.dispose();
    _occupationController.dispose();
    _incomeSourceController.dispose();
    _bankNameController.dispose();
    _accountNumberController.dispose();
    _nextOfKinNameController.dispose();
    _nextOfKinPhoneController.dispose();
    _nextOfKinRelationController.dispose();
    _otherCategoryController.dispose();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source, String type) async {
    final XFile? image = await _picker.pickImage(source: source);
    if (image != null) {
      setState(() {
        if (type == 'front') _idFront = File(image.path);
        if (type == 'back') _idBack = File(image.path);
        if (type == 'selfie') _selfie = File(image.path);
      });
    }
  }

  Future<String?> _uploadFile(File file, String path) async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return null;

    final fileName = '${user.id}/${path}_${DateTime.now().millisecondsSinceEpoch}.jpg';
    
    await Supabase.instance.client.storage
        .from('kyc-documents')
        .upload(fileName, file);

    final String publicUrl = Supabase.instance.client.storage
        .from('kyc-documents')
        .getPublicUrl(fileName);

    return publicUrl;
  }

  Future<void> _submitKyc() async {
    if (_idFront == null || _idBack == null || _selfie == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please upload all required documents')),
      );
      return;
    }

    setState(() => _isLoading = true);
    
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      final urls = await Future.wait([
        _uploadFile(_idFront!, 'id_front'),
        _uploadFile(_idBack!, 'id_back'),
        _uploadFile(_selfie!, 'selfie'),
      ]);

      final dobValue = _selectedDob != null
          ? DateFormat('yyyy-MM-dd').format(_selectedDob!)
          : _dobController.text.trim();

      await Supabase.instance.client.from('users').update({
        'kyc_status': 'pending',
        'id_front_url': urls[0],
        'id_back_url': urls[1],
        'selfie_url': urls[2],
        'member_category': _selectedCategories,
        'first_name': _firstNameController.text,
        'middle_name': _middleNameController.text,
        'last_name': _lastNameController.text,
        'id_number': _idNumberController.text,
        'kra_pin': _kraPinController.text,
        'dob': dobValue,
        'gender': _selectedGender,
        'county': _countyController.text,
        'sub_county': _subCountyController.text,
        'ward': _wardController.text,
        'occupation': _occupationController.text,
        'income_source': _incomeSourceController.text,
        'bank_name': _bankNameController.text,
        'account_number': _accountNumberController.text,
        'next_of_kin_name': _nextOfKinNameController.text,
        'next_of_kin_phone': _nextOfKinPhoneController.text,
        'next_of_kin_relation': _nextOfKinRelationController.text,
        'category_other_specification': _selectedCategories.contains('Others') ? _otherCategoryController.text : null,
      }).eq('id', user.id);

      // Send Onboarding/KYC Success Email
      if (user.email != null) {
        NotificationHelper.sendEmail(
          to: user.email!,
          subject: 'Onboarding Documents Received ðŸ“‹',
          html: '''
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
              <h2 style="color: #00C853;">Onboarding Update</h2>
              <p>Hi ${_firstNameController.text},</p>
              <p>We've successfully received your KYC verification documents. Our team is now reviewing them.</p>
              <p><b>Status:</b> Pending Review</p>
              <p>This process usually takes 24-48 hours. We'll notify you as soon as your account is fully verified.</p>
              <p>Thank you for your patience!</p>
              <br>
              <p>Best regards,<br>The Ratibu Team</p>
            </div>
          ''',
        );
      }

      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('pending_onboarding', false);
      await prefs.setBool('onboarding_complete', true);

      // Refresh auth state so router sees kycStatus = 'pending'
      await ref.read(authProvider.notifier).refreshUser();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('KYC submitted! Our team will review your documents.')),
      );
      context.go('/dashboard');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _pickDob() async {
    final now = DateTime.now();
    final initial = _selectedDob ?? DateTime(now.year - 18, now.month, now.day);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1900, 1, 1),
      lastDate: now,
    );
    if (picked != null) {
      setState(() {
        _selectedDob = picked;
        _dobController.text = DateFormat('yyyy-MM-dd').format(picked);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                    onPressed: () => context.pop(),
                  ),
                  const Text(
                    'Member Verification',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      fontSize: 22,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Stepper(
                type: StepperType.vertical,
        currentStep: _currentStep,
        onStepContinue: () {
          if (_currentStep == 0) {
            if (_selectedCategories.isEmpty) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Please select at least one category')),
              );
              return;
            }
            if (_selectedCategories.contains('Others') && _otherCategoryController.text.isEmpty) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Please specify your category')),
              );
              return;
            }
            setState(() => _currentStep += 1);
          } else if (_currentStep == 1) {
            if (_firstNameController.text.isEmpty ||
                _lastNameController.text.isEmpty ||
                _idNumberController.text.isEmpty || 
                _kraPinController.text.isEmpty || 
                _nextOfKinNameController.text.isEmpty || 
                _nextOfKinPhoneController.text.isEmpty || 
                _nextOfKinRelationController.text.isEmpty) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Please fill all personal details')),
              );
              return;
            }
            setState(() => _currentStep += 1);
          } else if (_currentStep == 2) {
            if (_dobController.text.isEmpty || _countyController.text.isEmpty || _occupationController.text.isEmpty) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Please fill all required details')),
              );
              return;
            }
            final parsedDob = DateTime.tryParse(_dobController.text.trim());
            if (parsedDob == null) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Please select a valid date of birth')),
              );
              return;
            }
            _selectedDob = parsedDob;
            setState(() => _currentStep += 1);
          } else if (_currentStep == 3) {
             // Bank details are optional, just continue
             setState(() => _currentStep += 1);
          } else {
            _submitKyc();
          }
        },
        onStepCancel: () {
          if (_currentStep > 0) {
            setState(() => _currentStep -= 1);
          }
        },
        controlsBuilder: (context, details) {
          return Padding(
            padding: const EdgeInsets.only(top: 32.0),
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : details.onStepContinue,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF00C853),
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 56),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: _isLoading 
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(_currentStep == 0 ? 'CONTINUE' : 'SUBMIT FOR REVIEW', 
                          style: const TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
                if (_currentStep > 0) ...[
                  const SizedBox(width: 16),
                  TextButton(
                    onPressed: details.onStepCancel,
                    child: const Text('BACK', style: TextStyle(color: Colors.white70)),
                  ),
                ],
              ],
            ),
          );
        },
        steps: [
          Step(
            isActive: _currentStep >= 0,
            title: const Text('Category', style: TextStyle(color: Colors.white)),
            content: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Select your member category',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Colors.white),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Pick the categories that best describe your role.',
                  style: TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 24),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: _categories.map((cat) {
                    final isSelected = _selectedCategories.contains(cat);
                    return ChoiceChip(
                      label: Text(cat),
                      selected: isSelected,
                      onSelected: (selected) {
                        setState(() {
                          if (selected) {
                            _selectedCategories.add(cat);
                          } else {
                            _selectedCategories.remove(cat);
                          }
                        });
                      },
                      selectedColor: const Color(0xFF00C853).withValues(alpha: 0.2),
                      backgroundColor: Colors.white.withValues(alpha: 0.05),
                      labelStyle: TextStyle(
                        color: isSelected ? const Color(0xFF00C853) : Colors.white70,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(
                          color: isSelected ? const Color(0xFF00C853) : Colors.white10,
                        ),
                      ),
                    );
                  }).toList(),
                ),
                if (_selectedCategories.contains('Others')) ...[
                  const SizedBox(height: 24),
                  const Text('Specify Category', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _otherCategoryController,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: 'e.g. Architect, Consultant',
                      hintStyle: const TextStyle(color: Colors.white24),
                      filled: true,
                      fillColor: Colors.white.withValues(alpha: 0.05),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                    ),
                  ),
                ],
              ],
            ),
          ),
          Step(
            isActive: _currentStep >= 1,
            title: const Text('Personal', style: TextStyle(color: Colors.white)),
            content: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Personal Details',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Provide your ID and Next of Kin info.',
                  style: TextStyle(color: Colors.white54),
                ),
                const SizedBox(height: 24),
                _buildTextField(label: 'First Name', controller: _firstNameController, icon: Icons.person),
                const SizedBox(height: 16),
                _buildTextField(label: 'Middle Name', controller: _middleNameController, icon: Icons.person_outline),
                const SizedBox(height: 16),
                _buildTextField(label: 'Last Name', controller: _lastNameController, icon: Icons.person),
                const SizedBox(height: 16),
                _buildTextField(label: 'ID Number', controller: _idNumberController, icon: Icons.credit_card),
                const SizedBox(height: 16),
                _buildTextField(label: 'KRA PIN', controller: _kraPinController, icon: Icons.tag),
                const SizedBox(height: 24),
                const Text('Next of Kin', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 16),
                _buildTextField(label: 'Full Name', controller: _nextOfKinNameController, icon: Icons.person_outline),
                const SizedBox(height: 16),
                _buildTextField(label: 'Phone Number', controller: _nextOfKinPhoneController, icon: Icons.phone_outlined, keyboardType: TextInputType.phone),
                const SizedBox(height: 16),
                _buildTextField(label: 'Relation', controller: _nextOfKinRelationController, icon: Icons.people_outline),
              ],
            ),
          ),
          Step(
            isActive: _currentStep >= 2,
            title: const Text('Address', style: TextStyle(color: Colors.white)),
            content: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Address & Occupation',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 8),
                const Text('Tell us where you stay and what you do.', style: TextStyle(color: Colors.white54)),
                const SizedBox(height: 24),
                _buildTextField(
                  label: 'Date of Birth',
                  controller: _dobController,
                  icon: Icons.calendar_today_outlined,
                  keyboardType: TextInputType.none,
                  readOnly: true,
                  onTap: _pickDob,
                  hintText: 'YYYY-MM-DD',
                ),
                const SizedBox(height: 16),
                const Text('Gender', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Row(
                  children: ['Male', 'Female', 'Other'].map((g) => Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4.0),
                      child: ChoiceChip(
                        label: Text(g),
                        selected: _selectedGender == g,
                        onSelected: (val) => setState(() => _selectedGender = g),
                        selectedColor: const Color(0xFF00C853).withValues(alpha: 0.2),
                        backgroundColor: Colors.white.withValues(alpha: 0.05),
                        labelStyle: TextStyle(color: _selectedGender == g ? const Color(0xFF00C853) : Colors.white70),
                      ),
                    ),
                  )).toList(),
                ),
                const SizedBox(height: 16),
                _buildTextField(label: 'County', controller: _countyController, icon: Icons.location_on_outlined),
                const SizedBox(height: 16),
                _buildTextField(label: 'Sub-County', controller: _subCountyController, icon: Icons.location_city_outlined),
                const SizedBox(height: 16),
                _buildTextField(label: 'Ward', controller: _wardController, icon: Icons.map_outlined),
                const SizedBox(height: 16),
                _buildTextField(label: 'Occupation', controller: _occupationController, icon: Icons.work_outline),
                const SizedBox(height: 16),
                _buildTextField(label: 'Source of Income', controller: _incomeSourceController, icon: Icons.monetization_on_outlined),
              ],
            ),
          ),
          Step(
            isActive: _currentStep >= 3,
            title: const Text('Bank', style: TextStyle(color: Colors.white)),
            content: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Bank Details',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 8),
                const Text('Optional, but helps with withdrawals.', style: TextStyle(color: Colors.white54)),
                const SizedBox(height: 24),
                _buildTextField(label: 'Bank Name', controller: _bankNameController, icon: Icons.account_balance_outlined),
                const SizedBox(height: 16),
                _buildTextField(label: 'Account Number', controller: _accountNumberController, icon: Icons.numbers_outlined, keyboardType: TextInputType.number),
              ],
            ),
          ),
          Step(
            isActive: _currentStep >= 4,
            title: const Text('ID Docs', style: TextStyle(color: Colors.white)),
            content: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Upload Identity Documents',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Take clear photos of your ID and a selfie.',
                  style: TextStyle(color: Colors.white54),
                ),
                const SizedBox(height: 24),
                _buildUploadField(
                  label: 'ID FRONT IMAGE',
                  file: _idFront,
                  onTap: () => _showPicker(context, 'front'),
                ),
                const SizedBox(height: 16),
                _buildUploadField(
                  label: 'ID BACK IMAGE',
                  file: _idBack,
                  onTap: () => _showPicker(context, 'back'),
                ),
                const SizedBox(height: 16),
                _buildUploadField(
                  label: 'SELFIE PHOTO',
                  file: _selfie,
                  onTap: () => _showPicker(context, 'selfie'),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  ],
),
),
);
  }

  Widget _buildUploadField({required String label, File? file, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        height: 120,
        width: double.infinity,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: file != null ? const Color(0xFF00C853) : Colors.white10,
            style: BorderStyle.solid,
          ),
        ),
        child: file != null
          ? ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: Stack(
                fit: StackFit.expand,
                children: [
                   Image.file(file, fit: BoxFit.cover),
                   Container(color: Colors.black26),
                   const Center(child: Icon(Icons.check_circle, color: Color(0xFF00C853), size: 40)),
                ],
              ),
            )
          : Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.add_a_photo_outlined, color: Colors.white.withValues(alpha: 0.3), size: 32),
                const SizedBox(height: 8),
                Text(label, style: const TextStyle(color: Colors.white54, fontWeight: FontWeight.bold, fontSize: 12)),
              ],
            ),
      ),
    );
  }

  Widget _buildTextField({
    required String label, 
    required TextEditingController controller, 
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    bool readOnly = false,
    VoidCallback? onTap,
    String? hintText,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          readOnly: readOnly,
          onTap: onTap,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, color: const Color(0xFF00C853), size: 20),
            hintText: hintText,
            hintStyle: const TextStyle(color: Colors.white24),
            filled: true,
            fillColor: Colors.white.withValues(alpha: 0.05),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          ),
        ),
      ],
    );
  }

  void _showPicker(BuildContext context, String type) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1e293b),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library, color: Colors.white70),
              title: const Text('Gallery', style: TextStyle(color: Colors.white)),
              onTap: () {
                _pickImage(ImageSource.gallery, type);
                Navigator.pop(context);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera, color: Colors.white70),
              title: const Text('Camera', style: TextStyle(color: Colors.white)),
              onTap: () {
                _pickImage(ImageSource.camera, type);
                Navigator.pop(context);
              },
            ),
          ],
        ),
      ),
    );
  }
}

