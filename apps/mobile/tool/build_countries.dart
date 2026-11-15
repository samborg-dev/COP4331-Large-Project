// Builds assets/countries.json from the web app's Natural Earth data, so the
// mobile globe draws the same country shapes as the web globe.
//
// Run from apps/mobile:  dart run tool/build_countries.dart
//
// Output: { "<name>": { "c": [lng, lat], "r": [[lng, lat, lng, lat, ...], ...] } }
// Coordinates are rounded to 0.01° and points closer than [_minStep] degrees
// apart are dropped, which keeps the file small enough to bundle.
import 'dart:convert';
import 'dart:io';

const _webData = '../web/public/data';
const _out = 'assets/countries.json';
const _minStep = 0.2;

void main() {
  final geo = jsonDecode(File('$_webData/countries.geojson').readAsStringSync()) as Map<String, dynamic>;
  final centers = jsonDecode(File('$_webData/country-centers.json').readAsStringSync()) as Map<String, dynamic>;

  final out = <String, Object>{};
  var points = 0;
  for (final feature in geo['features'] as List) {
    final name = feature['properties']['name'] as String;
    final geometry = feature['geometry'] as Map<String, dynamic>;
    final polygons = geometry['type'] == 'MultiPolygon'
        ? geometry['coordinates'] as List
        : [geometry['coordinates']];

    final rings = <List<num>>[];
    for (final polygon in polygons) {
      // Only the outer ring; holes (e.g. lakes) don't matter at globe scale
      final raw = (polygon as List).first as List;
      var ring = _simplify(raw, _minStep);
      // Small islands and microstates would vanish; keep them in full detail
      if (ring.length < 8) ring = _simplify(raw, 0);
      if (ring.length >= 6) {
        rings.add(ring);
        points += ring.length ~/ 2;
      }
    }
    if (rings.isEmpty) continue;
    out[name] = {'c': centers[name] ?? _centerOf(rings.first), 'r': rings};
  }

  File(_out).writeAsStringSync(jsonEncode(out));
  stdout.writeln('Wrote ${out.length} countries, $points points, '
      '${(File(_out).lengthSync() / 1024).round()} KB to $_out');
}

List<num> _simplify(List ring, double minStep) {
  final flat = <num>[];
  double? lastLng, lastLat;
  for (final p in ring) {
    final lng = (p[0] as num).toDouble(), lat = (p[1] as num).toDouble();
    if (lastLng != null &&
        (lng - lastLng).abs() < minStep &&
        (lat - lastLat!).abs() < minStep) {
      continue;
    }
    flat
      ..add(_round(lng))
      ..add(_round(lat));
    lastLng = lng;
    lastLat = lat;
  }
  return flat;
}

num _round(double v) {
  final r = (v * 100).round() / 100;
  return r == r.roundToDouble() ? r.toInt() : r;
}

List<num> _centerOf(List<num> ring) {
  var lng = 0.0, lat = 0.0;
  for (var i = 0; i < ring.length; i += 2) {
    lng += ring[i];
    lat += ring[i + 1];
  }
  final n = ring.length / 2;
  return [_round(lng / n), _round(lat / n)];
}
