# Matchmotorn: de 50 största realismproblemen (rankade)

Skriven 2026-11-10. **Ingen kod har ändrats** för den här rapporten (bara denna fil är ny). Underlag: `src/game/match.ts` (motor + `Replay`), `setpieces.ts`, `chances.ts`, `pitch.ts`, `ratings.ts`, `conditions.ts`, `src/ui/MatchViewer.tsx` (visningens fysik), samt kalibreringsmätningar (`engineStats.test.ts`, 240 matcher i två ligor) och det vi sett i spelet.

**Bevisnivå:** **[K]** = kontrollerat i koden (sökning/läsning, i den här sessionen). **[M]** = syns i mätning eller i hur spelet beter sig. **[A]** = antagande från arkitekturen, bör verifieras innan man bygger på det.

**Bevaras (ska inte röras av förbättringarna):** spelarattribut, taktik (mentalitet, formationer, 5 spelarinstruktioner + lagets), form, moral, fitness, kondition, egenskaper, matchkommandon (byten, Forza!, formationsbyte), träning, progression, ekonomi. Allt går idag in via `effectiveRating` (position × fitness × form × moral × skärpa × attityd) och `effect()` (instruktioner). De ska fortsätta vara de enda ingångarna: nya system *läser* dem, de skrivs inte om.

**Skala:** Påverkan på realismen 1–5 · Insats S (dagar) / M (veckor) / L (månader).

---

## Nivå A: arkitekturen (1–8). Orsaken till det mesta annat

**1. Spelarna finns inte i simuleringen. (5, L) [K]**
Spelarnas placering är en formel (`teamSpot`: position + bollens läge + om laget har bollen). Ingen individ har läge, fart, riktning, minne eller kondition i rummet. Det gör att allt rumsligt (avstånd, tid, frihet, press) bara kan *låtsas* i efterhand.

**2. Utfallet avgörs först, berättelsen byggs efteråt. (5, L) [K]**
Generatorn bestämmer skott, mål och set pieces; `Replay` hittar sedan på en touchkedja som leder dit, med eget slumpflöde. Visningen (`advance`) försöker få spelare och boll att hinna med. Följder vi sett: bollar som måste klippas, mottagare som inte hinner fram, set pieces med bollen långt borta.

**3. Det finns ingen bollmodell och ingen riktig bollinnehavsmodell. (5, L) [K]**
Innehavet delas per **minut** (`holder`, `POSSESSION_KEEP`); ett innehav varar i snitt ~3 matchminuter. På riktigt byter innehavet var 10–20:e sekund. Bollhöjd, fart, studs och luft finns bara i visningen och påverkar inget.

**4. Passningar simuleras inte. (5, L) [K]**
Ingen passningssäkerhet, inga brytningar, ingen skillnad på kort/lång/genombrott, ingen press på passaren. `receiver()` väljer mottagare med vikter, men en passning *lyckas alltid* tills minutens slumpslag avgör att laget tappar bollen. Därför går det inte heller att mäta passningssäkerhet (~80–85 % i verkligheten).

**5. Dueller finns inte som motorfunktion. (5, L) [K]**
Tacklingar, dribblingar mot försvarare, nickdueller i öppet spel och 50/50-bollar avgör inget; de ritas bara. Endast hörnor har en (förenklad) nickduell.

**6. Ingen rumslig försvarsorganisation. (4, L) [K]**
Press, backlinje, markering, ytor mellan lagdelar och offsidelinje finns inte i utfallet. Försvar mot anfall är två tal (`def`, `att`) och en kvot.

**7. Högst ett skott och ett set piece per minut. (4, M) [K]**
Chansen är en enda Bernoulli per minut (`pChance`). Returer, andra bollar, blockerade skott, rebounds och sekvenser (hörna → retur → skott) saknas. Skott kommer inte i naturliga klungor annat än via vårt nya territoriesteg.

**8. Chansens typ hänger inte ihop med hur anfallet gick. (4, M) [K]**
Typen (nick, djupled, långskott…) slumpas från vikter och position, inte från vad anfallet faktiskt gjorde (kantspel, genombrott). Replayen rättar sig efter typen, men motorn *producerar* inte kantspel eller djupledsbollar som orsak.

---

## Nivå B: taktik och matchläge (9–18)

**9. Matchläget påverkar inget. (5, M) [K]**
Ingen kod för ledning/underläge, tid kvar, tidsspel, "ställa bussen", jaga mål eller sista-minuten-tryck (enda träffen på `goals <` gäller motståndarens Forza). Verkliga matcher förändras starkt av ställningen.

**10. Taktiken är multiplikatorer på lagdelstal. (5, M) [K]**
Mentalitet (3 lägen) och 5 instruktioner skalar `line[def,mid,att]`, `shoot`, `assist`, `foul`, `tire`. Press, tempo, bredd, backlinje, uppspelsstil (kort/lång) och markeringsstil finns inte. Instruktionerna skalar sannolikheter, de ändrar inget *beteende*.

**11. Formationer skiljer sig bara via `LINE_WEIGHTS`. (4, M) [K]**
Ingen formationsmatchning (3 bak mot 2 anfallare, överlägen på kanterna, numerärt övertag i mitten). 4-3-3 och 4-4-2 skiljer sig i summor, inte i rum.

**12. AI-tränarna är statiska. (4, M) [A]**
Ingen anpassning i matchen eller i halvlek, inga reaktioner på motståndarens lösningar. AI-byten är slump (25 % per minut mellan 58 och 85) styrda av fitness.

**13. Byten saknar taktisk logik och effekt. (3, S) [K]**
Byte av trött spelare, men ingen koppling till ställning, formationsbehov eller skador. "Fräscha ben" ger bara högre fitness, inga nya löpvägar.

**14. Omställningar och kontringar saknas. (5, M) [K]**
Efter bollvinst börjar nästa innehav från "uppspel" (territorium 0). Kontringar från högt läge, den farligaste chansen i verkligheten, kan inte uppstå. Pressfällor och framspel efter brytning finns inte.

**15. Ingen psykologi under matchen. (3, M) [K]**
Moral räknas in via `effectiveRating` *före* matchen men ändras bara efter slutsignalen. Mål, kvittering, missad straff eller utvisning påverkar inte självförtroende, nerver eller prestation under matchen.

**16. Utvisningar ger för lite följdverkan. (3, S) [K]**
Laget förlorar en spelare i lagdelssumman, men formationen omorganiseras inte (inte heller av AI), och inget "jaga/försvara" följer. Målvaktsutvisning ger utespelare i mål (nytt, enkelt).

**17. Nyckelspelare kan inte markeras. (3, M) [A]**
Ingen manuell markering, ingen uppmärksamhet på stjärnan, inget lag som "stänger" en spelare.

**18. Hemmafördel är en konstant (1,06). (2, S) [K]**
En skalär på lagdelarna. Publik, domare, resor och trötthet påverkar inte; `crowdFor` påverkar bara kassan och publiksiffran.

---

## Nivå C: disciplin, skador och regler (19–24)

**19. Fouls simuleras inte. (5, M) [K]**
Gult/rött är en slumpad chans per minut (`0.04 × aggression`) utan koppling till någon tackling eller foul. Ingen fouls-statistik. Frisparkar och straffar kommer från egna slumptal (`FREEKICK_RATE`, `PENALTY_RATE`) och inte från fouls, trots att replayen ritar en foul före dem.

**20. Ingen domare. (4, M) [K]**
Ingen strikthet, ingen konsekvens, ingen fördel, inga kort för protester eller tidsspel. Rött direkt är en konstant (1,5 %).

**21. Straffar och frisparkar hänger inte ihop med var fouls sker. (4, M) [K]**
Straffrate beror på chansens `ratio` och försvarets aggression, inte på hur ofta anfallare tacklas i rutan. Frisparkens plats slumpas (`72–80`) i stället för att komma från fouln.

**22. Skador är slump. (3, S) [K]**
0,003 per minut × tröttheten, ingen koppling till tacklingar, sprintar, tidigare skador (utom egenskapen `fragile`), underlag eller belastning från träningen.

**23. Offside finns inte. (4, M) [K]**
Offside är en av fem slumpade *orsaker* när ett mål "underkänns" (7 % av mål). Inga offsidestopp, ingen offsidefälla, inga lopp bakom backlinjen som annulleras.

**24. Fördel, handsregler, VAR, tidsspel. (2, M) [A]**
Inget av detta påverkar utfallet. Tilläggstiden räknas av händelser (bra) men inte av faktiska avbrott.

---

## Nivå D: avslut och målvakt (25–32)

**25. Skytten väljs oberoende av vem som får bollen. (4, M) [K]**
`SHOOTER_WEIGHT` per position × finishing. Assisten väljs likadant (`ASSIST_WEIGHT`, nu med `assistFit` per chanstyp). Det finns ingen passningskedja bakom, så "passare" och "skytt" är etiketter, inte händelser.

**26. xG ignorerar försvararna. (4, M) [K]**
Chansens värde (`chances.ts`) beror på plats, vinkel, typ, skytt/målvakt och lagkvot. Närmaste försvarare, press, kroppsställning, blockerande ben och målvaktens läge finns inte.

**27. Skottplacering styr inte utfallet. (3, M) [K]**
Ett skott är "på mål" eller inte och "mål" eller "räddat" via sannolikheter; var i målet det går (i krysset eller mitt på målvakten) påverkar inte, trots att repliken ritar en placering.

**28. Målvakten är ett enda tal. (4, M) [K]**
`gk` ersätter positionering, räddningar, hanteringsfel, utspel, utgångar på inlägg (`KEEPER_CLAIM_CHANCE` är en konstant) och spelförståelse. Inga misstag, ingen sweeper-roll.

**29. Returer saknas. (4, S) [K]**
Ett räddat skott ger alltid `turnover = true`. I verkligheten följs ~15–20 % av en retur, hörna eller andra chans.

**30. Hörnor kommer inte ur händelser. (3, S) [M]**
Hörnrate är konstant × kvot (nu ~6,4 per match mot ~10 på riktigt). Hörnor följer inte av blockerade skott, räddningar bakom mål eller försvarare som styr ut bollen.

**31. Spelstil påverkar skottbilden för lite. (3, M) [M]**
Kontringslag och bollinnehavslag borde skilja sig i antal skott, skotttyper och xG per skott. Idag skiljer bara kvoten, plus `shooting`-instruktionen.

**32. Skottyper följer fasta vikter. (2, S) [K]**
`pickChance` har fasta vikter (långt/nick/djupled…). De anpassas bara av kvot, position och shooting-instruktion, inte av matchbilden eller motståndarens uppställning.

---

## Nivå E: attribut, kondition och fysik (33–40)

**33. De flesta attribut har ingen effekt på utfallet. (5, M) [K]**
Sökning i `match.ts`: `pace` används i två replayrader, `vision` i replayval, `passing` i målgivarvikter, `physical` och `defending` i hörnor, `stamina` bara i konditionsförlust, `technique` i skottkvalitet och replayval. Fart, styrka, spelförståelse och försvarsförmåga avgör alltså inga dueller eller lopp.

**34. Konditionen är linjär och inte arbetsbaserad. (3, S) [K]**
`fitness −= 0,24 − stamina × 0,0013` per minut (× instruktioner). Springar, press, position och spelrytm spelar ingen roll, och det finns ingen "sen trötthet" som sänker beslutskvalitet.

**35. Målen är jämnt fördelade över matchen. (3, S) [M]**
Verkligheten har fler mål sent (särskilt 75–90) och strax före paus. Motorn har det inte, utom den lilla effekten av fitness i `effectiveRating`.

**36. Roller och position utöver slotvikter. (3, M) [A]**
`effectiveRating` har positionsanpassning (bra), men inga roller (inverterad ytterback, falsk nia, playmaker som sänker sig).

**37. Egenskaperna är få och små. (2, S) [K]**
Fyra traits (`cool`, `poacher`, `playmaker`, `fragile`) med små multiplikatorer. Ledarskap, kapten, set piece-specialister, vänsterfotade eller "big game player" saknas.

**38. Lagkemi/samspel påverkar inte matchen. (3, M) [K]**
Kemi nämns i rapporten som något "som inte rör matchmotorn". Ingen spelare får bättre samarbete med de han spelat mycket med.

**39. Väder, underlag och avsparkstid är bara kosmetiska. (3, S) [K]**
`conditions.ts` säger själv "only for show" och inget i `match.ts` läser det. Regn borde sänka passningssäkerhet, vind påverka långa bollar, värme öka tröttheten.

**40. Matchens vikt påverkar bara Forza. (2, S) [K]**
Derby, final, nedflyttningsmatch eller tryck ger ingen effekt utöver `bigMatch` som styr motståndarens Forza-tidpunkt.

---

## Nivå F: fasta situationer och restarter (41–44)

**41. Hörnor är förenklade. (4, M) [K]**
Fyra fasta zoner, en nickduell, en försvarare (den bäste), ingen markeringsstrategi, inga fösningar vid främre stolpen, inga andra bollar, inga korta hörnor med kombinationer utöver en zon. Målvaktens inlägg-utgång är en konstant.

**42. Frisparkar saknar variation. (3, M) [K]**
Fast mur, ingen indirekt frispark, ingen inläggsfrispark, ingen snabb frispark. Platsen är slumpad.

**43. Inkast, målspark och utkast bara ritas. (3, S) [K]**
Ingen lång inkastare, ingen press mot målspark, ingen målvaktsdistribution som påverkar nästa innehav (förutom `passing`).

**44. Straffar saknar tryck. (2, S) [K]**
Ingen nervositet (moral/`cool` utöver trait), ingen läsning av skyttens vana, ingen skillnad mellan avgörande och vanlig straff. Räddningsmodellen är enkel men rimlig.

---

## Nivå G: statistik, betyg, samstämmighet och testbarhet (45–50)

**45. Matchstatistiken är tunn. (4, S) [K]**
Skott, skott på mål och (nu) xG, men inga passningar, passningssäkerhet, brytningar, fouls, offside, räddningar eller hörnor i rapporten. Det gör både trovärdigheten och kalibreringen svårare.

**46. Spelarbetyg bygger på få händelser plus slump. (4, M) [K]**
`rate()` ges för mål, assist, räddning, lagresultat och rent bur, och slutligen läggs `normal(0, 0,35)` på alla. Mittfältare och försvarare bedöms nästan bara av resultatet, inte av vad de gjorde.

**47. Bollinnehav i procent och bilden kan säga emot varandra. (3, S) [M]**
Procenten räknas på minutandelar, replayen ritar beröringar. De kan visa olika lag som dominerande under samma minut.

**48. Kalibreringsluckor. (3, S) [M]**
Mål per match är ligaberoende (2,5–3,0), hemmaseger varierar 39–50 %, hörnor 6,4 (verkligt ~10), matcher med 5+ mål 9–16 %, målfördelningen över minuter är platt, kortfördelningen saknar tidsmönster. Ingen kalibrering av passningar, tacklingar eller fouls eftersom de inte finns.

**49. Motor och uppspel är olika program. (4, L) [K]**
Replayen har eget slumpflöde och egen logik; visningen (`advance`) har en tredje. De tre behöver hållas i takt med lagningar (utvalda mottagare, utklippta punkter, glidande boll). Varje ny funktion kan gå sönder i en av dem.

**50. Testerna mäter summor, inte beteenden. (3, M) [M]**
Kalibreringstestet och chanstestet är bra första steg, men det finns inga situationstester (passningssäkerhet under press, fart mot försvarare, konditionens effekt på sena mål), inga spårdata ("tracking") att jämföra mot och inget sätt att regressionstesta realism per mekanism.

---

## Hur problemen hänger ihop (och vad som ger mest)

- **Rot (1–3):** utan spelare och boll i motorn går 4, 5, 6, 26, 33, 34, 35 inte att göra på riktigt. Det är därför det mesta annat är "bort-förklarat".
- **Största realismvinsten per insats:** 9 (matchläge), 14 (kontringar), 19 + 21 (fouls → frisparkar/straffar/kort), 29 (returer), 33 (låt attributen räknas), 45 (statistik). De går att göra utan att bygga om grunden.
- **Största, mest värdefulla bygget:** en gemensam simulering i fasta steg (~5 per sekund) med spelare, boll och händelser som både 2D och 3D spelar upp (löser 1–8 och 49), med minutmodellen kvar som snabb variant för matcher användaren inte tittar på.

## Föreslagen ordning (sparar allt som ska bevaras)

1. **Mät och synliggör (S):** utöka rapporten med passningar, fouls, offside, räddningar och hörnor (45), och lägg in verklighetstalen som tester (48, 50).
2. **Låt befintliga system styra mer (S–M):** matchläge (9), kontringar (14), fouls som orsak till kort/frisparkar/straffar (19, 21, 20), returer (29), väder och avsparkstid (39), attribut som fart/styrka/defending i dueller (33).
3. **Spåra positioner i motorn (M, steg 2 i tidigare plan):** gör att passningar och set pieces kan kontrolleras innan de skrivs (8, 25, 26, 49).
4. **Dueller och passningar som riktiga händelser (L):** 4, 5, 6.
5. **Gemensam simulering (L):** 1–3 och 49, med spelarbetyg från faktiska handlingar (46).

Allt ovan ska använda `effectiveRating` och `effect()` som enda ingångar, så attribut, taktik, form, moral, tränarens kommandon och träning bevaras utan ändring.

## Mål att mäta mot (riktvärden)

Mål ~2,7 · skott ~25 (varav ~9 på mål) · passningssäkerhet 80–85 % · hörnor ~10 · frisparkar nära mål ~1–1,5 · fouls ~22–24 · gula ~3,5–4 · röda ≤ 0,15 · straffar ~0,3 · hemmaseger ~44 %, oavgjort ~25 % · fler mål i sista kvarten · ställningen påverkar taktik och tempo.
