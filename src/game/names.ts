// Fictional names. Clubs and leagues are invented; player names are random
// first/last name combinations per nationality.

/** `first` are men's first names, `female` women's. */
export const NATIONALITIES: Record<string, {first: string[]; female: string[]; last: string[]; weight: number}> = {
  SE: {
    weight: 30,
    female: ["Elsa", "Alva", "Maja", "Ebba", "Wilma", "Saga", "Agnes", "Ella", "Freja", "Klara", "Tilde", "Ida", "Hanna", "Linnea", "Stina", "Moa", "Nellie", "Vera", "Signe", "Astrid", "Alice", "Olivia", "Selma", "Julia", "Ellen", "Märta", "Elvira", "Juni", "Ronja", "Tyra", "Lova", "Edith", "Ines", "Frida", "Matilda"],
    first: ["Erik", "Oskar", "Viktor", "Linus", "Emil", "Albin", "Hugo", "Filip", "Anton", "Jonatan", "Melker", "Isak", "Noah", "Ludvig", "Elias", "Axel", "Gustav", "Malte", "Sixten", "Theo", "William", "Liam", "Lucas", "Oliver", "Adam", "Alexander", "Vincent", "Leo", "Charlie", "Olle", "Nils", "Arvid", "Wilmer", "Ebbe", "Love", "Sigge", "Jesper", "Rasmus", "Simon", "Max"],
    last: ["Lindqvist", "Berglund", "Holmström", "Ekdahl", "Sandvik", "Nyberg", "Åkesson", "Forsberg", "Wallin", "Hedlund", "Sjögren", "Lundmark", "Engström", "Björklund", "Dahlberg", "Strand", "Norén", "Ahlgren", "Granqvist", "Molin", "Lindgren", "Bergström", "Sundberg", "Hellström", "Lundqvist", "Wikström", "Fransson", "Sandberg", "Blom", "Lindholm", "Ekström", "Söderberg", "Nordin", "Holmberg", "Lindblom", "Hedberg", "Åberg", "Sjöberg", "Öberg", "Falk", "Lundin", "Berg", "Ström", "Hammar", "Wahlberg", "Lindahl", "Edlund", "Nordqvist", "Rosén", "Eklund", "Hagström", "Westerlund", "Sundin", "Boström", "Malmberg", "Lindberg", "Nyström", "Ek", "Månsson", "Byström", "Törnqvist", "Ljung", "Frisk", "Lövgren", "Asplund", "Gran", "Hallberg", "Kvist", "Ståhl", "Wennberg"],
  },
  NO: {
    weight: 6,
    female: ["Ingrid", "Sigrid", "Tuva", "Nora", "Hedda", "Thea", "Mathilde", "Ingeborg", "Synne", "Live", "Emilie", "Maren", "Silje", "Ragnhild", "Guro", "Marte", "Vilde", "Frida", "Karoline", "Tiril"],
    first: ["Magnus", "Sindre", "Eirik", "Torbjørn", "Håkon", "Jonas", "Sander", "Kristian", "Even", "Henrik", "Sigurd", "Vegard", "Ola", "Kjetil", "Martin", "Fredrik", "Andreas", "Tobias", "Mathias", "Aksel", "Brage", "Joakim", "Stian", "Ruben", "Halvor"],
    last: ["Haugland", "Solberg", "Bakken", "Lien", "Myhre", "Rønning", "Fjeld", "Strøm", "Aune", "Vik", "Haugen", "Moen", "Berntsen", "Dahl", "Halvorsen", "Eide", "Nygård", "Brekke", "Sæther", "Lunde", "Holm", "Tangen", "Hovland", "Aasen", "Kvamme", "Sandnes", "Ruud", "Bjørge", "Engen", "Furuseth", "Grønli", "Østby", "Hagen", "Skogen", "Tveit"],
  },
  DK: {
    weight: 6,
    female: ["Freja", "Ida", "Sofie", "Laura", "Signe", "Emma", "Karoline", "Nanna", "Pernille", "Mathilde", "Sara", "Line", "Josefine", "Cecilie", "Maja", "Astrid", "Klara", "Rikke", "Mette", "Liva"],
    first: ["Mads", "Rasmus", "Frederik", "Jeppe", "Mikkel", "Anders", "Kasper", "Nikolaj", "Søren", "Lasse", "Mathias", "Jonas", "Emil", "Magnus", "Oliver", "Christian", "Simon", "Andreas", "Viktor", "Malthe", "Tobias", "Mikael", "Jesper", "Kristoffer", "Asger"],
    last: ["Kjærgaard", "Holm", "Bech", "Overgaard", "Lund", "Thorsen", "Brandt", "Vestergaard", "Krogh", "Mølgaard", "Dalsgaard", "Nørgaard", "Bundgaard", "Lykke", "Damsgaard", "Højbjerg", "Skov", "Nygaard", "Kjeldsen", "Bisgaard", "Frost", "Juhl", "Toft", "Østergaard", "Winther", "Lauritsen", "Kirkegaard", "Søndergaard", "Bruun", "Kristiansen", "Mikkelsen", "Riis", "Sloth", "Agger", "Rytter"],
  },
  FI: {
    weight: 4,
    female: ["Aino", "Eveliina", "Venla", "Siiri", "Ella", "Linnea", "Iida", "Emilia", "Aada", "Pihla", "Helmi", "Eerika", "Oona", "Sanni", "Veera", "Kaisa", "Noora", "Ronja"],
    first: ["Aleksi", "Joonas", "Eetu", "Lauri", "Tuomas", "Niko", "Ville", "Onni", "Eino", "Leevi", "Juho", "Teemu", "Mikko", "Antti", "Jesse", "Roope", "Santeri", "Otto", "Valtteri", "Matias"],
    last: ["Virtanen", "Mäkelä", "Heikkinen", "Laaksonen", "Koskela", "Rantanen", "Salminen", "Lehto", "Korhonen", "Nieminen", "Mäkinen", "Hämäläinen", "Laine", "Koskinen", "Järvinen", "Lehtonen", "Saarinen", "Niemi", "Kinnunen", "Ahonen", "Hakala", "Lindroos", "Karjalainen", "Peltonen", "Väisänen", "Kallio", "Aaltonen", "Tikkanen", "Raitala", "Pohjanpalo"],
  },
  ES: {
    weight: 6,
    female: ["Lucía", "Alba", "Irene", "Paula", "Aitana", "Laia", "Marta", "Olga", "Nerea", "Claudia", "Ainhoa", "Carmen", "Elena", "Sara", "Teresa", "Leire", "Noelia", "Andrea", "Mariona", "Rocío"],
    first: ["Pablo", "Sergio", "Álvaro", "Iker", "Javier", "Raúl", "Diego", "Marcos", "Adrián", "Rubén", "Hugo", "Daniel", "Alejandro", "Mario", "Jorge", "Carlos", "Íñigo", "Unai", "Gonzalo", "Víctor", "Aitor", "Borja", "Mikel", "Fernando", "Nacho", "Jaime", "Óscar"],
    last: ["Navarro", "Ortega", "Delgado", "Castaño", "Herrera", "Molina", "Prieto", "Serrano", "Vidal", "Robles", "García", "Martínez", "López", "Sánchez", "Romero", "Torres", "Ruiz", "Gil", "Morales", "Ramos", "Iglesias", "Medina", "Cortés", "Garrido", "Santos", "Rubio", "Marín", "Domínguez", "Vega", "Cano", "Pascual", "Lozano", "Fuentes", "Carrasco", "Aguado", "Soler"],
  },
  BR: {
    weight: 5,
    female: ["Ana", "Beatriz", "Larissa", "Gabriela", "Júlia", "Marta", "Bruna", "Kerolin", "Camila", "Luana", "Fernanda", "Tainá", "Débora", "Raquel", "Letícia", "Isabela", "Yasmim", "Adriana"],
    first: ["Thiago", "Rafael", "Lucas", "Matheus", "Gabriel", "Caio", "Bruno", "Vinícius", "Felipe", "Davi", "Rodrigo", "Gustavo", "Igor", "Renan", "Leandro", "Diego", "Murilo", "Enzo", "Arthur", "Pedro", "João", "Wesley", "Everton", "Danilo"],
    last: ["Albuquerque", "Moraes", "Teixeira", "Barbosa", "Cardoso", "Nogueira", "Rezende", "Pinheiro", "Castro", "Assis", "Silva", "Santos", "Oliveira", "Souza", "Ribeiro", "Carvalho", "Almeida", "Lima", "Araújo", "Fernandes", "Rocha", "Mendes", "Freitas", "Monteiro", "Cavalcanti", "Batista", "Duarte", "Ramos", "Vieira", "Correia", "Brandão", "Coelho"],
  },
  AR: {
    weight: 3,
    female: ["Florencia", "Agustina", "Sofía", "Milagros", "Lucía", "Camila", "Micaela", "Valentina", "Romina", "Yamila", "Daiana", "Belén", "Natalia", "Abril"],
    first: ["Facundo", "Nahuel", "Tomás", "Gonzalo", "Lautaro", "Franco", "Agustín", "Ezequiel", "Matías", "Nicolás", "Julián", "Emiliano", "Thiago", "Joaquín", "Santiago", "Bautista", "Leandro", "Rodrigo", "Maximiliano", "Valentín"],
    last: ["Benítez", "Acosta", "Quiroga", "Villalba", "Sosa", "Paredes", "Ledesma", "Ojeda", "Fernández", "González", "Rodríguez", "Gómez", "Díaz", "Romero", "Álvarez", "Pereyra", "Medina", "Godoy", "Cabrera", "Aguirre", "Ríos", "Molina", "Peralta", "Correa", "Figueroa", "Luna", "Ponce", "Arias"],
  },
  DE: {
    weight: 5,
    female: ["Lena", "Lea", "Alexandra", "Giulia", "Sophie", "Svenja", "Klara", "Marina", "Laura", "Jule", "Lina", "Mia", "Hannah", "Anna", "Johanna", "Felicitas", "Sydney", "Merle", "Paulina", "Nicole"],
    first: ["Jonas", "Lukas", "Felix", "Maximilian", "Niklas", "Tim", "Leon", "Moritz", "Paul", "Jannik", "Florian", "Tobias", "Sebastian", "Kai", "Marco", "Julian", "Benedikt", "Lennart", "Fabian", "Philipp", "Simon", "Robin", "Malte", "Erik", "Kevin"],
    last: ["Hoffmann", "Brenner", "Kessler", "Wagner", "Lindner", "Krause", "Vogt", "Seidel", "Hartmann", "Ziegler", "Schmitt", "Becker", "Schulz", "Koch", "Richter", "Klein", "Wolf", "Schröder", "Neumann", "Schwarz", "Zimmermann", "Braun", "Hofmann", "Lange", "Werner", "Krüger", "Lehmann", "Köhler", "Frank", "Weber", "Haas", "Bauer", "Dietrich", "Engel", "Fuchs", "Pohl"],
  },
  NL: {
    weight: 4,
    female: ["Lieke", "Vivianne", "Jill", "Daniëlle", "Sanne", "Esmee", "Femke", "Lineth", "Jackie", "Merel", "Dominique", "Lisa", "Romée", "Victoria", "Jesse", "Kika"],
    first: ["Daan", "Sem", "Thijs", "Jesse", "Bram", "Ruben", "Stijn", "Lars", "Jurriën", "Teun", "Joris", "Wout", "Niels", "Bas", "Koen", "Sven", "Luuk", "Tijmen", "Milan", "Jelle"],
    last: ["de Wit", "Bakker", "Visser", "van Dijkhuis", "Mulder", "Smits", "Hendriks", "van der Berg", "de Jong", "Jansen", "de Vries", "van den Heuvel", "Dekker", "Brouwer", "Meijer", "de Graaf", "Kuipers", "Vermeulen", "van Leeuwen", "Bosman", "Peters", "Verhoeven", "de Boer", "Koster", "Prins", "van Dam", "Huisman", "Willems"],
  },
  GB: {
    weight: 5,
    female: ["Lucy", "Millie", "Ella", "Chloe", "Lauren", "Alessia", "Georgia", "Jess", "Beth", "Keira", "Leah", "Rachel", "Mary", "Hannah", "Amelia", "Grace", "Freya", "Niamh"],
    first: ["Jack", "Harry", "George", "Callum", "Ryan", "Liam", "Jordan", "Connor", "Tyler", "Owen", "James", "Oliver", "Charlie", "Alfie", "Mason", "Jamie", "Ben", "Kieran", "Declan", "Reece", "Luke", "Danny", "Joe", "Sam"],
    last: ["Whitmore", "Ashworth", "Fletcher", "Harding", "Pryce", "Holloway", "Barnes", "Kendrick", "Lowe", "Thornton", "Walsh", "Cooper", "Turner", "Hughes", "Wright", "Marshall", "Gibbs", "Palmer", "Ward", "Bennett", "Hale", "Sutton", "Doherty", "Lockwood", "Pickering", "Woodward", "Brooks", "Haynes", "Carver", "Ellison", "Dawson", "Shaw"],
  },
  FR: {
    weight: 4,
    female: ["Wendie", "Kadidiatou", "Grace", "Clara", "Léa", "Manon", "Sakina", "Inès", "Amandine", "Eugénie", "Marie", "Camille", "Chloé", "Pauline", "Élise", "Selma", "Maëlle", "Delphine"],
    first: ["Théo", "Maxime", "Antoine", "Lucas", "Hugo", "Mathis", "Bastien", "Quentin", "Julien", "Nicolas", "Thomas", "Romain", "Kylian", "Florian", "Clément", "Benjamin", "Raphaël", "Adrien", "Louis", "Enzo", "Yanis", "Ousmane", "Corentin"],
    last: ["Lefèvre", "Moreau", "Girard", "Rousseau", "Fontaine", "Chevalier", "Marchand", "Dupuis", "Laurent", "Mercier", "Bonnet", "Lambert", "Faure", "Garnier", "Perrin", "Roussel", "Martin", "Bernard", "Dubois", "Durand", "Leroy", "Morel", "Simon", "Michel", "Lemaire", "Blanchard", "Gauthier", "Barbier", "Renard", "Brunet", "Caron", "Picard", "Masson", "Leclerc"],
  },
  US: {
    weight: 3,
    female: ["Ashley", "Megan", "Taylor", "Madison", "Kayla", "Brooke", "Jordan", "Haley", "Sophia", "Riley", "Mallory", "Kelley", "Lindsey", "Trinity", "Naomi", "Emily", "Savannah", "Alyssa"],
    first: ["Tyler", "Brandon", "Cody", "Austin", "Hunter", "Mason", "Logan", "Carter", "Wyatt", "Chase", "Jackson", "Landon", "Jayden", "Connor", "Bryce", "Gavin", "Dylan", "Caleb", "Colton", "Travis", "Zach", "Kyle"],
    last: ["Walker", "Bennett", "Hayes", "Sullivan", "Brooks", "Coleman", "Reed", "Patterson", "Griffin", "Hughes", "Russell", "Foster", "Miller", "Carter", "Parker", "Morgan", "Cooper", "Bailey", "Howard", "Ward", "Simmons", "Bryant", "Jenkins", "Powell", "Perry", "Barrett", "Holt", "Dalton", "Fisher", "Graham"],
  },
  IT: {
    weight: 3,
    female: ["Giulia", "Sara", "Martina", "Chiara", "Valentina", "Elisa", "Cristiana", "Barbara", "Arianna", "Manuela", "Federica", "Alice", "Aurora", "Beatrice", "Elena", "Francesca", "Laura", "Benedetta"],
    first: ["Lorenzo", "Matteo", "Alessandro", "Federico", "Davide", "Nicolò", "Giacomo", "Riccardo", "Simone", "Andrea", "Marco", "Luca", "Francesco", "Gianluca", "Stefano", "Tommaso", "Filippo", "Daniele", "Antonio", "Giovanni", "Emanuele", "Pietro", "Mattia"],
    last: ["Bianchi", "Esposito", "Ferrara", "Galli", "Lombardi", "Moretti", "Rinaldi", "Conti", "Marchetti", "Fontana", "Rossi", "Russo", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Costa", "Giordano", "Mancini", "Rizzo", "Barbieri", "Caruso", "Ferri", "Testa", "Villa", "Martini", "Leone", "Serra", "Bellini", "Pellegrini"],
  },
  NG: {
    weight: 4,
    female: ["Asisat", "Rasheedat", "Chiamaka", "Michelle", "Ifeoma", "Uchenna", "Halimat", "Ngozi", "Toni", "Esther", "Chinwendu", "Gift", "Blessing", "Peace", "Folake"],
    first: ["Chidi", "Emeka", "Tunde", "Samuel", "Kelechi", "Ifeanyi", "Daniel", "Femi", "Victor", "Ahmed", "Moses", "Joseph", "Wilfred", "Ademola", "Taiwo", "Kenneth", "Chukwuemeka", "Olamide", "Ebuka", "Musa"],
    last: ["Okafor", "Adeyemi", "Nwosu", "Balogun", "Eze", "Okonkwo", "Afolabi", "Uche", "Okoro", "Adebayo", "Nwankwo", "Obi", "Iwobi", "Onyeka", "Ndidi", "Chukwu", "Ogunleye", "Akinola", "Ibe", "Ekong", "Lawal", "Bello", "Onuoha", "Ajayi", "Okeke", "Ugwu", "Ojo", "Ezeh"],
  },
};

export const LEAGUE_NAME = "Fantasiligan";

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
