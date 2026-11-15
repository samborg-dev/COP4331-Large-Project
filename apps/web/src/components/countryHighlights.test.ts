import { describe, expect, it } from "vitest";
import shapesText from "../../public/data/countries.geojson?raw";
import targetsText from "../../public/data/country-centers.json?raw";
import countriesCsv from "../../../api/scripts/Large_Project_DB.countries.csv?raw";
import { countryKey, guessColor, withRevealedAnswer } from "./countryHighlights";

describe("country highlights", () => {
  it("matches all 197 seeded countries to both a map shape and a camera/label target", () => {
    const shapes = JSON.parse(shapesText);
    const targets = JSON.parse(targetsText);
    const keys = new Set(shapes.features.map((feature: { properties: { name: string } }) => countryKey(feature.properties.name)));
    const targetKeys = new Set(Object.keys(targets).map(countryKey));
    const rows = countriesCsv.trim().split(/\r?\n/).slice(1);
    expect(rows).toHaveLength(197);
    const missing = rows.map(row => row.split(",")[3]!).filter(name => !keys.has(countryKey(name)) || !targetKeys.has(countryKey(name)));
    expect(missing).toEqual([]);
  });
  it("reveals an unguessed answer without changing guess history", () => {
    const guesses = [{ countryId: "fr", name: "France", range: "> 6,000 km" as const }];
    const highlights = withRevealedAnswer(guesses, "Egypt");
    expect(highlights).toHaveLength(2);
    expect(highlights[1]).toMatchObject({ name: "Egypt", correct: true });
    expect(guesses).toHaveLength(1);
  });
  it("replaces an existing answer highlight rather than drawing it twice", () => {
    const highlights = withRevealedAnswer([{ countryId: "us", name: "United States", range: "< 500 km" }], "United States of America");
    expect(highlights).toHaveLength(1);
    expect(highlights[0].correct).toBe(true);
  });
  it("does not invent an answer when none is supplied", () => {
    expect(withRevealedAnswer([])).toEqual([]);
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
