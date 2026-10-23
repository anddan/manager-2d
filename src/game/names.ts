// Fictional names. Clubs and leagues are invented; player names are random
// first/last name combinations per nationality.

export const NATIONALITIES: Record<string, {first: string[]; last: string[]; weight: number}> = {
  SE: {
    weight: 30,
    first: ["Erik", "Oskar", "Viktor", "Linus", "Emil", "Albin", "Hugo", "Filip", "Anton", "Jonatan", "Melker", "Isak", "Noah", "Ludvig", "Elias", "Axel", "Gustav", "Malte", "Sixten", "Theo"],
    last: ["Lindqvist", "Berglund", "Holmström", "Ekdahl", "Sandvik", "Nyberg", "Åkesson", "Forsberg", "Wallin", "Hedlund", "Sjögren", "Lundmark", "Engström", "Björklund", "Dahlberg", "Strand", "Norén", "Ahlgren", "Granqvist", "Molin"],
  },
  NO: {
    weight: 6,
    first: ["Magnus", "Sindre", "Eirik", "Torbjørn", "Håkon", "Jonas", "Sander", "Kristian", "Even", "Henrik"],
    last: ["Haugland", "Solberg", "Bakken", "Lien", "Myhre", "Rønning", "Fjeld", "Strøm", "Aune", "Vik"],
  },
  DK: {
    weight: 6,
    first: ["Mads", "Rasmus", "Frederik", "Jeppe", "Mikkel", "Anders", "Kasper", "Nikolaj", "Søren", "Lasse"],
    last: ["Kjærgaard", "Holm", "Bech", "Overgaard", "Lund", "Thorsen", "Brandt", "Vestergaard", "Krogh", "Mølgaard"],
  },
  FI: {
    weight: 4,
    first: ["Aleksi", "Joonas", "Eetu", "Lauri", "Tuomas", "Niko", "Ville", "Onni"],
    last: ["Virtanen", "Mäkelä", "Heikkinen", "Laaksonen", "Koskela", "Rantanen", "Salminen", "Lehto"],
  },
  ES: {
    weight: 6,
    first: ["Pablo", "Sergio", "Álvaro", "Iker", "Javier", "Raúl", "Diego", "Marcos", "Adrián", "Rubén"],
    last: ["Navarro", "Ortega", "Delgado", "Castaño", "Herrera", "Molina", "Prieto", "Serrano", "Vidal", "Robles"],
  },
  BR: {
    weight: 5,
    first: ["Thiago", "Rafael", "Lucas", "Matheus", "Gabriel", "Caio", "Bruno", "Vinícius", "Felipe", "Davi"],
    last: ["Albuquerque", "Moraes", "Teixeira", "Barbosa", "Cardoso", "Nogueira", "Rezende", "Pinheiro", "Castro", "Assis"],
  },
  AR: {
    weight: 3,
    first: ["Facundo", "Nahuel", "Tomás", "Gonzalo", "Lautaro", "Franco", "Agustín", "Ezequiel"],
    last: ["Benítez", "Acosta", "Quiroga", "Villalba", "Sosa", "Paredes", "Ledesma", "Ojeda"],
  },
  DE: {
    weight: 5,
    first: ["Jonas", "Lukas", "Felix", "Maximilian", "Niklas", "Tim", "Leon", "Moritz", "Paul", "Jannik"],
    last: ["Hoffmann", "Brenner", "Kessler", "Wagner", "Lindner", "Krause", "Vogt", "Seidel", "Hartmann", "Ziegler"],
  },
  NL: {
    weight: 4,
    first: ["Daan", "Sem", "Thijs", "Jesse", "Bram", "Ruben", "Stijn", "Lars"],
    last: ["de Wit", "Bakker", "Visser", "van Dijkhuis", "Mulder", "Smits", "Hendriks", "van der Berg"],
  },
  GB: {
    weight: 5,
    first: ["Jack", "Harry", "George", "Callum", "Ryan", "Liam", "Jordan", "Connor", "Tyler", "Owen"],
    last: ["Whitmore", "Ashworth", "Fletcher", "Harding", "Pryce", "Holloway", "Barnes", "Kendrick", "Lowe", "Thornton"],
  },
  FR: {
    weight: 4,
    first: ["Théo", "Maxime", "Antoine", "Lucas", "Hugo", "Mathis", "Bastien", "Quentin"],
    last: ["Lefèvre", "Moreau", "Girard", "Rousseau", "Fontaine", "Chevalier", "Marchand", "Dupuis"],
  },
  NG: {
    weight: 4,
    first: ["Chidi", "Emeka", "Tunde", "Samuel", "Kelechi", "Ifeanyi", "Daniel", "Femi"],
    last: ["Okafor", "Adeyemi", "Nwosu", "Balogun", "Eze", "Okonkwo", "Afolabi", "Uche"],
  },
};

export const LEAGUE_NAME = "Nordligan";

/** Invented clubs, strongest first. */
export const CLUB_TEMPLATES: {name: string; short: string; color: string; color2: string}[] = [
  {name: "Stålhamn FF", short: "STÅ", color: "#1d4ed8", color2: "#ffffff"},
  {name: "Kungsvik IF", short: "KUN", color: "#facc15", color2: "#111827"},
  {name: "Norrfjärd BK", short: "NOR", color: "#dc2626", color2: "#ffffff"},
  {name: "Ekbacka AIK", short: "EKB", color: "#111827", color2: "#fbbf24"},
  {name: "Sjöstad United", short: "SJÖ", color: "#0891b2", color2: "#ffffff"},
  {name: "Granbo FC", short: "GRA", color: "#16a34a", color2: "#ffffff"},
  {name: "Björkdal IK", short: "BJÖ", color: "#7c3aed", color2: "#ffffff"},
  {name: "Västerå GoIF", short: "VÄS", color: "#ea580c", color2: "#111827"},
  {name: "Hamnstaden FK", short: "HAM", color: "#0f766e", color2: "#fde68a"},
  {name: "Ravnsund IS", short: "RAV", color: "#be123c", color2: "#111827"},
  {name: "Lillholm SK", short: "LIL", color: "#2563eb", color2: "#fde047"},
  {name: "Fjällvik BoIS", short: "FJÄ", color: "#4b5563", color2: "#ffffff"},
  {name: "Åsträsk FF", short: "ÅST", color: "#65a30d", color2: "#111827"},
  {name: "Myrby IF", short: "MYR", color: "#a16207", color2: "#ffffff"},
];

/** "SE" -> 🇸🇪 */
export function flag(code: string): string {
  return String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}
