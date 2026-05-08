// NBA team name dictionary: alias → canonical ESPN short name
export const NBA_TEAMS: Record<string, string> = {
  // Atlanta Hawks
  hawks: "ATL", atlanta: "ATL", atl: "ATL", "atlanta hawks": "ATL",
  // Boston Celtics
  celtics: "BOS", boston: "BOS", bos: "BOS", "boston celtics": "BOS",
  // Brooklyn Nets
  nets: "BKN", brooklyn: "BKN", bkn: "BKN", "brooklyn nets": "BKN",
  // Charlotte Hornets
  hornets: "CHA", charlotte: "CHA", cha: "CHA", "charlotte hornets": "CHA",
  // Chicago Bulls
  bulls: "CHI", chicago: "CHI", chi: "CHI", "chicago bulls": "CHI",
  // Cleveland Cavaliers
  cavaliers: "CLE", cavs: "CLE", cleveland: "CLE", cle: "CLE", "cleveland cavaliers": "CLE",
  // Dallas Mavericks
  mavericks: "DAL", mavs: "DAL", dallas: "DAL", dal: "DAL", "dallas mavericks": "DAL",
  // Denver Nuggets
  nuggets: "DEN", denver: "DEN", den: "DEN", "denver nuggets": "DEN",
  // Detroit Pistons
  pistons: "DET", detroit: "DET", det: "DET", "detroit pistons": "DET",
  // Golden State Warriors
  warriors: "GS", "golden state": "GS", gsw: "GS", gs: "GS", "golden state warriors": "GS",
  // Houston Rockets
  rockets: "HOU", houston: "HOU", hou: "HOU", "houston rockets": "HOU",
  // Indiana Pacers
  pacers: "IND", indiana: "IND", ind: "IND", "indiana pacers": "IND",
  // LA Clippers
  clippers: "LAC", lac: "LAC", "la clippers": "LAC", "los angeles clippers": "LAC",
  // Los Angeles Lakers
  lakers: "LAL", lal: "LAL", "la lakers": "LAL", "los angeles lakers": "LAL",
  // Memphis Grizzlies
  grizzlies: "MEM", memphis: "MEM", mem: "MEM", "memphis grizzlies": "MEM",
  // Miami Heat
  heat: "MIA", miami: "MIA", mia: "MIA", "miami heat": "MIA",
  // Milwaukee Bucks
  bucks: "MIL", milwaukee: "MIL", mil: "MIL", "milwaukee bucks": "MIL",
  // Minnesota Timberwolves
  timberwolves: "MIN", wolves: "MIN", minnesota: "MIN", min: "MIN", "minnesota timberwolves": "MIN",
  // New Orleans Pelicans
  pelicans: "NO", "new orleans": "NO", nop: "NO", no: "NO", "new orleans pelicans": "NO",
  // New York Knicks
  knicks: "NY", "new york": "NY", nyk: "NY", ny: "NY", "new york knicks": "NY",
  // Oklahoma City Thunder
  thunder: "OKC", okc: "OKC", "oklahoma city": "OKC", "oklahoma city thunder": "OKC",
  // Orlando Magic
  magic: "ORL", orlando: "ORL", orl: "ORL", "orlando magic": "ORL",
  // Philadelphia 76ers
  "76ers": "PHI", sixers: "PHI", philadelphia: "PHI", phi: "PHI", "philadelphia 76ers": "PHI",
  // Phoenix Suns
  suns: "PHX", phoenix: "PHX", phx: "PHX", "phoenix suns": "PHX",
  // Portland Trail Blazers
  blazers: "POR", "trail blazers": "POR", portland: "POR", por: "POR", "portland trail blazers": "POR",
  // Sacramento Kings
  kings: "SAC", sacramento: "SAC", sac: "SAC", "sacramento kings": "SAC",
  // San Antonio Spurs
  spurs: "SA", "san antonio": "SA", sas: "SA", sa: "SA", "san antonio spurs": "SA",
  // Toronto Raptors
  raptors: "TOR", toronto: "TOR", tor: "TOR", "toronto raptors": "TOR",
  // Utah Jazz
  jazz: "UTAH", utah: "UTAH", uta: "UTAH", "utah jazz": "UTAH",
  // Washington Wizards
  wizards: "WSH", washington: "WSH", wsh: "WSH", was: "WSH", "washington wizards": "WSH",
};

export const ESPN_NBA_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";
