# Forza Manager: anteckningar om allt vi bestämt och gjort

Den här filen är till för Claude (och dig) så att inget behöver upprepas. Läs den först i varje ny session. Uppdatera den när något nytt bestäms eller ändras. Sist uppdaterad: 2026-11-10.

## 1. Arbetsregler (gäller alltid)

- **Svara på svenska.** Kort och rakt. Säg tydligt vad som är testat och vad som *inte* är sett i ett riktigt spel.
- **Gör exakt det du ombeds, inget annat.** Den nya karaktären (Tripo) byttes ut mot Toony på eget bevåg i ansiktet och kläderna, och det gjorde dig arg. Är något oklart: ta det mest försiktiga alternativet eller fråga en gång, men ändra aldrig sånt du inte bad om (ansikten, färger, utseende).
- **Committa aldrig** om du inte ber om det. **Deploya aldrig.**
- **Kör inte WebGL-bygget.** Du trycker själv på *Forza > Build WebGL* (det tar lång tid). Säg när du behöver bygga om.
- **Stoppa och vänta** om ett verktygsanrop avvisas.
- **Språkfilerna** `src/i18n/{sv,en,es,it,fr}.ts` ska alltid ha exakt samma nycklar.
- **Du testar allt själv.** Därför ska varje leverans säga vad du bör kolla (se avsnitt 9).
- Skriv python-skript med Write-verktyget (aldrig heredoc med apostrofer; strängar får inte brytas över radbrytningar). Tillfälliga filer i scratchpad-mappen, och radera temporära testfiler efteråt.
- Sidan är för barn: realistisk fotboll, men enkelt och tydligt. Du är känslig för synliga fel och vill ha smidiga kanter, rätt riktning och inga "magneter".

## 2. Projektet

- **Webbappen** (React + TypeScript, vitest): `C:\Users\André\source\repos\football-manager`. Matchen körs i webben; Unity ritar bara.
- **Unity 6 (3D-vy):** riktiga projektet `C:\Users\André\source\repos\forza-3d`, labbkopia `C:\Users\Public\forza-lab`. WebGL-bygget hamnar i `football-manager/public/unity3d` och visas i en iframe. Webben skickar positioner och händelser (`state`, `ev[]`, `sp`, `spShot`, `setup`); Unity tar inget eget matchbeslut.
- **Spelarmodell: Toony Tiny People.** Den nya Tripo-karaktären testades och **återställdes** (inte det du ville ha). Filer från den ligger kvar i forza-3d (`Assets/Characters/*`, `Assets/Resources/Forza/CharFace.jpg`, `Players/CharPlayer.prefab`, `Football.asset` har `character: {fileID: 0}`). Fråga innan de raderas.
- **Mixamo-animationerna** är Humanoid och används via `Football.controller`.

### Arbetsflöde för Unity (viktigt)

1. Ändra i **labbet** (`C:\Users\Public\forza-lab\Assets`).
2. Rendera och titta: `C:\Users\Public\lab.ps1 -Scenario <namn>` (base, anim, run, corner, cornersave, penalty, hairs, sky, char). Bilder i `C:\Users\Public\forza-lab-out\<namn>`, loggar i `forza-lab-<namn>.log`.
3. Kör editormetoder: `method.ps1 -Method Klass.Metod`.
4. Lägg över till riktiga projektet: `publish.ps1` (robocopy-kod 1 eller 2 är OK). Lägg sedan till en rad `// recompile HH:mm:ss` i en .cs-fil i **båda** projekten så Unity kompilerar om.
5. Säg åt dig att klicka på Unity-fönstret / trycka Play i SampleScene, och att bygga WebGL själv.
- Headless Edge kan rendera HTML/SVG till PNG (`msedge --headless --screenshot`), så webbgrafik går att granska.
- **SampleScene** innehåller bara kamera, ljus och global volym. Allt annat (plan, mål, läktare, spelare) byggs av `MatchRoot` vid Play. Vill du kunna ändra delar för hand krävs ett editorverktyg som bakar in dem i scenen (inte gjort; erbjudet).

## 3. Match i 3D (Unity)

- **Kamera:** ingen rotera-knapp. Mobilen stående: från eget lags kortsida (bakom målet man försvarar; vy 1 hemma, 3 borta). Liggande: från långsidan (vy 0 hemma, 2 borta).
- **Dag/natt:** avsparkstiden styr ljuset (`daylightOf`). Före 16:00 dag, 18:00 skymning, från 19:30 natt med strålkastare. Moln/regn/snö gör dagen grå. Skickas i `setup` (`daylight`, `weather`).
- **Mål:** riktigt nät (tunna trådar). **Publiken** sitter rätt väg (huvud överst).
- **Målvakten** tittar upp mot planen när bollen är utanför linjen eller i händerna. Vid hörnräddning går han exakt till bollen.
- **Bollen:** slutar snurra direkt när den ligger still. Rullar vidare om en passning kommer fram utan mottagare.
- **Hörnor:** kameran högt över rutan (zonerna syns åtskilda). Markörer (nålar) skickas först när kameran är färdig och poppar upp en och en, placerade ovanför spelarna. Zonindex: 0 nära stolpe, 1 straffpunkt, 2 bortre stolpe, 3 kort hörna. Webben glömmer gamla positioner när en ny situation börjar.
- **Frisyrer (25 stilar)** ska likna avatarens (`src/ui/Avatar.tsx`, `HAIR_STYLES`). Justerade: ponytail, bun, coils, haaland, spiky. Huvudet är Toonys, så det blir en tolkning.
- **Tröjnummer** (stort bak, litet fram) på skinnat mesh. Kaptensbindel finns i koden för det nya kroppsläget men inte för Toony.
- **Roliga effekter (inte statistiskt rätt, bara kul):** vissa mål får en **cykelspark**, en **dyknick** (flyger in med huvudet först) eller ett **skott i krysset** där målvakten kastar sig men missar; målskytten gör ibland en **volt**. Slumpen är densamma för samma händelse (`Roll` i `MatchRoot.cs`). Koden: `PlayerView.Acro.cs` (kroppen vrids kring höfterna), `BallView.Flair` (bollen lyfts över banan), hörnor i `SetPieceStage.CornerShot`.
- **Mål-repris i 3D:** kameran byter vinkel efter hur nära målet bollen är: längs sidlinjen (långt borta), bakom bollhållaren, bakom målet och tittar tillbaka, framför målet lågt när bollen går i nät (`ReplayCamera` i `MatchRoot.cs`). Knappen heter nu **Fortsätt** och ligger ovanför 3D-bilden (och ovanför play-knapparna i maxläge).
- **Kontroller i 3D:** play/forward/paus ligger längst ned i mitten i maxläge (z-index över 3D-bilden).

## 4. Match i 2D och lägen

- Tre lägen: **Överblick** (2D-plan), **Zoner** (bräde), **3D**.
- **Fasta situationer (Själv/Auto)** är ett eget val som gäller i alla lägen, och kan ändras i Inställningar och i matchmenyn. I Överblick och Zoner visas de i **2D**, i 3D-läget i **3D**.
- 2D-hörnan har nålmarkörer (som 3D) ovanför spelarna.
- Straffläggning efter slutsignal hanteras av `Shootout` och är separat (osäkert i Zoner).

## 5. Matchmotorn (src/game/match.ts, setpieces.ts, chances.ts)

- Minutsimulering med sannolikheter; **Replay** ritar touchar efteråt (eget slumpflöde). Se `MATCH_ENGINE_REPORT.md` för analysen.
- **Chansmodell** (`chances.ts`): varje skott får typ (close, box, cutback, through, header, long) och plats. xG räknas från avstånd, vinkel och typ. Mål = xG × (skytt mot målvakt) × (anfall mot försvar). Målgivare väljs efter typ.
- **Territorium:** ett lag som behåller bollen går 0 uppspel → 1 sista tredjedelen → 2 straffområdet (`TERRITORY_CHANCE = [0.6, 1.2, 3.6]`). Inne i rutan blir skotten många fler.
- **Replay** ritar skotten efter chansen: nick kräver inlägg, bakåtpassning går via kanten, djupledsboll ger ensamt läge, långskott utanför rutan.
- Chansfrekvensen är **normaliserad** mot ligans nivå (`balance`) så olika ligor ger samma balans.
- **Utespelare går i mål** om målvakten utvisas utan byte.
- Fri spelare (ingen motståndare inom ~11 enheter, i offensiv halva) passar inte bakåt.
- **Straff:** perfekt timing (≥ 0,8) träffar där man siktade (kan fortfarande räddas).
- **Kalibrering** (`src/game/engineStats.test.ts`, 240 matcher i två ligor): mål/match 2,5–3,0; skott (öppet spel) 20–21; skott på mål 8; hemmaseger 40–50 %; oavgjort ~25 %; gula 3,5; röda ~0,15; straffar 0,3; hörnor ~6,4 (verkligt ~10, medvetet lägre); 5+ mål 9–16 %.
- Konstanter: `CHANCE_BASE 0.18`, `CHANCE_POWER 1.2`, `HOME_ADVANTAGE 1.06`, `PENALTY_RATE 0.0038`, `FREEKICK_RATE 0.015`, `CORNER_RATE 0.082`.
- **Chans-test:** `src/game/chanceReplay.test.ts`.
- **Det finns två motorer:** den gamla minutmotorn (standard) och den nya tick-motorn (se avsnitt 13). Valet görs i Inställningar > Matchmotor.

## 6. Bollen och spelarna i visningen (src/ui/MatchViewer.tsx, `advance`)

- Passningar siktar på en fast punkt (låst när bollen lämnar). Kan inte mottagaren nå fram väljer passaren närmaste medspelare som kan, annars spelas bollen till närmaste punkt mottagaren når, och mottagaren springer dit.
- En boll över mållinjen går rakt genom punkten motorn pekat ut (så ett skott utanför aldrig går genom målet).
- Vid en foul går bollen alltid till frisparkspunkten.
- Den som just spelat bollen kan inte bli ersättare för sin egen passning (inkastare passar inte sig själv).
- Bollen glider in mot en spelare (ingen "magnet"), startar från där den ligger, och rullar vidare efter en passning utan mottagare. Mottagning visas bara om spelaren är vid bollen.
- Mittfältare springer in i rutan vid inlägg.
- Testet `replayPhysics.test.ts` kontrollerar svängar, stopp och inlägg (gränserna lättades, se avsnitt 10).

## 7. Landslag och troféer

- **Turneringar:** VM (32 lag, vart fjärde år) för alla; två år efter VM spelas förbundets egen turnering med **16 lag**: EM (Europa), Copa América (Sydamerika), Gold Cup (Nordamerika), Afrikacupen, Asiacupen. Spelet har bara 33 länder, så små förbund fylls ut med inbjudna gäster. Land → turnering i `CONFEDERATION` i `national.ts`.
- 16 lag = 4 grupper, sedan kvartsfinal, semi, final (3 slutspelsomgångar).
- **Troféer** (12, bara guld för turneringar): liga, Champions Cup, VM, EM, Copa, Gold Cup, Afrikacupen, Asiacupen + 4 utmärkelser. Albumet visar antal (x/y) per sektion och sektionerna kan fällas ihop.
- Landslags-knappen i menyn visar landets flagga.

## 8. Övrigt gränssnitt

- **FoldButton** (`common.tsx`): den runda fällknappen, pil ner när hopfälld och upp när utfälld, alltid längst till höger i rubrikraden. Används i Album, Träning, Roller i laget och Ekonomi.
- Träningskortets rubrik visar programmet i liten text, till exempel "(Auto · Kondition · Normal)".
- Ekonomi-bannern: rubrik och (i) på samma rad, förklaringen i (i).
- Hjälptext för matchvyn är uppdaterad att fasta situationer gäller i alla lägen.

## 9. Det du behöver testa själv (inget av detta är sett i en riktig webbläsare/Unity)

**Webben (efter nytt WebGL-bygge)**
- [ ] 3D-hörna: markörerna poppar upp efter kamerarotationen, ligger ovanför spelarna och är tydligt åtskilda, för båda flaggorna och när laget är borta.
- [ ] 3D-hörna: nickmål, nickräddning (målvakten ska vara vid bollen) och miss.
- [ ] Zoner och Överblick: välj **Själv** på fasta situationer, spela tills en hörna, straff och frispark. Ska visas i 2D. Kolla också Inställningar (kan bytas där).
- [ ] Mobil stående och liggande i 3D: rätt sida, ingen rotera-knapp.
- [ ] Play/forward/paus syns längst ned i mitten när 3D är maximerat.
- [ ] Dag och natt: spela matcher med olika avsparkstid (13:00, 18:00, 20:45) och olika väder.
- [ ] Bollen: inga hopp mot spelare, ingen boll som stannar i luften, rullar vidare efter dålig passning, inkastaren passar inte sig själv, skott utanför går inte genom målet, mål/räddning/miss stämmer med resultatet.
- [ ] Fler skott när laget är inne i straffområdet.
- [ ] Landslag: ta över ett land från Brasilien, Japan, Nigeria, USA och ett europeiskt. Rätt turnering, 16 lag, trofé i albumet.
- [ ] Album: (x/y), fällknapparna. Träning: rubriken. Roller i laget: knappen på samma ställe. Ekonomi: (i) på rubrikraden (visas när ekonomin är i rött).
- [ ] Landslagsknappen visar flaggan.

**Ny matchmotor (tick) – testa i Inställningar > Matchmotor > "Ny (test)"** (se avsnitt 13)
- [ ] Spela en hel match i 2D/Överblick med nya motorn: flyter bilden, ser passningar, dueller, offside och rörelser rimliga ut (inga spelare som står stilla, bollen som fastnar eller hoppar)?
- [ ] Hörnor, frisparkar och straffar: kommer de upp vid rätt plats, kan du ta dem själv, och blir resultatet (mål/räddning/miss) det du ser?
- [ ] Kort/utvisning, byten och skada fungerar som förut; halvtid stannar.
- [ ] **Resultatet du ser = resultatet som räknas** (tabellen efter veckan). Testat automatiskt, men titta även själv.
- [ ] Hur känns det: spelmässigt realistiskt (laget håller formation, press, passningsspel, avslut i rimliga lägen)? Statistiken får vara högre än i verkligheten.
- [ ] Prestanda på mobil: hur lång tid tar det att spela/hoppa till slutet av en match, och veckans övriga matcher?
- [ ] Vill du tillbaka: välj "Standard" i Inställningar > Matchmotor, så används gamla motorn igen.
- [ ] Mobil stående, hörna i 3D: spelarna syns (kameran vinklad). Max zoom i 3D: kameran följer bollhållaren. Maxläge stänger sig själv någon sekund efter slutsignal. Hastighet 1×–3× i Inställningar.

**Nyast (2026-11-10, kräver nytt WebGL-bygge för Unity-delen)**
- [ ] 3D-hörna: nickaren och hans försvarare **hoppar och nickar** (nickklippet spelas, kontakt när bollen kommer). Loggat i labbet att klippet startar för båda; själva utseendet är inte kontrollerat från sidan.
- [ ] Fasta situationer i 3D (straff, frispark, hörna): beskrivningen ("Sikta…", "Välj var…", timing-texten) visas bara **tills du rör skärmen**, sedan döljs den. Tolkat så; säg till om du menade något annat.
- [ ] Maxläge: zoom +/- ligger uppe till vänster (hörnet), kommentar- och publikraden flyttas åt sidan. Play/paus/framåt är mer genomskinliga. Kolla på stående mobil att inget krockar uppe till vänster.

- Zoner på liggande telefon: den vridna liggande varianten blev inte bra och är borttagen. Zoner-brädet är som det var (stående).
- [ ] Överblick: zoom-knappen sitter uppe till vänster (som 3D-zoomen). Alla knappar på planen är genomskinliga som play/pause.

- [ ] **Överblick på stående telefon:** planen ritas stående (ditt lag anfaller uppåt), siffror och namn är läsbara. Liggande telefon som förut. Kontrollera zoom, maxläge, mål-/straffbilder och att man kan trycka på sina spelare.
- [ ] **3D-repris:** tryck Repris efter ett mål: kameran byter vinkel (sidlinje → bakom spelaren → bakom målet → framför målet), knappen **Fortsätt** syns och avslutar repriset, även i maxläge.
- [ ] **3D-effekter:** spela flera matcher i 3D och se om du får cykelsparkar, dyknickar, voltar och krysskott med målvakt som kastar sig och missar. Hörnmål kan också ge dyknick/cykelspark. Rättat: sparkhändelsen till Unity kunde utebli live (snabb match, pass + skott mellan två ritningar) men inte i repris; `MatchViewer.tsx` skickar nu en spark även när en ny boll nuddas under pågående flygning. Kolla att samma mål får samma effekt live och i repris.

**Unity (SampleScene, Play)**
- [ ] Nät på målen, publik rätt väg, frisyrerna (särskilt spiky, ponytail, bun, coils, haaland).
- [ ] Målvakten tittar upp mot planen efter en miss.
- [ ] Bollen slutar snurra vid straffpunkten.

## 10. Öppet och kända brister

- **Replay visar inte territoriet:** motorn ger fler skott inne i rutan, men bilden kan visa laget vid mittlinjen.
- **Motorn kollar inte räckvidd själv** (steg 2): bara visningen byter mottagare. Passningssäkerhet och passningar per match kan inte testas (passningar simuleras inte).
- **Set pieces när bollen är långt borta** kan fortfarande dyka upp enstaka gånger (testet kräver högst ett "forcerat" stopp).
- **Lättade testkrav:** öppna svängar högst 1,2 % av svängarna; utkast/inkast-antal; antal anfallare i rutan; utkast tagna av utespelare om målvakten är borta; målvaktsbyte efter räddning vid utvisning.
- **Hörnor** 6,4 per match mot ~10 i verkligheten (medvetet). 5+ mål lite för vanligt i liga A.
- **Straffläggning** i Zoner är en egen kod och kan skilja sig.
- Frågor som inte besvarats: vad "maximalt läge" för kontrollerna betydde exakt (gjorde dem synliga över 3D-bilden i maxläge).
- Förslag på framtid: steg 2 (spåra spelarpositioner i motorn), sedan en gemensam simulering som både 2D och 3D spelar upp; fatigue som påverkar passningar, press/backlinje/bredd, offside i spelet, fler dueller.

## 11. Filer att känna till

- `src/game/match.ts` (motor + `Replay`), `chances.ts`, `setpieces.ts`, `live.ts`, `national.ts`, `album.ts`, `conditions.ts`.
- `src/ui/MatchViewer.tsx` (visning, `advance`), `SetPieceView.tsx`, `unity3d.ts`, `matchView.ts`, `views/Tournament.tsx`, `views/Album.tsx`, `views/Training.tsx`, `views/Squad.tsx`, `views/Finance.tsx`, `common.tsx` (`FoldButton`, `Hint`).
- Unity (`Assets/Scripts/Forza`): `MatchRoot.cs`, `PlayerView*.cs`, `BallView.cs`, `SetPieceStage.cs`, `Pitch.cs`, `Messages.cs`, `Web.cs`, `Demo.cs`, `Lab/LabRunner.cs`.
- `src/game/tick.ts` (nya tick-motorn), `src/game/tickEngine.test.ts`, `src/ui/BenchPage.tsx` (`#bench`).
- Tester: `npx vitest run` (187 godkända, 1 hoppad vid senaste körning 2026-11-10) och `npx tsc --noEmit -p .`.

## 12. Prototyp: vad kostar en matchsimulering i små steg? (mätt 2026-11-10)

Fristående prototyp i `src/game/proto/` (`tickSim.ts`, mätning i `tickSim.bench.test.ts`; körs bara med `PROTO_OUT=fil npx vitest run src/game/proto`). Den används inte av spelet. 22 spelare + boll, rörelse, separation, bollens flykt, tacklingar, och ett beslut var 0,6:e sekund där passningslinjer kontrolleras mot alla 11 försvarare. "Heavy" = varje spelare söker bättre plats en gång i sekunden. Mätt i Node (V8) på utvecklingsdatorn, 95 matchminuter.

| Variant | Steg | Tid per match (median) |
|---|---|---|
| 4 Hz | 22 800 | 52 ms |
| 5 Hz | 28 500 | 67 ms |
| 10 Hz | 57 000 | 124 ms |
| 5 Hz, heavy | 28 500 | 169 ms |
| 10 Hz, heavy | 57 000 | 237 ms |
| 5 Hz med inspelning (2,7 MB/match) | 28 500 | 80 ms |

- Att titta på en match i realtid: 6 steg per bildruta kostar 0,03 ms (värsta 0,3 ms) mot en budget på 16,7 ms. Inga problem.
- 10 matcher i rad (5 Hz): cirka 0,6 s; 20 matcher cirka 1,3 s på dator. Uppskattat 3–5 gånger så mycket på en mellanklassmobil (ej mätt).
- Samma slumpfrö ger samma match (kontrollerat). Använd inte `Math.sin/cos/hypot` i det som måste vara identiskt mellan webbläsare.
- Prototypen är enklare på vissa sätt (inget riktigt AI-beslutsträd, inga regler) och mer aktiv på andra (cirka 500 skott och 2 000 tacklingar per match); en riktig motor kan kosta 2–4 gånger "heavy".
- Slutsats: vad man tittar på och "hoppa till slutet" går bra (under en sekund på dator), men resten av ligan ska behålla minutmodellen eller köras i en Web Worker.

## 13. Ny matchmotor: tick-motorn (src/game/tick.ts) – kan återställas

**Mål (användarens förtydligande):** statistiken (skott, tacklingar, dribblingar, mål) får gärna vara högre än i verkligheten, det är kul för spelaren. Det som ska vara realistiskt är **spelet**: hur spelarna rör sig, passar, pressar, tacklas, hamnar offside och avslutar.

- **Vad den är:** 22 spelare och bollen simuleras i små steg (5 per sekund, i meter) med bollfysik, beslut var 1–4:e sekund (passa, driva, skjuta), passningar som kan brytas, dueller, offside, fouls/kort, målvakt och fasta situationer. Den sänder samma `Frame`-format som gamla motorn, så visningen (2D och 3D) är oförändrad.
- **Val:** Inställningar > Matchmotor (Standard / Ny (test)). Sparas i `manager2d.engine`, läses till `ENGINE.mode` i `matchView.ts`. Varje match minns sin motor (`LiveMatchState.engine`), så en match som började med en motor räknas om med samma.
- **Standard är gamla motorn.** Återställa = välj Standard (eller sätt `ENGINE.mode = "minute"`). Vill man ta bort motorn helt: ta bort `tick.ts`, `playTick`/`simTeam` i `match.ts`, valet i `Settings.tsx`/`matchView.ts` och `match.engine*` i språkfilerna.
- **Samma regler som förut:** kommandon, byten, skador, trötthet, halvtid, tilläggstid, betyg, straffar/hörnor/frisparkar som användaren kan ta själv (`takeSetPiece(..., at)` + `drawSetPiece`), samma slumpfrö ger samma match.
- **Mätt/justerad (inte i verkligheten, bara balans):** ungefär 3,4 mål, 28 skott och 22 fouls per match efter justering.
- **Tester som körs automatiskt** (`tickEngine.test.ts`): rimlig statistik, determinism (samma frö, samma match med och utan bildrutor), en hel match med set pieces, och att en live-match som användaren spelat räknas **exakt som den visades** (testet sätter `live.manualSubs = false`, som appen gör som standard).
- **Känd skillnad (gäller även gamla motorn):** `LiveMatch` börjar med `manualSubs = true` (användaren byter själv) medan omräkningen i `finishWeek` utgår från att assistenten byter om inga kommandon finns. Appen sätter "auto" som standard (`MatchViewer.tsx`), så det syns bara om man väljer "Själv" och inte gör några byten.
- **Inte gjort än:** prestandaoptimering (ca 0,6 s per match på dator, mobilen ej mätt), fler beteenden (djupledslöpningar, inlägg/nickar, målvaktens utspel), kontroll i riktiga visningen/Unity.
