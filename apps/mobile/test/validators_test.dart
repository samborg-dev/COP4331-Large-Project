import 'package:cop4331_mobile/utils/validators.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('validateEmail', () {
    test('rejects empty input', () {
      expect(validateEmail(''), 'Enter your email');
      expect(validateEmail(null), 'Enter your email');
      expect(validateEmail('   '), 'Enter your email');
    });

    test('rejects malformed emails', () {
      expect(validateEmail('arwa'), 'Enter a valid email');
      expect(validateEmail('arwa@ucf'), 'Enter a valid email');
      expect(validateEmail('ar wa@ucf.edu'), 'Enter a valid email');
    });

    test('accepts valid emails, ignoring surrounding spaces', () {
      expect(validateEmail('arwa@ucf.edu'), isNull);
      expect(validateEmail('  first.last+tag@knights.ucf.edu '), isNull);
    });
  });

  group('validateNewPassword', () {
    test('requires at least 8 characters', () {
      expect(validateNewPassword(null), 'Use at least 8 characters');
      expect(validateNewPassword('1234567'), 'Use at least 8 characters');
      expect(validateNewPassword('12345678'), isNull);
    });
  });

  group('requiredField', () {
    test('names the field in its message', () {
      final validate = requiredField('first name');
      expect(validate(''), 'Enter your first name');
      expect(validate('  '), 'Enter your first name');
      expect(validate('Arwa'), isNull);
    });
  });
}
