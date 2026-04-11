String? normalizeKenyanPhone(String? value) {
  if (value == null) return null;

  var cleaned = value.trim().replaceAll(RegExp(r'[\s\-\(\)]'), '');
  if (cleaned.isEmpty) return null;

  cleaned = cleaned.replaceFirst(RegExp(r'^(tel:|whatsapp:)', caseSensitive: false), '');
  cleaned = cleaned.replaceAll(RegExp(r'[^\d+]'), '');

  if (RegExp(r'^\+254\d{9}$').hasMatch(cleaned)) {
    return '254${cleaned.substring(cleaned.length - 9)}';
  }

  if (RegExp(r'^254\d{9}$').hasMatch(cleaned)) {
    return cleaned;
  }

  if (RegExp(r'^0\d{9}$').hasMatch(cleaned)) {
    return '254${cleaned.substring(1)}';
  }

  if (RegExp(r'^\d{9}$').hasMatch(cleaned)) {
    return '254$cleaned';
  }

  return cleaned;
}

List<String> kenyanPhoneVariants(String? value) {
  final raw = value?.trim().replaceAll(RegExp(r'[\s\-\(\)]'), '') ?? '';
  final normalized = normalizeKenyanPhone(value);
  final variants = <String>{if (raw.isNotEmpty) raw};

  if (normalized != null && normalized.isNotEmpty) {
    variants.add(normalized);
    variants.add('+$normalized');
    variants.add('0${normalized.substring(3)}');
  }

  if (raw.startsWith('+')) {
    variants.add(raw.substring(1));
  }

  return variants.toList();
}
