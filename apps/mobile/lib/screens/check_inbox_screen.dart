import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../widgets/auth_scaffold.dart';

/// Shown after sign-up, or when an unverified account tries to log in.
/// The verification link in the email opens the web app; the user then
/// comes back here and logs in. Expects the email as the route argument.
class CheckInboxScreen extends StatefulWidget {
  const CheckInboxScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<CheckInboxScreen> createState() => _CheckInboxScreenState();
}

class _CheckInboxScreenState extends State<CheckInboxScreen> {
  bool _loading = false;

  Future<void> _resend(String email) async {
    setState(() => _loading = true);
    String message;
    try {
      await widget.api.resendVerification(email);
      message = 'Verification email sent again.';
    } on ApiException catch (e) {
      message = e.message;
    } catch (_) {
      message = 'Could not reach the server. Check your connection.';
    }
    if (!mounted) return;
    setState(() => _loading = false);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final email = ModalRoute.of(context)?.settings.arguments as String?;
    return AuthScaffold(
      title: 'Check your inbox',
      subtitle: email == null
          ? 'We sent you a verification link.'
          : 'We sent a verification link to $email.',
      icon: Icons.mark_email_unread_outlined,
      children: [
        const Text(
          'Open the link to activate your account, then come back here and log in. '
          "If you don't see it, check your spam folder.",
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 32),
        FilledButton(
          onPressed: () => Navigator.popUntil(context, (route) => route.isFirst),
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          child: const Text('Back to Log In'),
        ),
        if (email != null) ...[
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: _loading ? null : () => _resend(email),
            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            child: Text(_loading ? 'Sending…' : 'Resend email'),
          ),
        ],
      ],
    );
  }
}
