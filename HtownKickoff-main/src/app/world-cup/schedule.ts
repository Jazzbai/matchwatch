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
    { date: "Jun 11", time: "5:00 PM ET", home: "Mexico", away: "Ecuador", group: "GROUP A", venue: "AT&T Stadium", city: "Dallas", tag: "OPENING MATCH" },
    { date: "Jun 12", time: "3:00 PM ET", home: "USA", away: "Bolivia", group: "GROUP C", venue: "MetLife Stadium", city: "NY / NJ", tag: "HOST NATION" },
    { date: "Jun 12", time: "6:00 PM ET", home: "Canada", away: "Chile", group: "GROUP F", venue: "SoFi Stadium", city: "Los Angeles", tag: "" },
    { date: "Jun 13", time: "3:00 PM ET", home: "Brazil", away: "Japan", group: "GROUP D", venue: "Hard Rock Stadium", city: "Miami", tag: "" },
    { date: "Jun 14", time: "12:00 PM ET", home: "England", away: "Senegal", group: "GROUP B", venue: "Levi's Stadium", city: "San Francisco", tag: "" },
    { date: "Jun 14", time: "6:00 PM ET", home: "Germany", away: "Korea Rep.", group: "GROUP E", venue: "Gillette Stadium", city: "Boston", tag: "" },
    { date: "Jun 15", time: "3:00 PM ET", home: "Argentina", away: "Australia", group: "GROUP H", venue: "NRG Stadium", city: "Houston", tag: "" },
    { date: "Jun 15", time: "6:00 PM ET", home: "France", away: "Morocco", group: "GROUP G", venue: "Mercedes-Benz Stadium", city: "Atlanta", tag: "" },
    { date: "Jun 16", time: "3:00 PM ET", home: "Spain", away: "Sweden", group: "GROUP I", venue: "Lincoln Financial Field", city: "Philadelphia", tag: "" },
    { date: "Jun 17", time: "6:00 PM ET", home: "Portugal", away: "Panama", group: "GROUP J", venue: "Lumen Field", city: "Seattle", tag: "" },
    { date: "Jun 18", time: "3:00 PM ET", home: "Netherlands", away: "Uruguay", group: "GROUP K", venue: "Arrowhead Stadium", city: "Kansas City", tag: "" },
    { date: "Jun 19", time: "6:00 PM ET", home: "Italy", away: "Ecuador", group: "GROUP L", venue: "AT&T Stadium", city: "Dallas", tag: "" },
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

export const WORLD_CUP_FLAGS: Record<string, string> = {
  Mexico: "mx",
  Ecuador: "ec",
  USA: "us",
  Bolivia: "bo",
  Canada: "ca",
  Chile: "cl",
  Brazil: "br",
  Japan: "jp",
  England: "gb-eng",
  Senegal: "sn",
  Germany: "de",
  "Korea Rep.": "kr",
  Argentina: "ar",
  Australia: "au",
  France: "fr",
  Morocco: "ma",
  Spain: "es",
  Sweden: "se",
  Portugal: "pt",
  Panama: "pa",
  Netherlands: "nl",
  Uruguay: "uy",
  Italy: "it",
};
