import type { Guess } from "../round";

const aliases: Record<string, string> = {
  "united states": "united states of america", usa: "united states of america",
  "tanzania": "united republic of tanzania", "serbia": "republic of serbia",
  "timor leste": "east timor", "swaziland": "eswatini",
  "cote d ivoire": "ivory coast", "cape verde": "cabo verde",
  "vatican city": "vatican", "holy see": "vatican",
  "micronesia": "federated states of micronesia", "bahamas": "the bahamas",
  "congo": "republic of the congo", "congo republic": "republic of the congo",
  "dr congo": "democratic republic of the congo", "congo democratic republic": "democratic republic of the congo",
  "congo drc": "democratic republic of the congo", "russian federation": "russia",
  "brunei darussalam": "brunei",
  "czech republic": "czechia", "turkiye": "turkey",
};

export function countryKey(name: string) {
  const key = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return aliases[key] ?? key;
}

export function guessColor(guess: Guess) {
  if (guess.correct || guess.range === "Correct") return "#66d99a";
  return {
    "< 500 km": "#e62932",
    "500–1,500 km": "#d9684f",
    "1,500–3,000 km": "#d5c56d",
    "3,000–6,000 km": "#80a9d4",
    "> 6,000 km": "#747fc5",
  }[guess.range];
}

export function withRevealedAnswer(guesses: Guess[], answer?: string): Guess[] {
  if (!answer) return guesses;
  return [...guesses.filter((guess) => countryKey(guess.name) !== countryKey(answer)),
    { countryId: "revealed-answer", name: answer, range: "Correct", correct: true }];
}
