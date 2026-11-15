import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../utils/validators.dart';
import '../widgets/auth_scaffold.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  String _message = '';

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _doRegister() async {
    if (!_formKey.currentState!.validate()) return;
    final email = _email.text.trim();
    setState(() {
      _loading = true;
      _message = '';
    });
    try {
      await widget.api.register(
        firstName: _firstName.text.trim(),
        lastName: _lastName.text.trim(),
        email: email,
        password: _password.text,
      );
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, '/check-inbox', arguments: email);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _message =
          e.statusCode == 409 ? 'An account with that email already exists.' : e.message);
    } catch (_) {
      if (mounted) setState(() => _message = 'Could not reach the server. Check your connection.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Create account',
      subtitle: 'Sign up to start earning points',
      icon: Icons.person_add_alt_1_outlined,
      children: [
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: TextFormField(
                      key: const Key('register-first-name'),
                      controller: _firstName,
                      textCapitalization: TextCapitalization.words,
                      autofillHints: const [AutofillHints.givenName],
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'First name',
                        border: OutlineInputBorder(),
                      ),
                      validator: requiredField('first name'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      key: const Key('register-last-name'),
                      controller: _lastName,
                      textCapitalization: TextCapitalization.words,
                      autofillHints: const [AutofillHints.familyName],
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Last name',
                        border: OutlineInputBorder(),
                      ),
                      validator: requiredField('last name'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextFormField(
                key: const Key('register-email'),
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Email',
                  prefixIcon: Icon(Icons.email_outlined),
                  border: OutlineInputBorder(),
                ),
                validator: validateEmail,
              ),
              const SizedBox(height: 16),
              TextFormField(
                key: const Key('register-password'),
                controller: _password,
                obscureText: _obscure,
                autofillHints: const [AutofillHints.newPassword],
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(
                  labelText: 'Password',
                  helperText: 'At least 8 characters',
                  prefixIcon: const Icon(Icons.lock_outline),
                  border: const OutlineInputBorder(),
                  suffixIcon: IconButton(
                    tooltip: _obscure ? 'Show password' : 'Hide password',
                    icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
                validator: validateNewPassword,
              ),
              const SizedBox(height: 16),
              TextFormField(
                key: const Key('register-confirm'),
                controller: _confirm,
                obscureText: _obscure,
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => _doRegister(),
                decoration: const InputDecoration(
                  labelText: 'Confirm password',
                  prefixIcon: Icon(Icons.lock_outline),
                  border: OutlineInputBorder(),
                ),
                validator: (value) =>
                    value != _password.text ? 'Passwords do not match' : null,
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        LoadingButton(label: 'Sign Up', loading: _loading, onPressed: _doRegister),
        FormMessage(_message),
        const SizedBox(height: 24),
        Wrap(
          alignment: WrapAlignment.center,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            const Text('Already have an account?'),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Log in'),
            ),
          ],
        ),
      ],
    );
  }
}
