// Form validators shared by the auth screens. Each returns an error message,
// or null when the value is valid.

final _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

String? validateEmail(String? value) {
  final email = value?.trim() ?? '';
  if (email.isEmpty) return 'Enter your email';
  if (!_emailPattern.hasMatch(email)) return 'Enter a valid email';
  return null;
}

String? validateNewPassword(String? value) {
  if ((value ?? '').length < 8) return 'Use at least 8 characters';
  return null;
}

String? Function(String?) requiredField(String field) =>
    (value) => (value?.trim() ?? '').isEmpty ? 'Enter your $field' : null;
