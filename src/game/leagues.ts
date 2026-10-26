// The leagues to play in. Apart from the invented Fantasiligan, each is modelled
// on a real league: its biggest clubs, strongest first, in their colours,
// with players mostly from that country. Names are close to the real ones but
// not the same (AC Milan -> FC Milano), since real club and league names are
// trademarks. Every league has 14 clubs.
import {CLUB_TEMPLATES, LEAGUE_NAME} from "./names";

export interface ClubTemplate {
  name: string;
  short: string;
  color: string;
  color2: string;
}

export interface League {
  id: string;
  name: string;
  /** Country flag shown when picking. */
  flag: string;
  /** Most players come from here; missing means the usual Nordic mix. */
  home?: string;
  /** Strongest first. */
  clubs: ClubTemplate[];
}

const club = (name: string, short: string, color: string, color2: string): ClubTemplate => ({name, short, color, color2});

export const LEAGUES: League[] = [
  {id: "nordic", name: LEAGUE_NAME, flag: "SE", clubs: CLUB_TEMPLATES},
  {
    id: "eng",
    name: "English Premier Division",
    flag: "GB",
    home: "GB",
    clubs: [
      club("Manchester Sky FC", "MSK", "#6cabdd", "#ffffff"),
      club("Merseyside Reds", "MER", "#c8102e", "#f6eb61"),
      club("London Gunners FC", "LGU", "#ef0107", "#ffffff"),
      club("Manchester Devils", "MDV", "#da291c", "#fbe122"),
      club("West London Blues", "WLB", "#034694", "#ffffff"),
      club("North London Cockerels", "NLC", "#ffffff", "#132257"),
      club("Tyneside Magpies", "TYN", "#241f20", "#ffffff"),
      club("Birmingham Villans", "BVI", "#670e36", "#95bfe5"),
      club("Brighton Seagulls", "BSG", "#0057b8", "#ffffff"),
      club("East London Irons", "ELI", "#7a263a", "#1bb1e7"),
      club("Merseyside Toffees", "MTO", "#003399", "#ffffff"),
      club("Nottingham Foresters", "NFO", "#dd0000", "#ffffff"),
      club("Black Country Wolves", "BCW", "#fdb913", "#231f20"),
      club("South London Eagles", "SLE", "#1b458f", "#c4122e"),
    ],
  },
  {
    id: "ita",
    name: "Serie Italia",
    flag: "IT",
    home: "IT",
    clubs: [
      club("Milano Nerazzurri", "MNZ", "#010e80", "#ffffff"),
      club("Napoli Partenopei", "NAP", "#12a0d7", "#ffffff"),
      club("FC Milano", "FCM", "#fb090b", "#000000"),
      club("Torino Bianconeri", "TBC", "#ffffff", "#000000"),
      club("Bergamo Nerazzurri", "BER", "#1e71b8", "#000000"),
      club("Roma Giallorossi", "RGR", "#8e1f2f", "#f0bc42"),
      club("Roma Biancocelesti", "RBC", "#87d8f7", "#ffffff"),
      club("Firenze Viola", "FIV", "#482e92", "#ffffff"),
      club("Bologna Rossoblù", "BOL", "#1a2f48", "#a21c26"),
      club("Torino Granata", "TGR", "#8a1e03", "#ffffff"),
      club("Udine Zebrette", "UDI", "#000000", "#ffffff"),
      club("Genova Grifone", "GEN", "#a91e26", "#002d62"),
      club("Sardegna Rossoblù", "SAR", "#002350", "#a6192e"),
      club("Salento Giallorossi", "SAL", "#f9da00", "#d71920"),
    ],
  },
  {
    id: "esp",
    name: "Primera Liga",
    flag: "ES",
    home: "ES",
    clubs: [
      club("Madrid Blancos", "MBL", "#ffffff", "#febe10"),
      club("Barcelona Blaugrana", "BBG", "#a50044", "#004d98"),
      club("Madrid Colchoneros", "MCO", "#cb3524", "#ffffff"),
      club("Bilbao Leones", "BIL", "#ee2523", "#ffffff"),
      club("Villarreal Submarino", "VIL", "#ffe667", "#005187"),
      club("Donostia Txuri-Urdin", "DON", "#0067b1", "#ffffff"),
      club("Sevilla Verdiblancos", "SVB", "#00954c", "#ffffff"),
      club("Sevilla Nervión", "SNE", "#ffffff", "#d4021d"),
      club("Girona Blanquivermells", "GIR", "#cd2534", "#ffffff"),
      club("Valencia Che", "VAL", "#ffffff", "#ee8300"),
      club("Vigo Celestes", "VIG", "#8ac3ee", "#e5254e"),
      club("Pamplona Rojillos", "PAM", "#d91a21", "#0a346f"),
      club("Getafe Azulones", "GET", "#005999", "#ffffff"),
      club("Mallorca Bermellones", "MAL", "#e20613", "#000000"),
    ],
  },
  {
    id: "ger",
    name: "Deutsche Meisterliga",
    flag: "DE",
    home: "DE",
    clubs: [
      club("FC München Rot", "MÜN", "#dc052d", "#ffffff"),
      club("Leverkusen Werkself", "LEV", "#e32221", "#000000"),
      club("Dortmund Schwarzgelb", "DOR", "#fde100", "#000000"),
      club("Leipzig Rasenballer", "LEI", "#dd0741", "#ffffff"),
      club("Stuttgart Schwaben", "STU", "#ffffff", "#e32219"),
      club("Frankfurt Adler", "FRA", "#000000", "#e1000f"),
      club("Freiburg Breisgau", "FRE", "#e2001a", "#000000"),
      club("Sinsheim Kraichgau", "SIN", "#1961b5", "#ffffff"),
      club("Wolfsburg Wölfe", "WOB", "#65b32e", "#ffffff"),
      club("Gladbach Fohlen", "GLA", "#ffffff", "#00b140"),
      club("Bremen Werderaner", "BRE", "#1d9053", "#ffffff"),
      club("Berlin Eiserne", "BER", "#eb1923", "#ffffff"),
      club("Mainz Nullfünfer", "MAI", "#ed1c24", "#ffffff"),
      club("Augsburg Fuggerstädter", "AUG", "#ba3733", "#46714d"),
    ],
  },
  {
    id: "swe",
    name: "Svenska Allserien",
    flag: "SE",
    home: "SE",
    clubs: [
      club("Malmö Himmelsblå", "MHB", "#67b2e8", "#ffffff"),
      club("Hisingen Getingar", "HIS", "#ffd200", "#000000"),
      club("Solna Gnaget", "SOL", "#000000", "#fde100"),
      club("Stockholm Blårandiga", "STB", "#00508c", "#ffd200"),
      club("Söder Bajen", "SÖD", "#00a650", "#ffffff"),
      club("Borås Gulsvart", "BOR", "#ffde00", "#111111"),
      club("Göteborg Blåvitt", "GBV", "#0055a4", "#ffffff"),
      club("Norrköping Peking", "NKP", "#ffffff", "#0055a4"),
      club("Kalmar Röda", "KAL", "#e30613", "#ffffff"),
      club("Uppsala Blåsvart", "UPP", "#003b7a", "#000000"),
      club("Mjällby Blekinge", "MJÄ", "#fdd900", "#000000"),
      club("Halmstad Blåvitt Syd", "HAL", "#0066b3", "#ffffff"),
      club("Göteborg Makrillarna", "GMA", "#00843d", "#000000"),
      club("Värnamo Småland", "VÄR", "#005baa", "#ffffff"),
    ],
  },
  {
    id: "fra",
    name: "Ligue Française",
    flag: "FR",
    home: "FR",
    clubs: [
      club("Paris Rouge-Bleu", "PRB", "#004170", "#da291c"),
      club("Marseille Phocéens", "MAR", "#ffffff", "#2faee0"),
      club("Monaco Princiers", "MON", "#e51b22", "#ffffff"),
      club("Lille Dogues", "LIL", "#e01e13", "#ffffff"),
      club("Lyon Gones", "LYO", "#ffffff", "#1b3c8f"),
      club("Nice Aiglons", "NIC", "#c8102e", "#000000"),
      club("Lens Sang-et-Or", "LEN", "#ffd700", "#c8102e"),
      club("Rennes Rouge-et-Noir", "REN", "#e13327", "#000000"),
      club("Strasbourg Racing", "STR", "#0099d8", "#ffffff"),
      club("Nantes Canaris", "NAN", "#fbe000", "#00843d"),
      club("Toulouse Violets", "TOU", "#5b2d8e", "#ffffff"),
      club("Brest Pirates", "BRE", "#e30613", "#ffffff"),
      club("Montpellier Pailladins", "MTP", "#f58220", "#1b3c8f"),
      club("Reims Champenois", "REI", "#e2001a", "#ffffff"),
    ],
  },
  {
    id: "usa",
    name: "American Soccer League",
    flag: "US",
    home: "US",
    clubs: [
      club("Los Angeles Stars", "LAS", "#00245d", "#ffd200"),
      club("Miami Pink Herons", "MIA", "#f7b5cd", "#231f20"),
      club("Seattle Rain FC", "SEA", "#5d9741", "#005595"),
      club("Atlanta Five Stripes", "ATL", "#80000a", "#a19060"),
      club("New York Bulls", "NYB", "#ed1e36", "#ffffff"),
      club("Columbus Workers", "CLB", "#fedd00", "#000000"),
      club("LA Black and Gold", "LAF", "#000000", "#c39e6d"),
      club("Cincinnati Lions", "CIN", "#f05323", "#263b80"),
      club("Philadelphia Unity", "PHI", "#071b2c", "#b19b69"),
      club("Portland Lumberjacks", "POR", "#004812", "#d69a00"),
      club("Nashville Sound", "NSH", "#ece83a", "#1f1646"),
      club("Kansas City Sporting", "SKC", "#91b0d5", "#002f65"),
      club("New England Rebels", "NER", "#0a2240", "#ce0e2d"),
      club("Austin Oaks", "AUS", "#00b140", "#000000"),
    ],
  },
];

export function leagueById(id: string | undefined): League {
  return LEAGUES.find((l) => l.id === id) ?? LEAGUES[0];
}
