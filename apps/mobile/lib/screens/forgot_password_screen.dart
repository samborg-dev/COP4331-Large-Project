import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../utils/validators.dart';
import '../widgets/auth_scaffold.dart';

/// Requests a reset email. The reset itself happens on the web page the
/// email links to, so mobile only needs this one screen.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _loading = false;
  bool _sent = false;
  String _message = '';

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _message = '';
    });
    try {
      await widget.api.forgotPassword(_email.text.trim());
      if (mounted) setState(() => _sent = true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _message = e.message);
    } catch (_) {
      if (mounted) setState(() => _message = 'Could not reach the server. Check your connection.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_sent) {
      return AuthScaffold(
        title: 'Check your email',
        subtitle: 'If an account exists for ${_email.text.trim()}, '
            'we sent a link to reset your password.',
        icon: Icons.mark_email_read_outlined,
        children: [
          FilledButton(
            onPressed: () => Navigator.pop(context),
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            child: const Text('Back to Log In'),
          ),
        ],
      );
    }
    return AuthScaffold(
      title: 'Forgot password?',
      subtitle: "Enter your email and we'll send you a reset link.",
      icon: Icons.lock_reset,
      children: [
        Form(
          key: _formKey,
          child: TextFormField(
            key: const Key('forgot-email'),
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.email],
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _send(),
            decoration: const InputDecoration(
              labelText: 'Email',
              prefixIcon: Icon(Icons.email_outlined),
              border: OutlineInputBorder(),
            ),
            validator: validateEmail,
          ),
        ),
        const SizedBox(height: 24),
        LoadingButton(label: 'Send Reset Link', loading: _loading, onPressed: _send),
        FormMessage(_message),
      ],
    );
  }
}
