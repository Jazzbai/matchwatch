export type WorldCupScheduleMatch = {
  date: string;
  time: string;
  home: string;
  away: string;
  group: string;
  venue: string;
  city: string;
  tag: string;
};

export type WorldCupScheduleTab = "group" | "knockout" | "final";

export const WORLD_CUP_SCHEDULE: Record<WorldCupScheduleTab, WorldCupScheduleMatch[]> = {
  group: [
    { date: "Mon Jun 29", time: "12:00 PM CT", home: "Brazil", away: "Japan", group: "WORLD CUP", venue: "", city: "Houston", tag: "THIS WEEK" },
    { date: "Mon Jun 29", time: "3:30 PM CT", home: "Germany", away: "Paraguay", group: "WORLD CUP", venue: "", city: "", tag: "" },
    { date: "Mon Jun 29", time: "8:00 PM CT", home: "Netherlands", away: "Morocco", group: "WORLD CUP", venue: "", city: "", tag: "" },
    { date: "Tue Jun 30", time: "12:00 PM CT", home: "Ivory Coast", away: "Norway", group: "WORLD CUP", venue: "", city: "Arlington", tag: "ARLINGTON" },
    { date: "Tue Jun 30", time: "4:00 PM CT", home: "France", away: "Sweden", group: "WORLD CUP", venue: "", city: "", tag: "" },
    { date: "Tue Jun 30", time: "8:00 PM CT", home: "Mexico", away: "Ecuador", group: "WORLD CUP", venue: "", city: "", tag: "" },
    { date: "Wed Jul 1", time: "11:00 AM CT", home: "England", away: "DR Congo", group: "WORLD CUP", venue: "", city: "", tag: "" },
    { date: "Wed Jul 1", time: "12:00 PM CT", home: "United States", away: "Bosnia & Herzegovina", group: "WORLD CUP", venue: "", city: "", tag: "" },
    { date: "Wed Jul 1", time: "3:00 PM CT", home: "Spain", away: "Austria", group: "WORLD CUP", venue: "", city: "", tag: "" },
    { date: "Wed Jul 1", time: "8:00 PM CT", home: "Argentina", away: "Cape Verde", group: "WORLD CUP", venue: "", city: "", tag: "" },
    { date: "Thu Jul 2", time: "12:00 PM CT", home: "Portugal", away: "Croatia", group: "WORLD CUP", venue: "", city: "", tag: "" },
    { date: "Thu Jul 2", time: "3:00 PM CT", home: "Colombia", away: "Senegal", group: "WORLD CUP", venue: "", city: "", tag: "" },
    { date: "Thu Jul 2", time: "8:00 PM CT", home: "Belgium", away: "Uruguay", group: "WORLD CUP", venue: "", city: "", tag: "" },
  ],
  knockout: [
    { date: "Jul 2", time: "TBD", home: "Group A Winner", away: "Group B Runner-up", group: "ROUND OF 16", venue: "MetLife Stadium", city: "NY / NJ", tag: "" },
    { date: "Jul 3", time: "TBD", home: "Group C Winner", away: "Group D Runner-up", group: "ROUND OF 16", venue: "SoFi Stadium", city: "Los Angeles", tag: "" },
    { date: "Jul 4", time: "TBD", home: "Group E Winner", away: "Group F Runner-up", group: "ROUND OF 16", venue: "AT&T Stadium", city: "Dallas", tag: "INDEPENDENCE DAY" },
    { date: "Jul 5", time: "TBD", home: "Group G Winner", away: "Group H Runner-up", group: "ROUND OF 16", venue: "Hard Rock Stadium", city: "Miami", tag: "" },
    { date: "Jul 5", time: "TBD", home: "QF Winner 1", away: "QF Winner 2", group: "QUARTERFINAL", venue: "NRG Stadium", city: "Houston", tag: "" },
    { date: "Jul 6", time: "TBD", home: "QF Winner 3", away: "QF Winner 4", group: "QUARTERFINAL", venue: "Mercedes-Benz Stadium", city: "Atlanta", tag: "" },
    { date: "Jul 14", time: "TBD", home: "SF Winner 1", away: "SF Winner 2", group: "SEMIFINAL", venue: "SoFi Stadium", city: "Los Angeles", tag: "SEMIFINAL" },
    { date: "Jul 15", time: "TBD", home: "SF Winner 3", away: "SF Winner 4", group: "SEMIFINAL", venue: "MetLife Stadium", city: "NY / NJ", tag: "SEMIFINAL" },
  ],
  final: [
    { date: "Jul 18", time: "TBD", home: "TBD", away: "TBD", group: "3RD PLACE", venue: "Hard Rock Stadium", city: "Miami", tag: "BRONZE MATCH" },
    { date: "Jul 19", time: "3:00 PM ET", home: "TBD", away: "TBD", group: "THE FINAL", venue: "MetLife Stadium", city: "NY / NJ", tag: "WORLD CUP FINAL" },
  ],
};

export const WORLD_CUP_THIS_WEEK: WorldCupScheduleMatch[] = WORLD_CUP_SCHEDULE.group;

export const WORLD_CUP_FLAGS: Record<string, string> = {
  Algeria: "dz",
  Argentina: "ar",
  Australia: "au",
  Austria: "at",
  Belgium: "be",
  Bolivia: "bo",
  "Bosnia and Herzegovina": "ba",
  "Bosnia & Herzegovina": "ba",
  Brazil: "br",
  "Cabo Verde": "cv",
  "Cape Verde": "cv",
  Canada: "ca",
  Chile: "cl",
  Colombia: "co",
  "Congo DR": "cd",
  "DR Congo": "cd",
  "Cote d'Ivoire": "ci",
  Curacao: "cw",
  Czechia: "cz",
  Ecuador: "ec",
  Egypt: "eg",
  England: "gb-eng",
  France: "fr",
  Germany: "de",
  Ghana: "gh",
  Haiti: "ht",
  "IR Iran": "ir",
  Iraq: "iq",
  Italy: "it",
  "Ivory Coast": "ci",
  Japan: "jp",
  Jordan: "jo",
  "Korea Rep.": "kr",
  "Korea Republic": "kr",
  Mexico: "mx",
  Morocco: "ma",
  Netherlands: "nl",
  "New Zealand": "nz",
  Norway: "no",
  Panama: "pa",
  Paraguay: "py",
  Portugal: "pt",
  Qatar: "qa",
  "Saudi Arabia": "sa",
  Scotland: "gb-sct",
  Senegal: "sn",
  "South Africa": "za",
  Spain: "es",
  Sweden: "se",
  Switzerland: "ch",
  Tunisia: "tn",
  Turkiye: "tr",
  Uruguay: "uy",
  USA: "us",
  "United States": "us",
  Uzbekistan: "uz",
};
