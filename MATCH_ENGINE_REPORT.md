# Matchmotorn: realism-analys (fas 1) och förslag

Underlag: `src/game/match.ts` (1639 rader), `pitch.ts`, `setpieces.ts`, samt en mätning på 182 simulerade matcher (seed 4321, liga med 6 klubbar). Inget är ändrat. Mätfilen är raderad.

## 1. Hur motorn fungerar idag (det allt hänger på)

- Matchen är en **minutsimulering med sannolikheter**, inte en rörelsesimulering. Varje minut har en bollhållare (`holder`). Lagens styrka delas in i tre linjer (försvar, mitt, anfall) via `LINE_WEIGHTS`. Mittfältsstyrkan avgör vem som behåller bollen, anfall mot försvar avgör chansen (`pChance`), skytt mot målvakt avgör mål (`pGoal`).
- **Spelarna finns inte i simuleringen.** Skytten väljs med viktad slumpning efter position (`SHOOTER_WEIGHT`) och finishing. Passare väljs likadant (`ASSIST_WEIGHT`).
- **Replayen byggs efteråt** av klassen `Replay`: en kedja av touchar (pass, dribbling, tackling) som slutar i det utfall som redan avgjorts. Replayen har eget slumpflöde så att man aldrig kan ändra resultatet genom att titta. Det är en viktig begränsning: allt som ska synas i matchen men inte påverka utfallet kan ligga i replayen, men allt som ska *påverka* utfallet måste flyttas in i simuleringen.
- Spelarnas placering på planen är en ren formel (`teamSpot`) av position, bollens läge och om laget har bollen. Inget minne, ingen individ.

## 2. Befintliga system som ska bevaras (och hur de används idag)

| System | Var det sitter idag |
|---|---|
| Attribut (finishing, passing, vision, technique, pace, stamina, defending, physical, goalkeeping) | `effectiveRating`, `shotSkill`, `receiver`, `dribbles`, `throughBall`, `switchPlay` |
| Form, fitness, moral | `FORM_EFFECT` i `shotSkill`, fitness slits varje minut, moral och form uppdateras i `applyMatch` |
| Skador, avstängningar | `injure`, gula/röda kort, gul-räknare (var 5:e gul = avstängning) |
| Taktik | `Mentality` (3 lägen), formationer, egna positioner (`place`/`swap`), 5 spelarinstruktioner (`passing`, `dribbling`, `shooting`, `tackling`, `position`) som också kan ges till hela laget |
| Matchkommandon | byten, instruktion till spelare, instruktion till laget, Forza!, formationsbyte, byte av plats, ny position |
| Egenskaper (traits) | `cool`, `poacher`, `playmaker`, `fragile` |
| Fasta situationer | straff, frispark, hörna, där användaren kan ta över |
| Ekonomi, träning, progression, kemi | rör inte matchmotorn direkt |

Allt detta ska ligga kvar. Förslagen nedan bygger på dem.

## 3. Mätvärden idag mot riktig fotboll

| Mått (per match) | Spelet | Riktig fotboll (ungefär) | Bedömning |
|---|---|---|---|
| Mål | **3,58** | 2,6 till 2,9 | för högt |
| Matcher med 4+ mål | **38 %** | 20 till 25 % | för högt |
| Skott totalt | 19,8 | 24 till 26 | lite lågt |
| Skott på mål | 8,4 (**42 %** av skotten) | 8 till 9 (33 till 35 %) | för stor andel på mål |
| Omvandling skott till mål | **18 %** | 10 till 11 % | för högt |
| Oavgjort | 23 % | 24 till 26 % | ok |
| Hemmaseger / bortaseger | 42 % / 35 % | 44 % / 31 % | ok |
| 0-0 | 12 % | 7 till 8 % | något högt (mycket varians) |
| Röda kort | **0,45** | 0,06 till 0,10 | **5 gånger för högt** |
| Gula kort | 3,2 | 3,5 till 4,0 | ok |
| Straffar | 0,42 | 0,25 till 0,30 | högt |
| Skador i match | 0,76 | 0,1 till 0,2 | högt |
| Byten | 9,0 | 8 till 9 (5 per lag) | ok |
| Hörnor (bara de som blir "fasta situationer") | 3,4 | 9 till 11 | **lågt**, de flesta hörnor saknas |
| Frisparkar nära straffområdet | 1,35 | 2 till 3 | lågt |
| Passningar (bara synliga i replay) | ca 200 | 700 till 900 | replayen visar bara en fjärdedel |
| Starkare lag vinner (skillnad 6+ i laggrad) | **48 %** (67 matcher) | 60 till 70 % | **för jämna matcher, styrka spelar för liten roll** |
| Mål per position | ST 300, W 153, CM 82, FB 36, CB 36, AM 27, DM 18 | ST ca 45 %, mittfält 30 %, kant 15 %, back 8 % | rimligt, kanter lite högt, backar/DM lågt |

Slutsats: matcherna är **för målrika, för många skott träffar mål, för många utvisningar och för jämna** mellan starka och svaga lag.

## 4. Fynd, rangordnade efter påverkan (top 100)

Betyg: **[H]** stor, **[M]** medel, **[L]** liten effekt på upplevd realism.

### A. Matchens struktur och flöde (1 till 15)
1. **[H]** Allt är en slumpad minut i taget utan minne: ingen momentum, inga tryckperioder, inga "faser". Därför blir matchen en rad oberoende händelser.
2. **[H]** Bollen byter hand i snitt oftare än i riktig fotboll (`POSSESSION_KEEP` 0,4 plus andel): spelen upplevs som "fram och tillbaka" (end to end).
3. **[H]** Resultatläge påverkar ingenting: ett lag som leder 2-0 spelar likadant som vid 0-0, och ett lag som ligger under höjer inte tempot.
4. **[H]** Röda kort ändrar nästan inget: 10 mot 11 räknas bara som en spelare borta i linjesumman, laget ändrar inte form, tempo eller risktagande.
5. **[H]** Ingen tidsfaktor i matchen: inget drag att "köra över" mot slutet, ingen slutspurt, inget tidsspel.
6. **[M]** Första kvarten och minuterna efter mål är lika sannolika för chanser som mitt i halvleken. Verkliga matcher har efterskalv efter mål (mer risktagande, mer öppet).
7. **[M]** Efter mål startar nästa minut alltid med avspark av motståndaren men inget mentalt efterspel (moral under match finns inte).
8. **[M]** Ingen "spelförlopp": inga perioder där ett lag dominerar tre fyra minuter i rad.
9. **[M]** Ingen skillnad på matchtyper: derbyn, cupmatcher, bottenstrid spelas likadant (utom att rivalen kan få Forza!).
10. **[M]** Halvtidspausen ger ingen återhämtning och ingen taktisk justering från datorlaget.
11. **[M]** Datorlaget gör aldrig taktiska ändringar (formation, mentalitet) under matchen, bara byten efter minut 58.
12. **[M]** Tilläggstid sätts efter händelser, men har ingen inverkan på hur laget spelar (inget "sista anfall").
13. **[L]** Alla matcher har samma tempo oavsett lag.
14. **[L]** Det finns ingen vädereffekt eller planeffekt (finns heller inte i spelet i övrigt).
15. **[L]** Publiken påverkar inte spelet i matchen (bara intäkterna).

### B. Bollinnehav och omställningar (16 till 30)
16. **[H]** Innehav styrs av mittfältet med en kraft (`POSSESSION_POWER` 2,2), men *kontringar* finns inte som begrepp: ett lag som ger bort bollen högt upp får ingen straffad omställning.
17. **[H]** Presspress finns inte: laget som tappar bollen "pressar" aldrig tillbaka, återvinning styrs av en enda siffra.
18. **[H]** Innehavslag och spelstil är samma sak: ett defensivt lag med kontringsspelare kan inte skilja sig från ett attackerande med kortpassningsspelare mer än via `MENTALITY`.
19. **[M]** Passkedjorna i replayen är slumpade och inte kopplade till de som skapade chansen: "vem som gjorde målet" följer inte spelet innan.
20. **[M]** Alla bollförluster är likadana (slumpad vinnare i närheten, `winner`/`nearest`), ingen skillnad på felpass, tackling och brytning.
21. **[M]** Bollförlust i egen straffomårdesnära zon straffas inte hårdare än mitt på plan.
22. **[M]** Målvakter spelar ut kort eller långt efter formel, men kontringsutspel som går direkt på ytterforward finns bara som "lång boll".
23. **[M]** Inga inkast som taktiskt hjälpmedel; inkast sker som slumpad utgång (`THROW_IN_CHANCE`).
24. **[M]** Inga avslutade anfall med "tålamod" (spel runt området utan skott): replayen fyller tomma minuter med slumpade sidoförflyttningar.
25. **[L]** Spelskifte (`switchPlay`) är sällsynt (5 % plus vision/900) och sker bara från back, defensiv eller central mittfältare.
26. **[L]** Pressade pass, vändningar och bakåtpassar finns bara i begränsad form.
27. **[L]** Ingen skillnad på hemma- och bortaspel i hur laget spelar (bara 2 % styrka).
28. **[L]** Utrymme bakom backlinjen finns inte som begrepp, vilket gör genombrott slumpmässiga.
29. **[L]** Offsidefällor finns inte (bara ogiltigförklarade mål, 7 %).
30. **[L]** Inga målvaktsmisstag eller lösa bollar (retur efter räddning).

### C. Chanser och avslut (31 till 50)
31. **[H]** Målproduktionen är för hög: 3,6 mål och 18 % omvandling. Främst `GOAL_BASE` (0,22) kombinerat med att 42 % av skotten hamnar på mål.
32. **[H]** Alla skott har samma kvalitet: ingen xG. Ett skott från 25 meter och ett ensamt avslut i straffområdet räknas lika i utfallet; skillnaden skapas först i replayen.
33. **[H]** Skottplatsen avgörs *efter* utfallet (`longPlan`, `fromDistance`), så utfallet beror inte på var skottet tas.
34. **[H]** Målvakten har ingen individuell prestanda i situationen: `def.gk` är bara ett värde, inga reflexer/positionering/hög boll/en mot en.
35. **[H]** Röda kort 5 gånger för många (0,45 per match): `0.04 * (foulsDef + foulsAtt)` per minut plus 3 % rakt rött och rött vid andra gult.
36. **[M]** Skytt väljs bland alla på planen med positionsvikt (`SHOOTER_WEIGHT`). En back kan skjuta mer än rimligt i vissa lägen och en forward kan "försvinna" från matchen.
37. **[M]** Assist väljs efter utfallet (75 % av målen) och inte från speluppbyggnaden.
38. **[M]** Det finns inget som heter "stor chans" i data: inga lägen med målvakten utmanövrerad, ingen skillnad på halvchans och heldrag.
39. **[M]** Utanför-skott och sparkar från distans får inte lägre målchans.
40. **[M]** Blockerade skott och räddningar av backar saknas i öppet spel (bara vid frispark).
41. **[M]** Hörnor: bara 3,4 per match blir till spelbara hörnor. Riktiga matcher har tre gånger fler; alla hörnor syns inte i statistiken.
42. **[M]** Frisparkar nära straffområdet sällsynta (1,35); frisparkar på mitten finns inte alls som händelse.
43. **[M]** Straffar 0,42/match högt; straff beror på `PENALTY_RATE * ratio * sqrt(rough)` utan att kopplas till vem som blev fälld.
44. **[M]** Fouls som inte ger kort finns inte som händelser (ingen frispark på mitten, ingen domarlinje).
45. **[M]** Domaren är ofelbar: inga felbedömningar, ingen fördelsregel, ingen varning före kort.
46. **[L]** Mål i tilläggstid är inte vanligare än andra tider.
47. **[L]** Mål på hörnor (5 %) styrs av `resolveCorner`, men huvudspelare väljs utan längd/hoppstyrka.
48. **[L]** Skytt kan alltid vara samma spelare med låg kvalitet utan konsekvens för laget.
49. **[L]** Egna mål saknas.
50. **[L]** Utvisade spelares lag förlorar inte formation eller ger inga tydliga luckor.

### D. Spelarnas egenskaper syns inte (51 till 70)
51. **[H]** `pace` påverkar bara hur långt dribblingen går och valet av löpare i genombrott. En snabb ytter springer inte ifrån någon i replayen: alla rör sig med samma formel (`teamSpot`).
52. **[H]** `passing`/`vision` påverkar valet av mottagare men inte *kvaliteten* på chansen: ingen genombrytande passning skapar en chans som en genomsnittlig spelare inte kunnat skapa.
53. **[H]** `finishing` påverkar skottskicklighet men moderat: lagets chanser skiljer sig lite mellan en elitforward och en medelforward (spridningen i `shotSkill` är liten mot variansen).
54. **[H]** `positioning`/`decision making` finns inte som egenskaper i datat. Smarta spelare kan inte synas på bättre platser.
55. **[H]** Spelarens rörelse är inte individuell: alla ett lags spelare följer samma formel för bollen, så ingen "hittar ytor" eller gör egna lopp.
56. **[M]** `defending` påverkar bara försvarslinjen som helhet; ingen enskild back syns bryta, täcka eller vinna dueller.
57. **[M]** `physical` används inte i kamper, hörnor eller skydd av boll.
58. **[M]** `technique` påverkar mest val av dribblingar.
59. **[M]** `stamina` påverkar fitnessförlusten men syns inte i hur spelaren rör sig sent i matchen.
60. **[M]** Traits (`cool`, `poacher`, `playmaker`, `fragile`) ger små matematiska tillägg, men inget som syns.
61. **[M]** Målvaktens `goalkeeping` påverkar `gk`, men räddningens svårighet (placerat skott mot rakt skott) syns inte.
62. **[M]** Form och moral har effekt, men spelaren "ser" inte annorlunda ut i matchen.
63. **[M]** Statistik per spelare är betyg plus händelser: inga passningar, dueller eller löpningar, så man kan inte *se* varför någon är världsklass.
64. **[M]** En världsklass-spelare skiljer sig i betyg men inte i hur många gånger han är inblandad i målen.
65. **[L]** Ledarskap/kapten finns som markering men påverkar inget.
66. **[L]** Egenskapen "bollsäkerhet" finns inte (tappar bollen med samma sannolikhet).
67. **[L]** Ingen skillnad på starkare/svagare fot.
68. **[L]** Ingen skillnad på fysiskt tryck/press hos spelare.
69. **[L]** Anfallare "plundrar" inte målvaktens misstag.
70. **[L]** Kreativa spelare syns inte i uppspelen om de inte är AM.

### E. Taktik och kommandon (71 till 85)
71. **[H]** Lagets bredd, pressnivå, kompakthet, linjehöjd och tempo finns inte som taktikinställningar. Bara `Mentality` (±8 till 9 % på försvar/anfall) och formation.
72. **[H]** Matchkommandon saknar **tempo, mentalitet under match, press, tidsspel**. Tillgängliga är byten, spelarinstruktion (5 st), lagsinstruktion (5 st), Forza!, formation, platsbyte.
73. **[H]** Instruktionernas effekt är små multiplikatorer (1,04 till 1,8) på linjer eller skott, utan tydlig synlig effekt i replayen. Ett lag som får "tackla hårt" syns mest som fler kort.
74. **[H]** Formationer skiljer sig i `slots` (var spelarna står) men effekten i simuleringen går via linjevikterna; en 3-5-2 och en 4-4-2 spelar nästan likadant.
75. **[M]** `position`-instruktionen flyttar spelaren sex enheter i djupled (`push * 6`); bredden ändras inte.
76. **[M]** Kontring, högt press, lågt block och possession är inte egna stilar; det finns bara en spelstil.
77. **[M]** Mentalitet ändras inte under match (den ligger på klubben), och datorn ändrar den aldrig.
78. **[M]** Ingen "tidsspel": man kan inte hålla bollen när man leder.
79. **[M]** Spelare kan inte byta roll under match (kantspelare som går in i banan) förutom `place`.
80. **[M]** Hörnstrategi (kort/nära/bortre) finns bara för användaren; datorn väljer slumpmässigt.
81. **[M]** Instruktionsändringar syns inte som markerad händelse i spelets tolkning ("laget pressar högre").
82. **[L]** `MENTALITY` är symmetriskt: försvarsläge ger +8 % försvar, −10 % anfall, utan tempoeffekt.
83. **[L]** Spelare med instruktioner tröttas mer men det är det enda priset.
84. **[L]** Bytena av datorn är enbart trötthetsbaserade, inte taktiska (ingen inbytt forward vid underläge).
85. **[L]** Kapten kan inte ge instruktioner eller ändra stämning.

### F. Statistisk realism (86 till 93)
86. **[H]** För många mål (3,58) och för hög omvandling (18 %).
87. **[H]** Starkare lag vinner bara 48 % vid stor styrkeskillnad, för slumpartat; `CHANCE_POWER`, `POSSESSION_POWER` och 0,3 bas ger för lite skillnad.
88. **[H]** Röda kort 0,45 per match.
89. **[M]** Hörnor och frisparkar för få; antal skott något låga men andelen på mål för hög.
90. **[M]** Passningar i replay (ca 200) är en fjärdedel av riktiga matcher; passningsprocent finns inte som statistik.
91. **[M]** Innehav följer minutfördelning men spelar ingen roll för chanser per innehav (innehav ger inte "tålamodsanfall").
92. **[M]** Skador per match 0,76 är höga, men de är betydelsefulla för speldjupet; justera sannolikheten ned, behåll `fragile`/slitage.
93. **[L]** Spridningen mellan matcher (variansen) är för hög för små lag mot stora: många överraskningar.

### G. Visuell realism (replay och 3D) (94 till 100)
94. **[H]** Replayen är konstruerad efter utfallet. Det finns ingen tydlig koppling mellan taktik, spelare och det som visas.
95. **[M]** Spelarnas position (`teamSpot`) är samma formel för alla, ingen individuell rörelse, inga djupledslöpningar eller täckande rörelser.
96. **[M]** Ingen tydlig skillnad mellan press, lågt block och uppflyttning, eftersom bredd/linjehöjd inte är parametrar.
97. **[M]** 3D-vyn får bara positioner och händelser, och animerar snabba spelare likadant som långsamma (animationshastigheten följer fart, ok, men maxfart är lika).
98. **[L]** Bollens rörelse i flykt och tidsfördröjning mellan händelser är approximationer.
99. **[L]** Supportrar/bänk/domare saknas i 3D.
100. **[L]** Inga repriser eller markeringar för "varför det blev mål" (passningen som bröt linjen).

## 5. Föreslagna ändringar (inget är gjort ännu)

Principer: behåll alla system i avsnitt 2, behåll determinismen (samma seed och samma kommandon ger samma match), ändra **ingen** datastruktur som sparas utan att migrera, lägg nya fält som valfria.

**Steg 1: kalibrering (liten risk, stor effekt)**
- Sänk `GOAL_BASE` och andelen skott på mål (`pOnTarget`), höj skottantalet något. Mål per match ned till 2,7 till 3,0, omvandling ca 11 till 12 %.
- Rött kort: sänk grundfrekvensen, så ca 0,08 per match; behåll att hårda tacklingar ger fler.
- Höj hörnor och frisparkar (`CORNER_RATE`, `FREEKICK_RATE`); sänk straffar något och skador något.
- Öka styrkans genomslag så att starkare lag vinner ca 62 til 68 % vid stor skillnad.
- Verifiering: samma mätskript över 2 000 matcher, plus att befintliga tester (`simulation`, `forza`, `finishing`, `fouls`) går igenom.

**Steg 2: matchtillstånd och momentum (medel risk)**
- Ett litet tillstånd per lag: momentum (ökar efter mål, press, chanser; avtar), risktagande (resultat och minut), och tempo. Det styr `pChance`, innehav och omställning. Allt är bundet till befintliga multiplikatorer så att balansen går att mäta.
- Efterskalv efter mål, slutspurt, tidsspel och reaktion på rött kort.

**Steg 3: chanskvalitet (xG) och omställningar (medel risk)**
- Varje chans får en kvalitet (läge, avstånd, hur den skapades) som bestäms *i simuleringen*. Skytt, passare och skapare väljs innan replayen byggs, så replayen visar det som hände.
- Kontringar: en bollvinst högt upp ger en särskild anfallstyp där `pace` och `vision` väger tungt.

**Steg 4: attribut som syns (medel till hög risk)**
- Egna fältvärden räknas fram från befintliga attribut (positionering och beslutsfattande från vision/teknik/erfarenhet, så ingen ny sparad data krävs).
- Snabba spelare tar fler djupledslöpningar och vinner fler kapplöpningar, bra passare skapar fler stora chanser, bra målvakter räddar fler "stora chanser", smarta spelare hittar bättre ytor. Statistik per spelare (passningar, nyckelpassningar, dueller) som visas efter match.

**Steg 5: taktik och kommandon (medel risk, UI-ändring)**
- Nya lagparametrar (valfria, standard som idag): linjehöjd, bredd, press, tempo, kompakthet. Mentalitet ändras under match. Nya kommandon: tempo, press, mentalitet, tidsspel.
- Varje kommando får en tydlig effekt i både siffror och rörelse (replay/3D), och en rad i matchfeeden: "Laget pressar högre".
- Datorlaget gör taktiska ändringar (leder, ligger under, rött kort).

**Steg 6: visuellt (låg till medel risk)**
- `teamSpot` får parametrar för linjehöjd, bredd och press; individuella rörelser per spelare (löpningar, täckning). Replayen bygger på simuleringens kedja i stället för ny slump.
- 3D: animationer får olika hastighet per spelare efter pace, och event (nyckelpassning, tackling) markeras.

## 6. Förväntad förbättring
- Statistik nära riktig fotboll (mål, skott, kort, hörnor).
- Starkare lag vinner oftare, men upsets finns kvar.
- Matcher har faser och vändpunkter. Man kan se *varför* en viss spelare är bra.
- Kommandon har omedelbar, synlig effekt.

## 7. Riskbedömning
| Risk | Nivå | Åtgärd |
|---|---|---|
| Balansen i hela spelet (liga, ekonomi, belöningar bygger på dagens målsnitt) | Hög | Kalibrera först; mät före och efter; behåll interna mål per match inom ±0,2 mot dagens mål där det inte är fel |
| Determinism och sparade matcher (sparfiler, repriser, liveMatch) | Hög | Nya fält valfria; replay behåller eget slumpflöde; versionsnummer och migrering vid ändrade händelsetyper |
| Befintliga tester (`simulation`, `fouls`, `finishing`, `setpieces`, `replay`, `timing`) | Medel | Kör hela svit efter varje steg; uppdatera medvetet bara de som mäter siffror vi ändrar |
| 3D-vyn och webben får nya händelser | Medel | Behåll meddelandeformatet, lägg till fält |
| Prestanda (matcher på alla lag i en vecka) | Låg till medel | Håll simuleringen minutbaserad; ingen fysik per bild |
| Spelardjup och individualitet | Låg | Allt nytt bygger vidare på befintliga attribut, inget förenklas |

## 8. Förslag på nästa steg
Börja med steg 1 (kalibrering) eftersom det är litet, mätbart och ger direkt effekt. Steg 2 till 6 görs en i taget, med mätning och tester efter varje.
