export type FanProfile = {
  order: number;
  slug: string;
  country: string;
  flagLabel: string;
  nickname: string;
  fanName: string;
  tagline: string;
  blurb: string;
  accent: string;
  accentDeep: string;
  accentAlt: string;
  colors: { name: string; hex: string }[];
  names: { name: string; meaning: string }[];
  symbols: string[];
  ritual: {
    badge: string;
    name: string;
    story: string;
    records: string[];
  };
  moments: { title: string; summary: string; angle: string }[];
  funFacts: string[];
  cta: { title: string; text: string };
  sources: { label: string; url: string }[];
};

export const fanProfiles: FanProfile[] = [
  {
    order: 1,
    slug: "netherlands",
    country: "Netherlands",
    flagLabel: "NED",
    nickname: "Orange Army",
    fanName: "Het Oranje Legioen",
    tagline: "A moving wall of orange: fanwalks, lions, drums, dance tracks, and a Texas takeover from Dallas to Houston.",
    blurb: "Oranje culture is built for the street before it reaches the stadium: orange shirts, lion symbols, marching crowds, music, and a fanwalk that turns the host city into a parade route.",
    accent: "#ff7a00",
    accentDeep: "#133c8b",
    accentAlt: "#ffffff",
    colors: [
      { name: "Orange", hex: "#ff7a00" },
      { name: "Royal Blue", hex: "#133c8b" },
      { name: "White", hex: "#ffffff" },
    ],
    names: [
      { name: "Oranje", meaning: "The Dutch national team identity, named for the House of Orange." },
      { name: "Orange Army", meaning: "English-language nickname for the traveling Dutch supporters." },
      { name: "Het Oranje Legioen", meaning: "The Orange Legion, the mass of Dutch supporters." },
      { name: "De Oranje Leeuwen", meaning: "The Orange Lions, tied to the lion as a Dutch symbol." },
    ],
    symbols: ["Orange shirts", "Lion crests", "Oranje Fanwalk", "Double-decker Oranje Bus", "Drums and dance tracks", "Cowboy hats in Texas", "Orange scarves"],
    ritual: {
      badge: "Signature ritual",
      name: "The Oranje Fanwalk",
      story: "Dutch supporters gather hours before kickoff and march to the stadium as one orange block. OnsOranje promoted Dallas as the first Oranje Fanwalk of the 2026 World Cup, setting the tone in Arlington before the tradition rolled into Houston for the Netherlands vs. Sweden match.",
      records: [
        "Dallas / Arlington: OnsOranje marked the first Oranje Fanwalk of the 2026 World Cup around Dallas Stadium.",
        "Houston: around 20,000 total fans marched to NRG Stadium, including at least 15,000 Dutch supporters in the Oranje Fanwalk.",
        "Houston Stadium: Netherlands beat Sweden 5-1 in front of a reported 68,777 fans.",
      ],
    },
    moments: [
      {
        title: "Dallas hosted the first 2026 Oranje Fanwalk",
        summary: "OnsOranje positioned Dallas / Arlington as the first Oranje Fanwalk of the 2026 World Cup, giving the Orange Army an official opening march before the wider Texas takeover.",
        angle: "The Orange Army made North Texas feel like a Dutch street party.",
      },
      {
        title: "Houston turned highlighter orange",
        summary: "The Netherlands vs. Sweden match brought a giant Oranje Fanwalk from Rice University toward Houston Stadium. Houston Chronicle reporting put the total march scene around 20,000 fans, including at least 15,000 Dutch supporters.",
        angle: "Houston did not just host Oranje. Houston became Oranje.",
      },
      {
        title: "The 5-1 win made the parade feel bigger",
        summary: "The Dutch beat Sweden 5-1, turning the pregame fanwalk into a full-city celebration and making the orange crowd one of the tournament's strongest early images.",
        angle: "When the team scored, the fan culture already had the city warmed up.",
      },
      {
        title: "Texas changed the costume",
        summary: "Dutch and visiting European fans leaned into local style with cowboy hats, stadium-scale tailgating, and a host-city experience that mixed orange tradition with Texas hospitality.",
        angle: "Oranje kept its identity while borrowing the local uniform.",
      },
    ],
    funFacts: [
      "Orange is not on the Dutch flag; it comes from the royal House of Orange-Nassau.",
      "Dutch fans are among the best-known fanwalk cultures in world football.",
      "The lion is one of the strongest visual symbols in Dutch football culture.",
    ],
    cta: {
      title: "Find the Orange Army in your city",
      text: "Track watch parties and fanwalk-style gatherings for Netherlands match days.",
    },
    sources: [
      { label: "OnsOranje - First Oranje Fanwalk 2026 World Cup Dallas", url: "https://www.onsoranje.nl/info/82589/first-oranje-fanwalk-2026-world-cup-dallas" },
      { label: "Axios Dallas - World Cup kicks off in Arlington", url: "https://www.axios.com/local/dallas/2026/06/14/world-cup-kicks-off-in-arlington" },
      { label: "Axios Houston - Houston turns orange", url: "https://www.axios.com/local/houston/2026/06/22/houston-turns-orange-as-dutch-fans-flood-the-city" },
      { label: "MSN / Houston Chronicle - 20,000 fans march to NRG Stadium", url: "https://www.msn.com/en-us/sports/soccer/around-20-000-fans-march-to-houston-s-nrg-stadium-for-netherlands-v-sweden-world-cup-match/ar-AA269Hu7" },
      { label: "Houston Chronicle - Netherlands vs Sweden in Houston", url: "https://www.houstonchronicle.com/world-cup/article/netherlands-sweden-houston-22310913.php" },
      { label: "Chron - Orange Fanwalk explained", url: "https://www.chron.com/culture/article/houston-orange-fanwalk-explained-22305717.php" },
    ],
  },
  {
    order: 2,
    slug: "mexico",
    country: "Mexico",
    flagLabel: "MEX",
    nickname: "The Green Wave",
    fanName: "La Aficion Mexicana",
    tagline: "When El Tri plays, the stadium becomes a fiesta: green shirts, drums, mariachi energy, and the wave that traveled the world.",
    blurb: "El Tri and La Aficion Mexicana bring a sea of green, nonstop chants, mariachi rhythms, flags, and La Ola, the wave that became a global stadium ritual.",
    accent: "#0c7a4d",
    accentDeep: "#024d36",
    accentAlt: "#ce1126",
    colors: [
      { name: "Green", hex: "#006847" },
      { name: "White", hex: "#ffffff" },
      { name: "Red", hex: "#ce1126" },
    ],
    names: [
      { name: "El Tri", meaning: "The Tricolor, the team's official nickname." },
      { name: "La Aficion Mexicana", meaning: "The Mexican supporters." },
      { name: "The Green Wave", meaning: "For the sea of green jerseys." },
      { name: "La Ola Verde", meaning: "Green Wave." },
    ],
    symbols: ["Green jerseys", "La Ola", "Mariachi music", "Giant flags", "Drums and chants", "Estadio Azteca", "El Tri"],
    ritual: {
      badge: "Signature ritual",
      name: "La Ola - The Mexican Wave",
      story: "Popularized worldwide at the 1986 World Cup in Mexico, La Ola remains one of football's most recognizable crowd rituals. For 2026, the wave became part of Mexico's countdown identity again, connecting home-soil pride with a global fan tradition.",
      records: [
        "Largest wave by participants: 157,574 in the United States in 2008.",
        "Longest wave line: 8,453 people in Portugal in 2007.",
        "Longest timed wave: 17 min 14 sec in Japan in 2015.",
      ],
    },
    moments: [
      {
        title: "The Green Wave movement",
        summary: "A revival of La Ola turned the wave into a fan-identity campaign for the World Cup countdown.",
        angle: "Mexico did not just create a fan tradition. They exported it to the world.",
      },
      {
        title: "El Tri travels everywhere",
        summary: "Mexico matches are among the highest-demand atmospheres in North America, and Mexican supporters routinely transform neutral venues into home games.",
        angle: "No team travels like El Tri.",
      },
      {
        title: "Home-soil pride",
        summary: "Mexico is hosting World Cup matches for the third time after 1970 and 1986, making 2026 a generational fan moment.",
        angle: "Three World Cups. One dream.",
      },
    ],
    funFacts: [
      "Fans jumping after Mexico beat Germany in 2018 created seismic activity detected by instruments in Mexico City.",
      "Football is woven into Mexican national identity, from street games to stadium rituals.",
      "Mexican supporters are known for singing through the full match, win or lose.",
    ],
    cta: {
      title: "Watch El Tri in Houston",
      text: "Find the bars and lounges throwing Green Wave watch parties on match day.",
    },
    sources: [
      { label: "CNN - Mexico's World Cup traditions", url: "https://www.cnn.com/2026/06/07/americas/world-cup-mexican-wave-soccer-traditions-latam-intl" },
      { label: "Christian Science Monitor - the wave", url: "https://www.csmonitor.com/World/Americas/2026/0611/world-cup-mexico-city-the-wave" },
      { label: "MexTour - official U.S. tour", url: "https://www.mextour.org/" },
      { label: "Nielsen - The Future of Sport 2025", url: "https://www.nielsen.com/news-center/2025/the-future-of-sport-nielsens-2025-report-reveals-growth-drivers/" },
    ],
  },
  {
    order: 3,
    slug: "norway",
    country: "Norway",
    flagLabel: "NOR",
    nickname: "The Viking Army",
    fanName: "De Norske Vikingene",
    tagline: "Red and navy supporters rowing through the city: a Viking-ship celebration built for stadium bowls, plazas, and subway platforms.",
    blurb: "Norway's 2026 return after 28 years gave its fans a fresh global stage. The visual hook is simple and powerful: sit, row, chant, rise, repeat.",
    accent: "#d21f3c",
    accentDeep: "#102a63",
    accentAlt: "#ffffff",
    colors: [
      { name: "Red", hex: "#d21f3c" },
      { name: "Navy", hex: "#102a63" },
      { name: "White", hex: "#ffffff" },
    ],
    names: [
      { name: "The Viking Army", meaning: "English-language identity for Norway's traveling support." },
      { name: "De Norske Vikingene", meaning: "The Norwegian Vikings." },
      { name: "Landslaget fans", meaning: "Supporters of the national team." },
      { name: "Haaland generation", meaning: "A new wave tied to Norway's 2026 return and star power." },
    ],
    symbols: ["Viking ship rowing", "Red shirts", "Navy scarves", "Drums", "Haaland chants", "Ship rows in plazas", "Call-and-response claps"],
    ritual: {
      badge: "Signature ritual",
      name: "The Viking Ship Row",
      story: "Norwegian supporters sit or crouch in rows, move their arms like oars, and build the chant into a shared Viking-ship rhythm. In New York, fans carried the celebration into Times Square and the subway ahead of Norway vs. Senegal, turning the city commute into a rolling fan scene.",
      records: [
        "New York: Norwegian fans performed the rowing-style Viking celebration in Times Square.",
        "NYC subway: supporters carried the chant underground on match day.",
        "2026 context: Norway returned to the World Cup for the first time in 28 years.",
      ],
    },
    moments: [
      {
        title: "Times Square became a Viking deck",
        summary: "Norwegian fans in red and navy brought the rowing celebration to Times Square before Norway's New York/New Jersey match.",
        angle: "The city square became the ship.",
      },
      {
        title: "The subway chant traveled with them",
        summary: "The same rowing motion and chant moved into the NYC subway system, making the fan culture visible beyond the stadium district.",
        angle: "A great fan ritual works even between stops.",
      },
      {
        title: "A 28-year return gave it meaning",
        summary: "Norway's first World Cup appearance since 1998 gave the Viking theme more weight than costume alone.",
        angle: "It felt less like a gimmick and more like a return voyage.",
      },
    ],
    funFacts: [
      "Norway's 2026 campaign is its first World Cup appearance since 1998.",
      "The rowing celebration is easy for strangers to join because the movement is obvious from far away.",
      "Red, white, and navy let Norway's crowd read clearly in both stadium seats and city streets.",
    ],
    cta: {
      title: "Join the Viking watch",
      text: "Find Norway watch parties and fan gatherings before the next kickoff.",
    },
    sources: [
      { label: "New York Post - Norwegian fans in NYC", url: "https://nypost.com/2026/06/22/sports/rowing-norwegian-world-cup-fans-take-over-nyc-subways-times-square/" },
      { label: "Guardian live - Norway v Senegal context", url: "https://www.theguardian.com/football/live/2026/jun/22/world-cup-2026-cape-verde-continue-remarkable-story-messi-mbappe-and-haaland-return-live" },
    ],
  },
  {
    order: 4,
    slug: "argentina",
    country: "Argentina",
    flagLabel: "ARG",
    nickname: "La Albiceleste",
    fanName: "La Hinchada Argentina",
    tagline: "Sky blue, white, drums, flags, and songs that turn any plaza into a rolling football choir.",
    blurb: "Argentina's supporters are defined by song. Their marches feel like moving concerts: big flags, bass drums, jumping sections, and chants that carry from the street into the stadium.",
    accent: "#6ec6ff",
    accentDeep: "#17376d",
    accentAlt: "#f5c542",
    colors: [
      { name: "Sky Blue", hex: "#6ec6ff" },
      { name: "White", hex: "#ffffff" },
      { name: "Sun Gold", hex: "#f5c542" },
    ],
    names: [
      { name: "La Albiceleste", meaning: "The white and sky-blue team identity." },
      { name: "La Hinchada Argentina", meaning: "The Argentine supporters." },
      { name: "La Scaloneta", meaning: "The fan-era nickname tied to Lionel Scaloni's national team." },
      { name: "Campeones del Mundo", meaning: "World champions, a core part of the current fan identity." },
    ],
    symbols: ["Sky-blue flags", "Bass drums", "Jumping sections", "Messi shirts", "Street marches", "Sun of May", "Call-and-response songs"],
    ritual: {
      badge: "Signature ritual",
      name: "The Albiceleste Song March",
      story: "Argentina fans build atmosphere through songs that repeat for blocks, not seconds. The page is ready for your extra knowledge on specific fan marches and celebrations; the current version keeps the structure broad so we can add exact city moments without inventing details.",
      records: [
        "Dallas: Argentina's 2026 group-stage schedule includes major match activity in Dallas.",
        "Core identity: drums, flags, jumping, and songs are the main fan language.",
        "Content slot: add your fan-march notes here and the page can be updated fast.",
      ],
    },
    moments: [
      {
        title: "The song is the engine",
        summary: "Argentina's fan culture travels through chants first: one lead voice, a drum pulse, and thousands repeating the line until the march becomes a choir.",
        angle: "For Argentina, the crowd does not wait for kickoff to start playing.",
      },
      {
        title: "Dallas is the current stage",
        summary: "Argentina's 2026 group-stage path puts Dallas in focus, giving La Hinchada a major U.S. host-city canvas.",
        angle: "Sky blue and white can turn an indoor stadium into a home end.",
      },
      {
        title: "Ready for your field notes",
        summary: "You said you will pass extra knowledge about Argentina fan marches and celebrations. This template is built so those notes can become exact moments, sources, and city callouts.",
        angle: "The next version should use your details, not generic filler.",
      },
    ],
    funFacts: [
      "Argentina fan songs often outlive a single tournament and become part of football culture worldwide.",
      "The Sun of May from the national flag is a strong visual anchor for banners and graphics.",
      "The current generation carries both Messi-era emotion and defending-champion pride.",
    ],
    cta: {
      title: "Find Argentina watch parties",
      text: "Track sky-blue match-day gatherings, songs, and fan marches near your city.",
    },
    sources: [
      { label: "Guardian live - Argentina in Dallas context", url: "https://www.theguardian.com/football/live/2026/jun/22/world-cup-2026-cape-verde-continue-remarkable-story-messi-mbappe-and-haaland-return-live" },
      { label: "Argentina 2026 schedule reference", url: "https://es.wikipedia.org/wiki/Argentina_en_la_Copa_Mundial_de_F%C3%BAtbol_de_2026" },
    ],
  },
];

export function getFanProfile(slug: string) {
  return fanProfiles.find((profile) => profile.slug === slug);
}
