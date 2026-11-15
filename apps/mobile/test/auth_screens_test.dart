import 'package:cop4331_mobile/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// These tests only exercise client-side validation and navigation, so they
// never hit the network.
void main() {
  testWidgets('login shows validation errors when submitted empty', (tester) async {
    await tester.pumpWidget(const App());

    await tester.tap(find.widgetWithText(FilledButton, 'Log In'));
    await tester.pump();

    expect(find.text('Enter your email'), findsOneWidget);
    expect(find.text('Enter your password'), findsOneWidget);
  });

  testWidgets('"Sign up" opens the register screen and "Log in" returns', (tester) async {
    await tester.pumpWidget(const App());

    await tester.tap(find.widgetWithText(TextButton, 'Sign up'));
    await tester.pumpAndSettle();
    expect(find.text('Create account'), findsOneWidget);

    await tester.ensureVisible(find.widgetWithText(TextButton, 'Log in'));
    await tester.tap(find.widgetWithText(TextButton, 'Log in'));
    await tester.pumpAndSettle();
    expect(find.text('Welcome back'), findsOneWidget);
  });

  testWidgets('register validates every field before calling the API', (tester) async {
    await tester.pumpWidget(const App());
    await tester.tap(find.widgetWithText(TextButton, 'Sign up'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('register-email')), 'not-an-email');
    await tester.enterText(find.byKey(const Key('register-password')), 'short');
    await tester.enterText(find.byKey(const Key('register-confirm')), 'different');
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Sign Up'));
    await tester.tap(find.widgetWithText(FilledButton, 'Sign Up'));
    await tester.pump();

    expect(find.text('Enter your first name'), findsOneWidget);
    expect(find.text('Enter your last name'), findsOneWidget);
    expect(find.text('Enter a valid email'), findsOneWidget);
    expect(find.text('Use at least 8 characters'), findsOneWidget);
    expect(find.text('Passwords do not match'), findsOneWidget);
  });

  testWidgets('"Forgot password?" opens the reset request screen', (tester) async {
    await tester.pumpWidget(const App());

    await tester.tap(find.widgetWithText(TextButton, 'Forgot password?'));
    await tester.pumpAndSettle();

    expect(find.text('Forgot password?'), findsOneWidget); // the title
    expect(find.widgetWithText(FilledButton, 'Send Reset Link'), findsOneWidget);
  });

  testWidgets('password visibility toggle works', (tester) async {
    await tester.pumpWidget(const App());

    TextField passwordField() => tester.widget<TextField>(
          find.descendant(
            of: find.byKey(const Key('login-password')),
            matching: find.byType(TextField),
          ),
        );

    expect(passwordField().obscureText, isTrue);
    await tester.tap(find.byTooltip('Show password'));
    await tester.pump();
    expect(passwordField().obscureText, isFalse);
  });
}
