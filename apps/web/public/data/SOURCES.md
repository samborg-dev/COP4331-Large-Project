Map renderer: [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) (BSD-3-Clause).

Base style adapted from [OpenFreeMap Dark](https://tiles.openfreemap.org/styles/dark).
Vector tiles: OpenFreeMap / OpenMapTiles; data: OpenStreetMap contributors (ODbL).
Provider and data credits remain in the map's attribution control.

Natural Earth assets (public domain):
- [Country boundaries and label positions](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson): countries.geojson and country-centers.json.
- [Lakes, 1:50m](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_lakes.geojson): lakes.geojson.
- [Glaciated areas, 1:50m](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_glaciated_areas.geojson): glaciers.geojson.
- [Shaded relief hosted by OpenFreeMap](https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png): recolored landscape tiles and landscape-fallback.png. The fallback fills gaps while detailed tiles load.

river-overview.geojson preserves the first river-detail level from OpenFreeMap/OpenMapTiles zoom-3 waterway tiles (OpenStreetMap data, ODbL).
The regular vector layer supplies additional river detail at closer zoom levels.

country-centers.json uses Natural Earth's LABEL_X/LABEL_Y positions for camera targets and country-name labels.
