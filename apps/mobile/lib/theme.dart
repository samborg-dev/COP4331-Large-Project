import 'package:flutter/material.dart';

/// Colors taken from apps/web/src/App.css so the app matches the website.
class AppColors {
  static const background = Color(0xFF10141F);
  static const card = Color(0xFF202633);
  static const input = Color(0xFF151B27);
  static const inputBorder = Color(0xFF465067);
  static const primary = Color(0xFF718DFF);
  static const onPrimary = Color(0xFF0C1636);
  static const text = Color(0xFFF2F4F8);
  static const muted = Color(0xFFB4BDCE);
  static const link = Color(0xFF9DB8FF);
  static const kicker = Color(0xFFA6B9FF);
  static const divider = Color(0x14FFFFFF);
  static const error = Color(0xFFFF8A8A);
  static const success = Color(0xFF7EE2A8);
}

ThemeData buildTheme() {
  const scheme = ColorScheme.dark(
    primary: AppColors.primary,
    onPrimary: AppColors.onPrimary,
    surface: AppColors.background,
    onSurface: AppColors.text,
    onSurfaceVariant: AppColors.muted,
    surfaceContainer: AppColors.card,
    surfaceContainerHighest: AppColors.card,
    outline: AppColors.inputBorder,
    outlineVariant: AppColors.divider,
    error: AppColors.error,
  );
  final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(10));
  const minSize = Size.fromHeight(48);
  const label = TextStyle(fontWeight: FontWeight.w700, fontSize: 15);
  OutlineInputBorder border(Color color, [double width = 1]) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: color, width: width),
      );

  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: scheme,
    scaffoldBackgroundColor: AppColors.background,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.background,
      foregroundColor: AppColors.text,
      surfaceTintColor: Colors.transparent,
      centerTitle: true,
      titleTextStyle: TextStyle(
        color: Color(0xFFB5C6FF),
        fontSize: 17,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.5,
      ),
    ),
    cardTheme: CardThemeData(
      color: AppColors.card,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: const BorderSide(color: Color(0x12FFFFFF)),
      ),
    ),
    textTheme: const TextTheme(
      headlineMedium: TextStyle(
        fontSize: 27,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.9,
        color: AppColors.text,
      ),
      labelSmall: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.6,
        color: AppColors.kicker,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.input,
      labelStyle: const TextStyle(color: Color(0xFFE0E5EF)),
      hintStyle: const TextStyle(color: Color(0xFF929DB2)),
      border: border(AppColors.inputBorder),
      enabledBorder: border(AppColors.inputBorder),
      focusedBorder: border(const Color(0xFFAAC1FF), 2),
      errorBorder: border(AppColors.error),
      focusedErrorBorder: border(AppColors.error, 2),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.onPrimary,
        disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.45),
        disabledForegroundColor: AppColors.onPrimary,
        minimumSize: minSize,
        shape: shape,
        textStyle: label,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.text,
        side: const BorderSide(color: AppColors.inputBorder),
        minimumSize: minSize,
        shape: shape,
        textStyle: label,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: AppColors.link),
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: AppColors.card,
      contentTextStyle: TextStyle(color: AppColors.text),
      behavior: SnackBarBehavior.floating,
    ),
    dividerColor: AppColors.divider,
  );
}
