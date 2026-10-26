// Every translation keeps the same placeholders ({name}, {fee:money}…) as the Swedish original,
// or the game would show blanks or raw braces in that language.
import {describe, expect, it} from "vitest";
import {en} from "./en";
import {es} from "./es";
import {fr} from "./fr";
import {it as itDict} from "./it";
import {sv} from "./sv";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)(?::\w+)?\}/g)].map((m) => m[0]).sort().join(",");

describe("translations", () => {
  for (const [lang, dict] of Object.entries({en, es, it: itDict, fr})) {
    it(`${lang} has the same placeholders as Swedish`, () => {
      const wrong = (Object.keys(sv) as (keyof typeof sv)[]).filter((k) => placeholders(sv[k]) !== placeholders(dict[k]));
      expect(wrong).toEqual([]);
    });
  }
});
