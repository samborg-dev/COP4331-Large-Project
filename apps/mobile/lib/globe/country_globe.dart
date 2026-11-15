import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/models.dart';
import '../theme.dart';
import 'country_colors.dart';

/// One country's outline as unit-sphere points, plus where to put its label.
class CountryShape {
  CountryShape(this.name, this.rings, this.center);

  final String name;

  /// Each ring is x, y, z triples on the unit sphere.
  final List<Float32List> rings;

  /// [longitude, latitude] in degrees.
  final List<double> center;
}

/// Country shapes keyed by [countryKey], loaded once from assets/countries.json
/// (built from the web app's Natural Earth data by tool/build_countries.dart).
class GlobeData {
  GlobeData(this.countries);

  final Map<String, CountryShape> countries;

  static Future<GlobeData>? _loading;

  static Future<GlobeData> load([AssetBundle? bundle]) {
    return _loading ??= (bundle ?? rootBundle)
        .loadString('assets/countries.json')
        .then((text) => compute(_parse, text));
  }

  static GlobeData _parse(String text) {
    final json = jsonDecode(text) as Map<String, dynamic>;
    final countries = <String, CountryShape>{};
    json.forEach((name, value) {
      final rings = <Float32List>[];
      for (final ring in value['r'] as List) {
        final flat = ring as List;
        final xyz = Float32List(flat.length ~/ 2 * 3);
        for (var i = 0, j = 0; i < flat.length; i += 2, j += 3) {
          final lng = (flat[i] as num) * math.pi / 180;
          final lat = (flat[i + 1] as num) * math.pi / 180;
          xyz[j] = math.cos(lat) * math.cos(lng);
          xyz[j + 1] = math.cos(lat) * math.sin(lng);
          xyz[j + 2] = math.sin(lat);
        }
        rings.add(xyz);
      }
      final c = value['c'] as List;
      countries[countryKey(name)] = CountryShape(
        name,
        rings,
        [(c[0] as num).toDouble(), (c[1] as num).toDouble()],
      );
    });
    return GlobeData(countries);
  }
}

/// A globe that colors guessed countries by distance (hotter is closer),
/// turns to face the latest guess, and shows the answer in green at the end.
/// Drag to spin, pinch to zoom.
class CountryGlobe extends StatefulWidget {
  const CountryGlobe({
    super.key,
    required this.guesses,
    this.answer,
    this.focusCountry,
    this.roundId,
  });

  final List<Guess> guesses;
  final String? answer;

  /// The country to turn toward, usually the latest guess.
  final String? focusCountry;

  /// A new value resets the view for a new round.
  final String? roundId;

  @override
  State<CountryGlobe> createState() => _CountryGlobeState();
}

class _CountryGlobeState extends State<CountryGlobe> with SingleTickerProviderStateMixin {
  static const _home = (lng: 10.0, lat: 25.0);

  GlobeData? _data;
  bool _failed = false;

  // The point facing the viewer, in degrees, and the zoom level
  double _lng = _home.lng, _lat = _home.lat, _zoom = 1;
  double _zoomAtStart = 1;

  late final AnimationController _turn =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
        ..addListener(_onTurn);
  Animation<double>? _turnCurve;
  double _fromLng = 0, _fromLat = 0, _fromZoom = 1, _toLng = 0, _toLat = 0, _toZoom = 1;

  @override
  void initState() {
    super.initState();
    GlobeData.load().then((data) {
      if (!mounted) return;
      setState(() => _data = data);
      _focus(widget.focusCountry ?? widget.answer, animate: false);
    }).catchError((Object _) {
      if (mounted) setState(() => _failed = true);
    });
  }

  @override
  void didUpdateWidget(CountryGlobe old) {
    super.didUpdateWidget(old);
    if (widget.roundId != old.roundId) {
      _turn.stop();
      setState(() {
        _lng = _home.lng;
        _lat = _home.lat;
        _zoom = 1;
      });
    } else if (widget.answer != null && widget.answer != old.answer) {
      _focus(widget.answer);
    } else if (widget.focusCountry != old.focusCountry) {
      _focus(widget.focusCountry);
    }
  }

  @override
  void dispose() {
    _turn.dispose();
    super.dispose();
  }

  void _focus(String? name, {bool animate = true}) {
    final shape = name == null ? null : _data?.countries[countryKey(name)];
    if (shape == null) return;
    // Take the short way around instead of spinning across the date line
    final target = shape.center[0] + 360 * ((_lng - shape.center[0]) / 360).round();
    _fromLng = _lng;
    _fromLat = _lat;
    _fromZoom = _zoom;
    _toLng = target;
    _toLat = shape.center[1].clamp(-70, 70).toDouble();
    // Keep the current zoom so the whole globe stays in view
    _toZoom = _zoom;
    final reduceMotion = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (!animate || reduceMotion) {
      setState(() {
        _lng = _toLng;
        _lat = _toLat;
        _zoom = _toZoom;
      });
      return;
    }
    _turnCurve = CurvedAnimation(parent: _turn, curve: Curves.easeInOutCubic);
    _turn.forward(from: 0);
  }

  void _onTurn() {
    final t = _turnCurve?.value ?? 1;
    setState(() {
      _lng = _fromLng + (_toLng - _fromLng) * t;
      _lat = _fromLat + (_toLat - _fromLat) * t;
      _zoom = _fromZoom + (_toZoom - _fromZoom) * t;
    });
  }

  void _onScaleStart(ScaleStartDetails d) {
    _turn.stop();
    _zoomAtStart = _zoom;
  }

  void _onScaleUpdate(ScaleUpdateDetails d, double radius) {
    setState(() {
      final degreesPerPixel = 180 / math.pi / (radius * _zoom);
      _lng -= d.focalPointDelta.dx * degreesPerPixel;
      _lat = (_lat + d.focalPointDelta.dy * degreesPerPixel).clamp(-80, 80).toDouble();
      _zoom = (_zoomAtStart * d.scale).clamp(1, 6).toDouble();
    });
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    return AspectRatio(
      aspectRatio: 1,
      child: LayoutBuilder(builder: (context, constraints) {
        final radius = constraints.maxWidth / 2 * 0.92;
        if (data == null) {
          // A still placeholder (not a spinner) while the shapes load
          return Center(
            child: Container(
              width: radius * 2,
              height: radius * 2,
              alignment: Alignment.center,
              decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFF16284F)),
              child: Text(
                _failed ? 'The globe could not load.' : 'Loading globe…',
                style: const TextStyle(color: AppColors.muted),
              ),
            ),
          );
        }
        return Semantics(
          label: 'Globe showing your guesses. Drag to spin, pinch to zoom.',
          child: RawGestureDetector(
            gestures: {
              _GlobeGestureRecognizer: GestureRecognizerFactoryWithHandlers<_GlobeGestureRecognizer>(
                _GlobeGestureRecognizer.new,
                (r) => r
                  ..onStart = _onScaleStart
                  ..onUpdate = (d) => _onScaleUpdate(d, radius),
              ),
            },
            child: ClipRect(
              child: CustomPaint(
                size: Size.infinite,
                painter: _GlobePainter(
                  data: data,
                  highlights: withRevealedAnswer(widget.guesses, widget.answer),
                  lng: _lng,
                  lat: _lat,
                  radius: radius * _zoom,
                ),
              ),
            ),
          ),
        );
      }),
    );
  }
}

/// Wins touches on the globe right away, so dragging it spins the globe
/// instead of scrolling the page around it.
class _GlobeGestureRecognizer extends ScaleGestureRecognizer {
  @override
  void addAllowedPointer(PointerDownEvent event) {
    super.addAllowedPointer(event);
    resolve(GestureDisposition.accepted);
  }
}

class _GlobePainter extends CustomPainter {
  _GlobePainter({
    required this.data,
    required this.highlights,
    required this.lng,
    required this.lat,
    required this.radius,
  });

  final GlobeData data;
  final List<Guess> highlights;
  final double lng, lat, radius;

  static const _land = Color(0xFF2E3A55);
  static const _border = Color(0xFF4A5677);

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final globe = Rect.fromCircle(center: center, radius: radius);

    // Soft glow, then the ocean
    canvas.drawCircle(
      center,
      radius + 6,
      Paint()
        ..color = AppColors.primary.withValues(alpha: 0.18)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 10),
    );
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..shader = const RadialGradient(
          center: Alignment(-0.35, -0.4),
          colors: [Color(0xFF26407A), Color(0xFF122347)],
        ).createShader(globe),
    );

    final colors = {for (final g in highlights) countryKey(g.country): guessColor(g.range)};
    final project = _Projection(lng, lat, center, radius);
    final landFill = Paint()..color = _land;
    final borderStroke = Paint()
      ..color = _border
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.6;

    // Plain countries first, highlighted ones on top so their outlines show
    for (final pass in [false, true]) {
      data.countries.forEach((key, shape) {
        final color = colors[key];
        if ((color != null) != pass) return;
        final path = project.path(shape);
        if (path == null) return;
        canvas.drawPath(path, color == null ? landFill : (Paint()..color = color));
        canvas.drawPath(
          path,
          color == null
              ? borderStroke
              : (Paint()
                ..color = Colors.white.withValues(alpha: 0.85)
                ..style = PaintingStyle.stroke
                ..strokeWidth = 1.2),
        );
      });
    }

    // Shade the rim so it reads as a sphere
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..shader = RadialGradient(
          colors: [Colors.transparent, Colors.black.withValues(alpha: 0.35)],
          stops: const [0.75, 1],
        ).createShader(globe),
    );

    for (final g in highlights) {
      final shape = data.countries[countryKey(g.country)];
      final point = shape == null ? null : project.point(shape.center[0], shape.center[1]);
      if (point != null) _label(canvas, shape!.name, point);
    }
  }

  void _label(Canvas canvas, String text, Offset at) {
    final painter = TextPainter(
      text: TextSpan(
        text: text,
        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
      ),
      textDirection: TextDirection.ltr,
      maxLines: 1,
      ellipsis: '…',
    )..layout(maxWidth: 120);
    // Just below the country's label point, so the color stays visible
    final box = Rect.fromCenter(
      center: at + Offset(0, painter.height / 2 + 10),
      width: painter.width + 10,
      height: painter.height + 4,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(box, const Radius.circular(6)),
      Paint()..color = const Color(0xCC0C1636),
    );
    painter.paint(canvas, box.topLeft + const Offset(5, 2));
  }

  @override
  bool shouldRepaint(_GlobePainter old) =>
      old.lng != lng ||
      old.lat != lat ||
      old.radius != radius ||
      old.data != data ||
      !listEquals(
        old.highlights.map((g) => '${g.country}|${g.range}').toList(),
        highlights.map((g) => '${g.country}|${g.range}').toList(),
      );
}

/// Orthographic projection: the globe as seen from far away, centered on
/// ([lng], [lat]).
class _Projection {
  _Projection(double lng, double lat, this.center, this.radius)
      : _cosLng = math.cos(lng * math.pi / 180),
        _sinLng = math.sin(lng * math.pi / 180),
        _cosLat = math.cos(lat * math.pi / 180),
        _sinLat = math.sin(lat * math.pi / 180);

  final Offset center;
  final double radius;
  final double _cosLng, _sinLng, _cosLat, _sinLat;

  /// Projects one ring; points on the far side are pulled onto the edge of
  /// the globe. Returns null when the whole country faces away.
  Path? path(CountryShape shape) {
    Path? path;
    for (final ring in shape.rings) {
      var visible = false;
      final points = <Offset>[];
      for (var i = 0; i < ring.length; i += 3) {
        // Rotate so the view center sits at (1, 0, 0), facing the viewer
        final x1 = ring[i] * _cosLng + ring[i + 1] * _sinLng;
        final y = -ring[i] * _sinLng + ring[i + 1] * _cosLng;
        final z1 = ring[i + 2];
        final depth = x1 * _cosLat + z1 * _sinLat;
        final z = -x1 * _sinLat + z1 * _cosLat;
        if (depth >= 0) {
          visible = true;
          points.add(Offset(center.dx + y * radius, center.dy - z * radius));
        } else {
          final len = math.sqrt(y * y + z * z);
          final s = len == 0 ? 0.0 : radius / len;
          points.add(Offset(center.dx + y * s, center.dy - z * s));
        }
      }
      if (!visible) continue;
      (path ??= Path()).addPolygon(points, true);
    }
    return path;
  }

  /// The screen position of a longitude/latitude, or null on the far side.
  Offset? point(double lng, double lat) {
    final la = lat * math.pi / 180, lo = lng * math.pi / 180;
    final px = math.cos(la) * math.cos(lo), py = math.cos(la) * math.sin(lo), pz = math.sin(la);
    final x1 = px * _cosLng + py * _sinLng;
    final y = -px * _sinLng + py * _cosLng;
    final depth = x1 * _cosLat + pz * _sinLat;
    if (depth < 0.15) return null;
    final z = -x1 * _sinLat + pz * _cosLat;
    return Offset(center.dx + y * radius, center.dy - z * radius);
  }
}
