// Tiny i18n: flat dictionaries per language with {param} placeholders.
// "{fee:money}" formats as currency, "{n:num}" as a number, "{stage:key}" translates the value.
import {useGame} from "../store";
import {en} from "./en";
import {es} from "./es";
import {sv} from "./sv";

export const LANGS = ["sv", "en", "es"] as const;
export type Lang = (typeof LANGS)[number];
export type TKey = keyof typeof sv;
export type Params = Record<string, string | number>;

const DICTS: Record<Lang, Record<TKey, string>> = {sv, en, es};
const LOCALES: Record<Lang, string> = {sv: "sv-SE", en: "en-GB", es: "es-ES"};

export function formatMoney(lang: Lang, n: number): string {
  const big = Math.abs(n) >= 1_000_000;
  return new Intl.NumberFormat(LOCALES[lang], {
    style: "currency",
    currency: "EUR",
    notation: big ? "compact" : "standard",
    maximumFractionDigits: big ? 2 : 0,
  }).format(n);
}

export function formatNumber(lang: Lang, n: number, digits = 0): string {
  return new Intl.NumberFormat(LOCALES[lang], {maximumFractionDigits: digits, minimumFractionDigits: digits}).format(n);
}

/** Translates any key; unknown keys fall back to Swedish, then the key itself. */
export function translate(lang: Lang, key: string, params?: Params): string {
  const dict = DICTS[lang] as Record<string, string>;
  const text = dict[key] ?? (sv as Record<string, string>)[key] ?? key;
  return text.replace(/\{(\w+)(?::(\w+))?\}/g, (_, name: string, type?: string) => {
    const value = params?.[name];
    if (value === undefined) return "";
    if (type === "money") return formatMoney(lang, Number(value));
    if (type === "num") return formatNumber(lang, Number(value));
    // A key itself, e.g. the cup round: "{stage:key}".
    if (type === "key") return translate(lang, String(value));
    return String(value);
  });
}

/** Hook for components: typed `t`, loose `tx` for keys from the engine. */
export function useT() {
  const lang = useGame((s) => s.lang);
  return {
    lang,
    t: (key: TKey, params?: Params) => translate(lang, key, params),
    tx: (key: string, params?: Params) => translate(lang, key, params),
    money: (n: number) => formatMoney(lang, n),
    num: (n: number, digits = 0) => formatNumber(lang, n, digits),
  };
}
