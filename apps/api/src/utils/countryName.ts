function normalizeCountryName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function countryNameMatches(name: string, query: string): boolean {
  const normalizedName = normalizeCountryName(name);
  const normalizedQuery = normalizeCountryName(query);
  if (!normalizedQuery) return false;

  return normalizedName.includes(normalizedQuery);
}
