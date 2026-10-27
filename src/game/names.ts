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
  PT: {
    weight: 4,
    female: ["Ana", "Inês", "Beatriz", "Mariana", "Catarina", "Joana", "Rita", "Sofia", "Carolina", "Diana", "Andreia", "Leonor", "Matilde", "Francisca", "Marta", "Raquel"],
    first: ["João", "Diogo", "Rúben", "Bernardo", "Gonçalo", "Tiago", "Rafael", "Nuno", "André", "Ricardo", "Bruno", "Pedro", "Miguel", "Rui", "Francisco", "Duarte", "Hélder", "Fábio", "Renato", "Tomás", "Henrique", "Vasco"],
    last: ["Silva", "Pereira", "Costa", "Ferreira", "Gonçalves", "Rodrigues", "Martins", "Sousa", "Carvalho", "Fonseca", "Neves", "Pinto", "Mendes", "Dias", "Coelho", "Lopes", "Azevedo", "Tavares", "Ribeiro", "Marques", "Almeida", "Teixeira", "Correia", "Moreira", "Cardoso", "Rocha", "Nunes", "Barros", "Matos", "Vieira"],
  },
  BE: {
    weight: 3,
    female: ["Tessa", "Janice", "Justine", "Elena", "Tine", "Marie", "Laura", "Julie", "Lotte", "Sarah", "Amber", "Jody", "Hanne", "Fien", "Lien", "Noor"],
    first: ["Kevin", "Thibaut", "Youri", "Axel", "Arthur", "Leandro", "Jérémy", "Thomas", "Dries", "Timothy", "Charles", "Lois", "Jan", "Wout", "Arne", "Maxim", "Siebe", "Jelle", "Pieter", "Bert", "Lander", "Robbe"],
    last: ["Peeters", "Janssens", "Maes", "Jacobs", "Mertens", "Willems", "Claes", "Goossens", "Wouters", "De Smet", "Dubois", "Lambert", "Vermeiren", "De Backer", "Van Damme", "Pauwels", "Hermans", "Michiels", "Aerts", "Smets", "De Cock", "Verstraete", "Desmet", "Lemmens", "Van Acker", "Segers", "Coppens", "Bogaerts", "Thys", "Wuyts"],
  },
  HR: {
    weight: 2,
    female: ["Ana", "Ivana", "Petra", "Lucija", "Marija", "Katarina", "Ema", "Mia", "Lana", "Nika", "Klara", "Tena", "Iva", "Dora", "Sara", "Marta"],
    first: ["Luka", "Ivan", "Mateo", "Josip", "Marko", "Andrej", "Mario", "Dominik", "Nikola", "Ante", "Borna", "Lovro", "Petar", "Bruno", "Martin", "Duje", "Toni", "Filip", "Karlo", "Stipe", "Roko", "Tin"],
    last: ["Horvat", "Kovačević", "Babić", "Marić", "Jurić", "Novak", "Knežević", "Vuković", "Kovačić", "Matić", "Tomić", "Pavić", "Božić", "Blažević", "Grgić", "Pavlović", "Šarić", "Lovrić", "Brkić", "Filipović", "Vidović", "Perić", "Radić", "Klarić", "Mikulić", "Bošnjak", "Galić", "Barišić", "Rukavina", "Lončar"],
  },
  PL: {
    weight: 3,
    female: ["Ewa", "Natalia", "Zuzanna", "Julia", "Maja", "Aleksandra", "Weronika", "Kinga", "Oliwia", "Martyna", "Paulina", "Dominika", "Gabriela", "Agata", "Hanna", "Magda"],
    first: ["Jakub", "Kacper", "Mateusz", "Piotr", "Krzysztof", "Robert", "Wojciech", "Kamil", "Bartosz", "Sebastian", "Przemysław", "Arkadiusz", "Michał", "Szymon", "Filip", "Adrian", "Tymoteusz", "Karol", "Paweł", "Łukasz", "Damian", "Marcin"],
    last: ["Nowak", "Kowalski", "Wiśniewski", "Wójcik", "Kamiński", "Lewandowski", "Zieliński", "Szymański", "Woźniak", "Dąbrowski", "Kozłowski", "Jankowski", "Mazur", "Krawczyk", "Piotrowski", "Grabowski", "Nowakowski", "Pawłowski", "Michalski", "Król", "Wieczorek", "Jabłoński", "Wróbel", "Majewski", "Olszewski", "Stępień", "Malinowski", "Jaworski", "Adamczyk", "Dudek"],
  },
  CH: {
    weight: 2,
    female: ["Lia", "Ramona", "Géraldine", "Noelle", "Riola", "Svenja", "Viola", "Seraina", "Alisha", "Nadine", "Lara", "Lina", "Nina", "Chiara", "Laura", "Elin"],
    first: ["Granit", "Manuel", "Yann", "Fabian", "Remo", "Denis", "Ricardo", "Nico", "Silvan", "Ruben", "Noah", "Dan", "Cedric", "Gregor", "Luca", "Joël", "Jonas", "Michel", "Simon", "Florian", "Kevin", "Renato"],
    last: ["Müller", "Meier", "Schmid", "Keller", "Weber", "Huber", "Schneider", "Meyer", "Steiner", "Fischer", "Gerber", "Brunner", "Baumann", "Frei", "Zimmermann", "Moser", "Widmer", "Wyss", "Graf", "Roth", "Suter", "Bachmann", "Kunz", "Lüthi", "Bühler", "Marti", "Hofer", "Sutter", "Kälin", "Imhof"],
  },
  AT: {
    weight: 2,
    female: ["Sarah", "Laura", "Nicole", "Viktoria", "Barbara", "Katharina", "Manuela", "Sophie", "Verena", "Julia", "Marie", "Carina", "Lisa", "Anna", "Theresa", "Eva"],
    first: ["David", "Marcel", "Konrad", "Christoph", "Florian", "Stefan", "Patrick", "Maximilian", "Philipp", "Nicolas", "Kevin", "Michael", "Romano", "Marko", "Alexander", "Lukas", "Andreas", "Matthias", "Dominik", "Sebastian", "Thomas", "Gernot"],
    last: ["Gruber", "Huber", "Bauer", "Wagner", "Pichler", "Steiner", "Moser", "Mayer", "Hofer", "Leitner", "Berger", "Fuchs", "Eder", "Fischer", "Schmid", "Winkler", "Weber", "Schwarz", "Maier", "Schneider", "Reiter", "Mayr", "Schmidt", "Wimmer", "Egger", "Brunner", "Lang", "Baumgartner", "Auer", "Binder"],
  },
  IS: {
    weight: 2,
    female: ["Sara", "Glódís", "Sveindís", "Dagný", "Karólína", "Hlín", "Guðrún", "Sandra", "Ingibjörg", "Agla", "Selma", "Telma", "Hildur", "Berglind", "Elín", "Katrín"],
    first: ["Gylfi", "Aron", "Jóhann", "Birkir", "Hörður", "Alfreð", "Rúnar", "Arnór", "Hákon", "Ísak", "Albert", "Jón", "Guðmundur", "Sverrir", "Kári", "Andri", "Hannes", "Ragnar", "Emil", "Ólafur", "Bjarki", "Stefán"],
    last: ["Sigurðsson", "Gunnarsson", "Guðmundsson", "Jónsson", "Bjarnason", "Finnbogason", "Halldórsson", "Ingason", "Þórðarson", "Magnússon", "Arnarsson", "Traustason", "Kristinsson", "Pálsson", "Baldursson", "Ólafsson", "Einarsson", "Stefánsson", "Helgason", "Björnsson", "Kristjánsson", "Árnason", "Sveinsson", "Jóhannsson", "Ragnarsson", "Hauksson", "Friðriksson", "Gíslason", "Karlsson", "Þorsteinsson"],
  },
  RS: {
    weight: 2,
    female: ["Jelena", "Milica", "Ana", "Jovana", "Marija", "Tijana", "Nevena", "Sara", "Katarina", "Teodora", "Dragana", "Mina", "Ivana", "Nina", "Maja", "Vesna"],
    first: ["Dušan", "Aleksandar", "Nemanja", "Sergej", "Filip", "Luka", "Strahinja", "Nikola", "Stefan", "Miloš", "Vanja", "Lazar", "Uroš", "Andrija", "Marko", "Saša", "Đorđe", "Veljko", "Ognjen", "Mihajlo", "Bogdan", "Petar"],
    last: ["Jovanović", "Petrović", "Nikolić", "Marković", "Đorđević", "Stojanović", "Ilić", "Pavlović", "Stanković", "Milošević", "Popović", "Živković", "Lukić", "Milenković", "Babić", "Kostić", "Ristić", "Simić", "Todorović", "Mladenović", "Savić", "Obradović", "Radovanović", "Lazić", "Vasić", "Antić", "Tomić", "Janković", "Kovačević", "Stević"],
  },
  TR: {
    weight: 3,
    female: ["Elif", "Zeynep", "Ece", "Defne", "Melis", "Ebru", "Yağmur", "Selin", "Büşra", "Kader", "İpek", "Didem", "Aylin", "Ezgi", "Derya", "Seda"],
    first: ["Arda", "Hakan", "Kerem", "Mert", "Burak", "Cengiz", "Emre", "Orkun", "Ferdi", "Barış", "Kaan", "Yusuf", "Semih", "Ozan", "Salih", "Cenk", "Okay", "Uğurcan", "İrfan", "Can", "Oğuz", "Efe"],
    last: ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Aydın", "Öztürk", "Arslan", "Doğan", "Kılıç", "Aslan", "Güler", "Çetin", "Kara", "Koç", "Kurt", "Özdemir", "Polat", "Erdoğan", "Ateş", "Aksoy", "Bulut", "Keskin", "Tekin", "Ünal", "Güneş", "Kaplan", "Avcı", "Taş"],
  },
  UY: {
    weight: 2,
    female: ["Florencia", "Lucía", "Agustina", "Valentina", "Camila", "Belén", "Sofía", "Pilar", "Esperanza", "Wendy", "Yamila", "Carolina", "Micaela", "Daiana", "Romina", "Laura"],
    first: ["Federico", "Darwin", "Rodrigo", "Ronald", "Manuel", "Facundo", "Nahitan", "Matías", "Giorgian", "Sebastián", "Maximiliano", "Mathías", "Agustín", "Brian", "Nicolás", "Diego", "Gastón", "Martín", "Santiago", "Joaquín", "Franco", "Emiliano"],
    last: ["Rodríguez", "González", "Fernández", "López", "Martínez", "Pérez", "García", "Sosa", "Silva", "Pereira", "Díaz", "Suárez", "Olivera", "Cabrera", "Núñez", "Méndez", "Castro", "Acosta", "Ramírez", "Romero", "Benítez", "Viera", "Píriz", "Correa", "Medina", "Techera", "Cardozo", "Bentos", "Larrosa", "Ferreira"],
  },
  CO: {
    weight: 3,
    female: ["Linda", "Mayra", "Catalina", "Daniela", "Leicy", "Manuela", "Lorena", "Valentina", "Juliana", "Carolina", "Natalia", "Laura", "Paola", "Isabella", "Mariana", "Ana"],
    first: ["James", "Luis", "Juan", "Jhon", "Davinson", "Yerry", "Richard", "Rafael", "Wilmar", "Jefferson", "Mateus", "Kevin", "Jorge", "Camilo", "Andrés", "Daniel", "Cristian", "Santiago", "Sebastián", "Felipe", "Óscar", "Duván"],
    last: ["Rodríguez", "Díaz", "Sánchez", "Mina", "Ríos", "Santos", "Barrios", "Uribe", "Arias", "Muñoz", "Castaño", "Quintero", "Montoya", "Restrepo", "Valencia", "Gómez", "Hernández", "Vargas", "Ramírez", "Moreno", "Ospina", "Zapata", "Cardona", "Mosquera", "Palacios", "Córdoba", "Rentería", "Murillo", "Arboleda", "Cuesta"],
  },
  MX: {
    weight: 3,
    female: ["Charlyn", "Kiana", "Lizbeth", "Jacqueline", "Alicia", "Maricarmen", "Rebeca", "Scarlett", "Natalia", "Ximena", "Fernanda", "Daniela", "Andrea", "Mónica", "Karla", "Paola"],
    first: ["Hirving", "Raúl", "Edson", "Guillermo", "Jesús", "Héctor", "Andrés", "Santiago", "Alexis", "Luis", "César", "Uriel", "Diego", "Julián", "Érick", "Carlos", "Rogelio", "Javier", "Alejandro", "Miguel", "Emilio", "Gerardo"],
    last: ["Hernández", "García", "López", "Martínez", "González", "Jiménez", "Álvarez", "Moreno", "Herrera", "Gallardo", "Vega", "Chávez", "Montes", "Pineda", "Romo", "Sánchez", "Ramírez", "Flores", "Torres", "Cruz", "Reyes", "Mendoza", "Ruiz", "Ortiz", "Castillo", "Morales", "Gutiérrez", "Aguilar", "Rojas", "Salazar"],
  },
  JP: {
    weight: 3,
    female: ["Saki", "Mana", "Yui", "Hina", "Riko", "Momoko", "Aoba", "Fuka", "Jun", "Mina", "Kumi", "Rikako", "Hikaru", "Yuka", "Aya", "Nana"],
    first: ["Takumi", "Kaoru", "Daichi", "Ritsu", "Wataru", "Takehiro", "Kyogo", "Junya", "Ayase", "Ko", "Hiroki", "Shuto", "Yuto", "Daizen", "Reo", "Keito", "Sota", "Haruki", "Kota", "Ren", "Riku", "Kenta"],
    last: ["Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Ito", "Yamamoto", "Nakamura", "Kobayashi", "Kato", "Yoshida", "Yamada", "Sasaki", "Yamaguchi", "Matsumoto", "Inoue", "Kimura", "Hayashi", "Shimizu", "Yamazaki", "Mori", "Abe", "Ikeda", "Hashimoto", "Ishikawa", "Ogawa", "Fujita", "Okada", "Goto", "Hasegawa"],
  },
  KR: {
    weight: 2,
    female: ["Ji-so", "Min-a", "Ga-eun", "Seo-yeon", "Ji-hyun", "Yu-jin", "Hye-ri", "Su-bin", "Eun-ji", "Da-in", "Jae-hee", "Ha-eun", "So-yeon", "Min-ji", "Ye-jin", "Na-ri"],
    first: ["Heung-min", "Min-jae", "Kang-in", "Hee-chan", "Jae-sung", "Gue-sung", "Woo-young", "In-beom", "Seung-ho", "Hyeon-woo", "Jin-su", "Young-woo", "Ji-sung", "Min-kyu", "Do-hyun", "Tae-hwan", "Sung-yong", "Chang-hoon", "Jun-ho", "Dong-won", "Seung-woo", "Ki-hun"],
    last: ["Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Cho", "Yoon", "Jang", "Lim", "Han", "Oh", "Seo", "Shin", "Kwon", "Hwang", "Ahn", "Song", "Hong", "Jeon", "Ko", "Moon", "Yang", "Son", "Bae", "Baek", "Heo", "Nam", "Noh", "Ha"],
  },
  MA: {
    weight: 2,
    female: ["Ghizlane", "Rosella", "Fatima", "Nouhaila", "Sanaa", "Yasmin", "Salma", "Imane", "Hanane", "Najat", "Amina", "Sara", "Khadija", "Meryem", "Hajar", "Zineb"],
    first: ["Achraf", "Hakim", "Sofyan", "Youssef", "Azzedine", "Noussair", "Bilal", "Selim", "Brahim", "Abde", "Ilias", "Nayef", "Amine", "Zakaria", "Ayoub", "Ismael", "Yassine", "Hamza", "Mehdi", "Adam", "Anass", "Karim"],
    last: ["Benali", "Alaoui", "Bennani", "Tazi", "El Idrissi", "Chaoui", "Rahimi", "El Amrani", "Berrada", "Lahlou", "Fassi", "Benjelloun", "Ouazzani", "Cherkaoui", "Belkadi", "Zerouali", "El Fassi", "Amrani", "Saidi", "Haddad", "Bouazza", "El Ouardi", "Naciri", "Kettani", "Lamrani", "Sebti", "Tahiri", "El Mansouri", "Hamdaoui", "Ziani"],
  },
  SN: {
    weight: 3,
    female: ["Ngoné", "Mama", "Awa", "Fatou", "Aminata", "Khady", "Coumba", "Ndèye", "Mariama", "Astou", "Bineta", "Seynabou", "Adama", "Rokhaya", "Dieynaba", "Sokhna"],
    first: ["Sadio", "Kalidou", "Idrissa", "Ismaïla", "Pape", "Cheikhou", "Moussa", "Abdou", "Boulaye", "Iliman", "Nicolas", "Habib", "Krépin", "Lamine", "Youssouf", "Ousmane", "Mamadou", "Alioune", "Babacar", "Ibrahima", "Modou", "Assane"],
    last: ["Gueye", "Sarr", "Mendy", "Diallo", "Ndiaye", "Diatta", "Diouf", "Ciss", "Dieng", "Sow", "Kouyaté", "Camara", "Niang", "Seck", "Ba", "Faye", "Diop", "Fall", "Thiam", "Mbaye", "Sylla", "Cissé", "Badji", "Sané", "Kane", "Touré", "Ndour", "Sagna", "Wade", "Gaye"],
  },
  GH: {
    weight: 2,
    female: ["Princella", "Grace", "Evelyn", "Portia", "Abigail", "Ernestina", "Doris", "Comfort", "Akua", "Ama", "Esi", "Adwoa", "Afia", "Efua", "Abena", "Yaa"],
    first: ["Thomas", "Mohammed", "Jordan", "André", "Tariq", "Kamaldeen", "Antoine", "Daniel", "Abdul", "Kofi", "Kwame", "Kwabena", "Yaw", "Ernest", "Joseph", "Osman", "Elisha", "Kwaku", "Kojo", "Kwesi", "Emmanuel", "Isaac"],
    last: ["Mensah", "Owusu", "Boateng", "Asamoah", "Appiah", "Addo", "Ofori", "Amoah", "Agyeman", "Osei", "Antwi", "Asante", "Darko", "Acheampong", "Opoku", "Ansah", "Frimpong", "Badu", "Bonsu", "Quaye", "Tetteh", "Annan", "Sarpong", "Yeboah", "Nkansah", "Donkor", "Amponsah", "Baffour", "Kyei", "Gyamfi"],
  },
  CI: {
    weight: 2,
    female: ["Josée", "Ines", "Rita", "Nadège", "Fernande", "Ange", "Aminata", "Rebecca", "Christelle", "Sandrine", "Mariam", "Fanta", "Awa", "Salimata", "Edwige", "Prisca"],
    first: ["Franck", "Sébastien", "Simon", "Odilon", "Willy", "Serge", "Jean-Philippe", "Nicolas", "Ibrahim", "Wilfried", "Seko", "Yahia", "Evan", "Oumar", "Hamed", "Emmanuel", "Christian", "Yao", "Kouassi", "Konan", "Arouna", "Didier"],
    last: ["Fofana", "Diallo", "Traoré", "Koné", "Touré", "Bamba", "Kouamé", "Kouassi", "Yao", "Konan", "N'Guessan", "Ouattara", "Coulibaly", "Doumbia", "Cissé", "Kanté", "Sangaré", "Diomandé", "Gbané", "Zadi", "Tano", "Akpa", "Brou", "Aka", "Kra", "Yapi", "Gnagne", "Assi", "Dosso", "Soro"],
  },
  CM: {
    weight: 2,
    female: ["Gabrielle", "Ajara", "Christine", "Yvonne", "Raissa", "Michaela", "Estelle", "Marlyse", "Gaëlle", "Claudine", "Genevieve", "Augustine", "Grâce", "Brigitte", "Nadine", "Sandrine"],
    first: ["André", "Vincent", "Eric", "Bryan", "Karl", "Frank", "Jean-Charles", "Christopher", "Georges", "Nicolas", "Samuel", "Olivier", "Jackson", "Martin", "Pierre", "Jean", "Patrick", "Joël", "Arnaud", "Serge", "Stéphane", "Rigobert"],
    last: ["Mbarga", "Atangana", "Ngono", "Essomba", "Owona", "Fouda", "Manga", "Nkoulou", "Tchami", "Ngassa", "Kamga", "Fotso", "Tchoupo", "Njoya", "Ebanda", "Biyik", "Mballa", "Onguene", "Kana", "Ndjock", "Song", "Mbia", "Nlend", "Ekotto", "Feutchine", "Tamo", "Djeugoue", "Nouma", "Bessala", "Oyono"],
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
