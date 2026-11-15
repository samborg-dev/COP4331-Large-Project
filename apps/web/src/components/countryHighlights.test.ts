import { describe, expect, it } from "vitest";
import shapesText from "../../public/data/countries.geojson?raw";
import countriesCsv from "../../../api/scripts/Large_Project_DB.countries.csv?raw";
import { countryKey, guessColor } from "./countryHighlights";

describe("country highlights", () => {
  it("matches all 197 seeded countries to a map shape", () => {
    const shapes = JSON.parse(shapesText);
    const keys = new Set(shapes.features.map((feature: { properties: { name: string } }) => countryKey(feature.properties.name)));
    const rows = countriesCsv.trim().split(/\r?\n/).slice(1);
    expect(rows).toHaveLength(197);
    const missing = rows.map(row => row.split(",")[3]!).filter(name => !keys.has(countryKey(name)));
    expect(missing).toEqual([]);
  });
  it.each([
    ["United States", "United States of America"], ["Tanzania", "United Republic of Tanzania"],
    ["Serbia", "Republic of Serbia"], ["Timor-Leste", "East Timor"],
    ["Côte d’Ivoire", "Ivory Coast"], ["Türkiye", "Turkey"],
    ["Bahamas", "The Bahamas"], ["Vatican City", "Vatican"],
  ])("matches API country %s to map country %s", (api, map) => {
    expect(countryKey(api)).toBe(countryKey(map));
  });
  it("keeps the two Congo countries distinct", () => {
    expect(countryKey("Republic of the Congo")).not.toBe(countryKey("Democratic Republic of the Congo"));
  });
  it("uses the correct-country color even if the final range is a distance bucket", () => {
    expect(guessColor({ countryId: "1", name: "Egypt", range: "< 500 km", correct: true }))
      .toBe(guessColor({ countryId: "1", name: "Egypt", range: "Correct" }));
  });
});
