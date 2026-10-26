// The languages the game speaks. On its own (no imports), so the store can use it
// without a loop through the dictionaries, which use the store.
export const LANGS = ["sv", "en", "es", "it", "fr"] as const;
export type Lang = (typeof LANGS)[number];
