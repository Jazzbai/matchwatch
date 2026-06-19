"use client";

import React, { useState } from "react";
import Link from "next/link";
import { notFound, usePathname } from "next/navigation";
import { FloatingNav } from "../../../../components/AppShell";
import {
  MapPin, Globe, ChevronRight, ExternalLink, Calendar,
  Users, Building2, ChevronDown, Shield, Music, Utensils,
  Tv, Sparkles, Dumbbell, Ticket, Wind, Star, Mic,
} from "lucide-react";

/* ─── Data ───────────────────────────────────────────────────────────────────── */

const FAN_FESTS = {
  seattle: {
    citySlug: "seattle",
    cityName: "Seattle",
    badge: "Official FIFA Fan Festival™ · Seattle",
    h1a: "FIFA Fan Festival™",
    h1b: "Seattle",
    subtitle: "Let's Play SEA '26 — World Soccer Fan Celebration",
    addrShort: "Seattle Center — The Armory & Mural Amphitheatre, 305 Harrison St",
    addrFull: "305 Harrison St, Seattle, WA 98109",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Seattle+Center+305+Harrison+St+Seattle+WA",
    dates: "June–July 2026 · All Match Days",
    capacity: 30000,
    website: "https://www.seattlecenter.com/events/lets-play-sea-26",
    cover: "https://www.seattlecenter.com/Images/Events/Productions/Lets%20Play%20SEA%2026/LPSea26_1920x1080.jpg",
    p1: "The official FIFA Fan Festival™ for Seattle's World Cup 2026 matches is hosted at Seattle Center — the iconic civic campus at the foot of the Space Needle. Under the banner Let's Play SEA '26, Seattle Center transforms into a massive World Soccer Fan Celebration open to all.",
    p2: "Watch every match on a giant indoor screen inside The Armory for all-weather covered viewing, or gather outside at the Mural Amphitheatre for an outdoor big-screen experience directly beneath the Space Needle. International DJs, live performances, food vendors, and campus-wide programming make Seattle Center the premier match-day destination in Washington State.",
    features: [
      { icon: Tv, label: "Indoor Giant Screen — The Armory (all-weather)" },
      { icon: Tv, label: "Outdoor Big Screen — Mural Amphitheatre" },
      { icon: Music, label: "International DJs & Live Performances" },
      { icon: Utensils, label: "Food Vendors & Beverages" },
      { icon: Sparkles, label: "Public Art & Cultural Activations" },
      { icon: Dumbbell, label: "Fitness & Interactive Fan Activities" },
      { icon: Ticket, label: "Free to Attend (Most Programming)" },
      { icon: Globe, label: "Beneath the Space Needle — Seattle Center" },
    ],
    sidebarName: "Seattle Center",
    sidebarAddr: "305 Harrison St, Seattle, WA 98109",
    notes: ["📍 The Armory — indoor screen", "🎬 Mural Amphitheatre — outdoor screen", "🏔 Beneath the Space Needle"],
    matchCount: 5,
    hasZones: true,
    faqs: [
      { q: "Where exactly is the official FIFA Fan Festival™ in Seattle?", a: "Seattle Center, at 305 Harrison St — right beneath the Space Needle. The main indoor viewing area is The Armory, and outdoor screenings are at the Mural Amphitheatre." },
      { q: "Is the FIFA Fan Festival™ free to attend?", a: "Yes — core programming is free admission. Some special events or ticketed performances may apply. Check the Seattle Center website for the full schedule." },
      { q: "Do I need a FIFA match ticket to attend?", a: "No. The Fan Festival is completely separate from Lumen Field. You watch live match broadcasts on giant screens. No World Cup match ticket needed." },
      { q: "What's the difference between the Fan Festival and the community fan zones?", a: "The FIFA Fan Festival™ at Seattle Center is the single official, FIFA-sanctioned event. The 9 community fan zones are watch party events spread across Washington State in partnership with Seattle FWC26." },
      { q: "How do I get there?", a: "Seattle Center is accessible by the Seattle Monorail from Westlake Center, Metro Bus routes, and nearby parking lots. Public transit is strongly recommended on match days." },
      { q: "What are the viewing options?", a: "Two main screens: The Armory (large indoor covered hall) and Mural Amphitheatre (outdoor stage beneath the Space Needle)." },
    ],
  },
  houston: {
    citySlug: "houston",
    cityName: "Houston",
    badge: "Official FIFA Fan Festival™ · Houston",
    h1a: "FIFA Fan Festival™",
    h1b: "Houston",
    subtitle: "EaDo Fan Zone — Free-Admission World Cup Celebration",
    addrShort: "EaDo — East Downtown, near Shell Energy Stadium",
    addrFull: "EaDo District, Houston, TX 77003",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=EaDo+East+Downtown+Houston+TX+FIFA+Fan+Festival",
    dates: "June 11 – July 19, 2026 · All 34 Match Days",
    capacity: 15000,
    website: "https://www.fwc26houston.com/fifafanfestivalhou",
    cover: "https://assets.simpleviewinc.com/simpleview/image/upload/c_fill,h_900,q_75,w_1200/v1/clients/houston/FanFest2_8c3ec7c1-0e8e-4dac-9dc5-fbb0f293cb5f.png",
    p1: "The official FIFA Fan Festival™ for Houston's World Cup 2026 matches is in the heart of EaDo (East Downtown), steps from Shell Energy Stadium. Free admission, open every match day from June 11 through July 19 — all 34 days of the tournament.",
    p2: "Signature features include the Esphora projection dome — an immersive 360° viewing experience — and Houston Hall, a large air-conditioned indoor space for all-weather match viewing. Outside: giant screens, live performances, youth soccer, food vendors, and VIP cabanas.",
    features: [
      { icon: Sparkles, label: "Esphora Projection Dome — 360° Immersive Viewing" },
      { icon: Wind, label: "Houston Hall — Air-Conditioned Indoor Zone" },
      { icon: Tv, label: "Giant Match-Viewing Screens" },
      { icon: Mic, label: "Live Performances & Entertainment" },
      { icon: Star, label: "Youth Soccer Programming" },
      { icon: Utensils, label: "Food & Beverage Vendors" },
      { icon: Shield, label: "VIP Cabanas (Reservable)" },
      { icon: Ticket, label: "Free Admission — All 34 Days" },
    ],
    sidebarName: "FIFA Fan Festival™ Houston",
    sidebarAddr: "EaDo, Houston, TX 77003",
    notes: ["🔮 Esphora Projection Dome", "🏠 Houston Hall — air-conditioned", "📍 Near Shell Energy Stadium"],
    matchCount: 7,
    hasZones: false,
    faqs: [
      { q: "Where is the FIFA Fan Festival™ in Houston?", a: "In EaDo (East Downtown), near Shell Energy Stadium. Exact address and directions at fwc26houston.com/fifafanfestivalhou." },
      { q: "Is the Houston Fan Festival free?", a: "Yes — free admission. VIP cabanas may have an additional cost. Check the official website for any ticketed programming." },
      { q: "Do I need a FIFA match ticket to attend?", a: "No. Completely separate from NRG Stadium — you watch live broadcasts on giant screens. No World Cup ticket required." },
      { q: "What is the Esphora dome?", a: "A large 360° projection dome — an immersive environment where matches are projected across the full interior. Unique to Houston's Fan Festival." },
      { q: "What is Houston Hall?", a: "The large indoor, air-conditioned viewing space at the Fan Festival — cool, covered match viewing on giant screens, ideal for Houston's summer heat." },
      { q: "When is it open?", a: "All 34 match days of the World Cup — June 11 through July 19, 2026. Open every day of the tournament, not just Houston matches." },
    ],
  },
  dallas: {
    citySlug: "dallas",
    cityName: "Dallas",
    badge: "Official FIFA Fan Festival™ · Dallas",
    h1a: "FIFA Fan Festival™",
    h1b: "Dallas",
    subtitle: "Fair Park — 1 Million Square Feet of World Cup Celebration",
    addrShort: "Fair Park — Lots 9 & 10, The Pavilion Amphitheater",
    addrFull: "Fair Park, Dallas, TX 75210",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Fair+Park+Dallas+TX+FIFA+Fan+Festival",
    dates: "June 11 – July 19, 2026",
    capacity: 35000,
    website: "https://www.dallasfwc26.com/our-venues/fan-festival/",
    cover: "https://www.dallasfwc26.com/wp-content/uploads/2026/04/FFFdallas_render01_Feb16-1024x576.jpg",
    p1: "The official FIFA Fan Festival™ for Dallas World Cup 2026 matches is a free, open-to-all, 1-million-square-foot celebration at historic Fair Park. Spanning Lots 9 & 10 centered on The Pavilion Amphitheater — one of the largest fan zones in the entire World Cup, capacity 35,000 fans.",
    p2: "The Pavilion is the centerpiece: a covered main stage with 7,000 dedicated seats plus expansive hillside lawn seating. Surrounding it is a walkable village of mini-pitches, sponsor experience zones, international food courts, and immersive fan activations across the historic Fair Park grounds.",
    features: [
      { icon: Tv, label: "The Pavilion — 7,000 Covered Seats + Hillside Lawn" },
      { icon: Tv, label: "Giant Match-Viewing Screens Throughout" },
      { icon: Star, label: "Mini-Pitches & Interactive Soccer" },
      { icon: Music, label: "Concerts & Live Entertainment" },
      { icon: Sparkles, label: "Sponsor Experience Zones" },
      { icon: Utensils, label: "International Food Courts" },
      { icon: Ticket, label: "Free Admission — 1M sq ft Campus" },
      { icon: Globe, label: "Historic Fair Park Grounds" },
    ],
    sidebarName: "FIFA Fan Festival™ Dallas",
    sidebarAddr: "Fair Park, Dallas, TX 75210",
    notes: ["🎭 The Pavilion — main stage", "⛺ Hillside lawn seating", "📍 Historic Fair Park"],
    matchCount: 9,
    hasZones: false,
    faqs: [
      { q: "Where is the FIFA Fan Festival™ in Dallas?", a: "At Fair Park, Dallas — Lots 9 & 10 and The Pavilion Amphitheater, 3809 Grand Ave, Dallas, TX 75210." },
      { q: "Is the Dallas Fan Festival free?", a: "Yes — free, open-to-all. Some concerts or VIP areas may have separate ticketing; check dallasfwc26.com." },
      { q: "Do I need a FIFA match ticket to attend?", a: "No. Separate from AT&T Stadium in Arlington. You watch live broadcasts on The Pavilion screens — no World Cup ticket required." },
      { q: "What is The Pavilion?", a: "The main stage with 7,000 covered seats plus hillside lawn seating — hosting live match broadcasts, headliner concerts, and main stage performances." },
      { q: "How large is the Dallas Fan Festival?", a: "Approximately 1 million square feet across Fair Park — capacity 35,000 fans, arranged as a walkable village with viewing, food, entertainment, and soccer zones." },
      { q: "How do I get to Fair Park?", a: "DART Light Rail (Green Line, Fair Park Station), by car via I-30 or I-45, or rideshare. DART recommended on match days as parking can be limited." },
    ],
  },
  miami: {
    citySlug: "miami",
    cityName: "Miami",
    badge: "Official FIFA Fan Festival™ · Miami",
    h1a: "FIFA Fan Festival™",
    h1b: "Miami",
    subtitle: "Bayfront Park — Downtown Waterfront World Cup Celebration",
    addrShort: "Bayfront Park, 301 N Biscayne Blvd, Miami, FL 33132",
    addrFull: "301 N Biscayne Blvd, Miami, FL 33132",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Bayfront+Park+301+N+Biscayne+Blvd+Miami+FL+33132",
    dates: "June 13 – July 5, 2026 · Free Admission",
    capacity: 30000,
    website: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/fifa-fan-festival/miami",
    cover: "https://images.unsplash.com/photo-1514214246283-d427a95c5d2f?w=1600&q=80",
    p1: "The official FIFA Fan Festival™ Miami brings the World Cup to Bayfront Park in the heart of Downtown Miami. From June 13 through July 5, the waterfront park becomes the city's main public gathering point for fútbol, culture, live screenings, food, and family-friendly programming.",
    p2: "Fans can watch World Cup matches live on massive LED screens, with concerts and cultural performances hosted at the Bayfront Park Amphitheater between fixtures. The 23-day festival also includes interactive installations, local food and beverage vendors, merchandise zones, and a waterfront atmosphere designed for up to 30,000 fans per day.",
    features: [
      { icon: Tv, label: "Massive LED Screens for Live Match Broadcasts" },
      { icon: Music, label: "Daily Concerts & Cultural Performances" },
      { icon: Globe, label: "Bayfront Park Waterfront Setting" },
      { icon: Utensils, label: "Local Food & Beverage Vendors" },
      { icon: Sparkles, label: "Interactive Fan Installations" },
      { icon: Star, label: "Family-Friendly Programming" },
      { icon: Ticket, label: "Free Admission — No Tickets Required" },
      { icon: Shield, label: "Official FIFA Fan Festival™ Site" },
    ],
    sidebarName: "FIFA Fan Festival™ Miami",
    sidebarAddr: "Bayfront Park, 301 N Biscayne Blvd, Miami, FL 33132",
    notes: ["Bayfront Park Amphitheater", "Massive LED match screens", "Downtown Miami waterfront"],
    matchCount: 7,
    hasZones: false,
    faqs: [
      { q: "Where is the FIFA Fan Festival™ in Miami?", a: "The official Miami FIFA Fan Festival™ is at Bayfront Park, 301 N Biscayne Blvd, Miami, FL 33132, in Downtown Miami along Biscayne Bay." },
      { q: "When is the Miami Fan Festival open?", a: "The Miami Fan Festival runs from June 13 through July 5, 2026." },
      { q: "Is the Miami Fan Festival free?", a: "Yes. The event is free to the public, with no tickets or registration required for general admission." },
      { q: "Do I need a FIFA match ticket to attend?", a: "No. The Fan Festival is separate from Hard Rock Stadium. Fans can watch live World Cup broadcasts at Bayfront Park without a match ticket." },
      { q: "What can fans expect at Bayfront Park?", a: "Massive LED screens, daily concerts, cultural performances, interactive installations, family programming, food and beverage vendors, merchandise zones, and waterfront match-day energy." },
      { q: "How many fans can attend?", a: "The festival is designed as Miami's main public gathering point and is expected to draw up to 30,000 people per day." },
    ],
  },
  atlanta: {
    citySlug: "atlanta",
    cityName: "Atlanta",
    badge: "Official FIFA Fan Festival™ · Atlanta",
    h1a: "FIFA Fan Festival™",
    h1b: "Atlanta",
    subtitle: "Centennial Olympic Park — Downtown Atlanta World Cup Celebration",
    addrShort: "Centennial Olympic Park, 265 Park Ave SW, Atlanta, GA 30313",
    addrFull: "265 Park Ave SW, Atlanta, GA 30313",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Centennial+Olympic+Park+265+Park+Ave+SW+Atlanta+GA+30313",
    dates: "June 11 – July 15, 2026 · Select Tournament Days",
    capacity: 0,
    website: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/fifa-fan-festival/atlanta",
    cover: "https://images.unsplash.com/photo-1575917649705-5b59aaa12e6b?w=1600&q=80",
    p1: "The official FIFA Fan Festival™ Atlanta will take over Centennial Olympic Park in Downtown Atlanta, creating the city's main public watch party for the 2026 World Cup. The location brings the tournament back to a landmark built to welcome the world during the 1996 Summer Olympics, as the park celebrates its 30th anniversary.",
    p2: "Operating on select days from June 11 through July 15, the festival divides the park into dynamic zones for fans of all ages: a Main Stage with a 40-foot match screen and daily concerts, The Pitch for culture and technology experiences, The Playground for family activities, and food, artists, makers, and vendors showcasing Georgia's culinary scene.",
    features: [
      { icon: Tv, label: "Main Stage — 40-Foot Screen for Live Matches" },
      { icon: Music, label: "Daily Concerts & Special Events" },
      { icon: Sparkles, label: "The Pitch — Culture, Podcasts, AR & VR Audio" },
      { icon: Star, label: "The Playground — Family Soccer Activities" },
      { icon: Utensils, label: "Georgia Food Vendors & International Bites" },
      { icon: Globe, label: "Centennial Olympic Park 30th Anniversary" },
      { icon: Ticket, label: "Free General Entry — Advance Registration Required" },
      { icon: Shield, label: "GA+, VIP & Private Suite Upgrades Available" },
    ],
    sidebarName: "FIFA Fan Festival™ Atlanta",
    sidebarAddr: "Centennial Olympic Park, 265 Park Ave SW, Atlanta, GA 30313",
    notes: ["Main Stage — 40-foot screen", "The Pitch — culture + tech", "The Playground — family zone"],
    matchCount: 8,
    hasZones: false,
    faqs: [
      { q: "Where is the FIFA Fan Festival™ in Atlanta?", a: "The official Atlanta FIFA Fan Festival™ is at Centennial Olympic Park, 265 Park Ave SW, Atlanta, GA 30313." },
      { q: "When is the Atlanta Fan Festival open?", a: "The Atlanta Fan Festival operates on select days from June 11 through July 15, 2026." },
      { q: "Is the Atlanta Fan Festival free?", a: "General entry is free, but advance registration is required. Upgraded ticket options such as GA+, VIP, and private suites are available for purchase." },
      { q: "Do I need a FIFA match ticket to attend?", a: "No. The Fan Festival is separate from Mercedes-Benz Stadium. It is Atlanta's main public watch party and fan experience for World Cup 2026." },
      { q: "What are the main zones inside the festival?", a: "The Main Stage, The Pitch, The Playground, and food and culture zones across Centennial Olympic Park." },
      { q: "How should I get there?", a: "Public transit is strongly recommended. Downtown parking is expected to be highly limited during World Cup match days and festival programming." },
    ],
  },
  "kansas-city": {
    citySlug: "kansas-city",
    cityName: "Kansas City",
    badge: "Official FIFA Fan Festival™ · Kansas City",
    h1a: "FIFA Fan Festival™",
    h1b: "Kansas City",
    subtitle: "National WWI Museum and Memorial — Heart of the Game Celebration",
    addrShort: "National WWI Museum and Memorial, 2 Memorial Dr, Kansas City, MO 64108",
    addrFull: "2 Memorial Dr, Kansas City, MO 64108",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=National+WWI+Museum+and+Memorial+2+Memorial+Dr+Kansas+City+MO+64108",
    dates: "June 11 – July 11, 2026 · 18 Festival Days",
    capacity: 25000,
    website: "https://kansascityfwc26.com/fifa-fan-festival/",
    cover: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=1600&q=80",
    p1: "The official FIFA Fan Festival™ Kansas City welcomes the world to the Heart of the Game at the National WWI Museum and Memorial, creating the region's central gathering place for match viewing, entertainment, food, and fan experiences. The 18-day celebration runs from June 11 through July 11 and serves as Kansas City's front porch to the world.",
    p2: "Designed as a Heartland welcome to the world, the festival features live watch parties and performances across two stages, a 45-foot-by-25-foot primary video board with additional screens, the 65-foot KC Heart Gateway entrance, Premium Garden and Legacy Lounge upgrades, pet-friendly Dog Days, local food and drink, games, and ConnectKC26 transit access.",
    features: [
      { icon: Tv, label: "Two Stages + 45-Foot Primary Video Board" },
      { icon: Music, label: "Live Performances & Themed Programming" },
      { icon: Sparkles, label: "65-Foot Heart-Shaped Entrance Arch" },
      { icon: Star, label: "Skills Challenges, 3v3 Pitches & Multisport Games" },
      { icon: Shield, label: "Trophy Displays & Brand Activations" },
      { icon: Utensils, label: "Local Food, Drinks & Kansas City Hospitality" },
      { icon: Ticket, label: "Free GA Digital Pass — Capacity Limited" },
      { icon: Globe, label: "Premium Garden + Legacy Lounge Upgrades" },
    ],
    sidebarName: "FIFA Fan Festival™ Kansas City",
    sidebarAddr: "National WWI Museum and Memorial, 2 Memorial Dr, Kansas City, MO 64108",
    notes: ["18 festival days", "25,000 capacity limit", "GA digital pass required", "ConnectKC26 transit access"],
    matchCount: 6,
    hasZones: false,
    faqs: [
      { q: "Where is the FIFA Fan Festival™ in Kansas City?", a: "The official Kansas City FIFA Fan Festival™ is at the National WWI Museum and Memorial, 2 Memorial Dr, Kansas City, MO 64108." },
      { q: "When is the Kansas City Fan Festival open?", a: "The festival runs across 18 operating days from June 11 through July 11, 2026, including Kansas City match days, U.S. Men's National Team match days, and July 4." },
      { q: "Is the Kansas City Fan Festival free?", a: "Yes. General admission is free and open to the public, but every guest must secure a digital GA pass. Entry is first-come, first-served and subject to the 25,000-person capacity limit." },
      { q: "Do I need a FIFA match ticket to attend?", a: "No. The Fan Festival is separate from Kansas City Stadium. Fans can watch matches and attend festival programming without a stadium match ticket." },
      { q: "What can fans expect?", a: "Live watch parties, two stages, a 45-foot-by-25-foot primary video board with additional screens, the 65-foot KC Heart Gateway, Premium Garden and Legacy Lounge pass options, pet-friendly Dog Days, merch, soccer activities, and food and drink." },
      { q: "How should I get around?", a: "KC2026 promotes ConnectKC26 bus service, with direct routes to the Fan Festival and regional connections for dining, shopping, entertainment, and match-day movement." },
    ],
  },
  boston: {
    citySlug: "boston",
    cityName: "Boston",
    badge: "Official FIFA Fan Festival™ · Boston",
    h1a: "FIFA Fan Festival™",
    h1b: "Boston",
    subtitle: "City Hall Plaza — Downtown Boston Football Hub",
    addrShort: "Boston City Hall Plaza, 1 City Hall Square",
    addrFull: "1 City Hall Square, Boston, MA 02201",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Boston+City+Hall+Plaza+1+City+Hall+Square+Boston+MA+02201",
    dates: "June 12 – June 27, 2026 · 16 Festival Days",
    capacity: 0,
    website: "https://bostonfwc26.com/fifa-fan-festival/",
    cover: "https://images.unsplash.com/photo-1501979376754-2ff867a4f659?w=1600&q=80",
    p1: "The official FIFA Fan Festival™ Boston will transform Boston City Hall Plaza into the city's central gathering place for FIFA World Cup 2026™ fans, residents, and visitors. Located in the heart of downtown, the festival brings the energy of Boston Stadium match days directly into the city.",
    p2: "The 16-day celebration runs through the group stage from June 12 through June 27, with daily programming aligned to match schedules and live broadcasts of 2-3 matches per day. Fans can expect football-themed activities, entertainment throughout the day, a curated food and beverage program focused on local flavors, and a Cultural Showcase featuring local artists, musicians, and performers.",
    features: [
      { icon: Tv, label: "Live Broadcasts of 2-3 Matches Per Day" },
      { icon: Music, label: "Cultural Showcase with Local Performers" },
      { icon: Star, label: "Football-Themed Activities for Fans" },
      { icon: Utensils, label: "Curated Local Food & Beverage Program" },
      { icon: Globe, label: "Downtown Boston City Hall Plaza Setting" },
      { icon: Sparkles, label: "Community Celebration of Regional Creativity" },
      { icon: Ticket, label: "Free Admission — Advance Registration Required" },
      { icon: Shield, label: "Public Transit Strongly Recommended" },
    ],
    sidebarName: "FIFA Fan Festival™ Boston",
    sidebarAddr: "Boston City Hall Plaza, 1 City Hall Square, Boston, MA 02201",
    notes: ["16 group-stage festival days", "2-3 live matches per day", "Free entry with registration", "MBTA recommended"],
    matchCount: 7,
    hasZones: false,
    faqs: [
      { q: "Where is the FIFA Fan Festival™ in Boston?", a: "The official Boston FIFA Fan Festival™ is at Boston City Hall Plaza, 1 City Hall Square, Boston, MA 02201, in the heart of downtown." },
      { q: "When is the Boston Fan Festival open?", a: "The festival runs for 16 days during the FIFA World Cup 2026™ group stage, beginning June 12 and running through June 27, 2026." },
      { q: "Is the Boston Fan Festival free?", a: "Yes. The Boston Fan Festival is free and open to the public, with advance registration required. The host committee says more registration details will be announced." },
      { q: "Do I need a FIFA match ticket to attend?", a: "No. The Fan Festival is separate from Boston Stadium in Foxborough. Fans can watch live broadcasts and enjoy festival programming without a stadium match ticket." },
      { q: "What can fans expect at City Hall Plaza?", a: "Live match broadcasts, football-themed activities, entertainment throughout the day, a local food and beverage program, and a Cultural Showcase featuring artists, musicians, and performers from the region." },
      { q: "How should I get there?", a: "Public transit is strongly recommended. Downtown roads and transit are expected to be busier than usual on match days, and local walking, cycling, and road routes may have temporary changes." },
    ],
  },
  philadelphia: {
    citySlug: "philadelphia",
    cityName: "Philadelphia",
    badge: "Official FIFA Fan Festival™ · Philadelphia",
    h1a: "FIFA Fan Festival™",
    h1b: "Philadelphia",
    subtitle: "Lemon Hill — East Fairmount Park World Cup Celebration",
    addrShort: "Lemon Hill, East Fairmount Park, 1 Lemon Hill Drive",
    addrFull: "1 Lemon Hill Drive, Philadelphia, PA 19130",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Lemon+Hill+1+Lemon+Hill+Drive+Philadelphia+PA+19130",
    dates: "June 11 – July 19, 2026 · All 39 Tournament Days",
    capacity: 0,
    website: "https://phillyfwc26.com/fifa-fan-fest",
    cover: "https://images.unsplash.com/photo-1569761316261-9a8696fa2ca3?w=1600&q=80",
    p1: "Philadelphia's official FIFA Fan Festival™ will run for all 39 days of the FIFA World Cup 2026™ at Lemon Hill in Fairmount Park, described by FIFA as the largest landscaped park in the United States. Free and open to the public with online registration, the festival is designed as a continuous celebration of community, culture, music, and sport during a landmark summer for Philadelphia.",
    p2: "On match days, fans can expect live broadcasts, watch parties, food vendors, world-class entertainment, family-friendly activities, and immersive activations. Non-match days add ticketed concert experiences and cultural programming, while the Vendor Village, Philly Phlavor food truck lineup, and Pennsylvania Pavilion highlight local makers, regional food, and the wider Commonwealth as part of Philadelphia Soccer 2026's lasting legacy.",
    features: [
      { icon: Tv, label: "Live Match Watch Parties Across the Tournament" },
      { icon: Music, label: "Concerts, Cultural Programming & Live Entertainment" },
      { icon: Utensils, label: "Philly Phlavor Rotating Food Truck Lineup" },
      { icon: Sparkles, label: "Immersive Activations & Photo Moments" },
      { icon: Star, label: "Family Activities + Vendor Village" },
      { icon: Globe, label: "Pennsylvania Pavilion Presented by Visit PA" },
      { icon: Ticket, label: "Free Entry — Online Registration Required" },
      { icon: Shield, label: "Security Screening at Secured Entry Point" },
    ],
    sidebarName: "FIFA Fan Festival™ Philadelphia",
    sidebarAddr: "Lemon Hill, 1 Lemon Hill Drive, Philadelphia, PA 19130",
    notes: ["All 39 tournament days", "Entry at Kelly Drive and Sedgley Drive", "First come, first served", "SEPTA, PHLASH, walking, and biking access"],
    matchCount: 6,
    hasZones: false,
    faqs: [
      { q: "Where is the FIFA Fan Festival™ in Philadelphia?", a: "The official Philadelphia FIFA Fan Festival™ is at Lemon Hill in East Fairmount Park, 1 Lemon Hill Drive, Philadelphia, PA 19130. Guests enter through the secured entry point at Kelly Drive and Sedgley Drive." },
      { q: "When is the Philadelphia Fan Festival open?", a: "The festival runs June 11 through July 19, 2026, covering all 39 days of the FIFA World Cup 2026™ tournament." },
      { q: "Is the Philadelphia Fan Festival free?", a: "Yes. It is free and open to the public, with simple online registration required before entering. Access each day is first come, first served and subject to venue capacity." },
      { q: "Do I need a FIFA match ticket to attend?", a: "No. The Fan Festival is separate from Lincoln Financial Field. Fans can watch match broadcasts and attend festival programming without a stadium match ticket." },
      { q: "What can fans expect at Lemon Hill?", a: "Live match broadcasts, match-day watch parties, food vendors, family-friendly activities, world-class entertainment, immersive partner activations, a Vendor Village, Philly Phlavor food trucks, Pennsylvania Pavilion programming, and concerts or cultural programming on non-match days." },
      { q: "How should I get there?", a: "The site is primarily pedestrian-accessed. Fans are encouraged to walk, bike, or use public transportation, including SEPTA routes, the Philly PHLASH loop, and Indego bike share." },
    ],
  },
  "new-york": {
    citySlug: "new-york",
    cityName: "New York / New Jersey",
    badge: "Official NYNJ Fan Village · Rockefeller Center",
    h1a: "NYNJ World Cup 26",
    h1b: "Fan Village",
    subtitle: "Rockefeller Center — Telemundo Fan Village in Midtown Manhattan",
    addrShort: "30 Rockefeller Plaza, New York, NY 10112",
    addrFull: "30 Rockefeller Plaza, New York, NY 10112",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=30+Rockefeller+Plaza+New+York+NY+10112",
    dates: "July 6 – July 19, 2026 · Open to the Public",
    capacity: 0,
    website: "https://www.rockefellercenter.com/events/world-cup-2026",
    cover: "https://www.rockefellercenter.com/_next/image?q=75&url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2Fbs9rmafh%2Fecomm-main%2F9edb5e95f86ac5988321de75a9eb3a19a43f6cc7-3949x1974.jpg&w=3840",
    p1: "The official NYNJ World Cup 26 & Telemundo Fan Village at Rockefeller Center brings the World Cup to Midtown Manhattan from July 6 through July 19. Hosted by the FIFA World Cup 26 NYNJ Host Committee, Telemundo, and Rockefeller Center, the Fan Village transforms 30 Rockefeller Plaza into a public watch party destination for fans from around the world.",
    p2: "At the heart of the Fan Village, The Rink at Rockefeller Center becomes a soccer pitch surrounded by large screens for live match broadcasts. Across the Plaza, fans can explore Channel Gardens tributes to World Cup champions, family-friendly programming, brand activations, Top of the Rock soccer experiences, and the FIFA Museum Presented by Hyundai at Rockefeller Center.",
    features: [
      { icon: Tv, label: "The Rink — Live Match Broadcasts on Large Screens" },
      { icon: Star, label: "Dynamic Soccer Pitch at Rockefeller Center" },
      { icon: Sparkles, label: "Channel Gardens Champion Tributes" },
      { icon: Globe, label: "Top of the Rock Official Viewpoint" },
      { icon: Shield, label: "FIFA Museum Presented by Hyundai" },
      { icon: Utensils, label: "Restaurants, Bars & Midtown Dining Nearby" },
      { icon: Ticket, label: "Open to the Public July 6–19" },
      { icon: Music, label: "Family Programming & Brand Activations" },
    ],
    sidebarName: "NYNJ World Cup 26 & Telemundo Fan Village",
    sidebarAddr: "30 Rockefeller Plaza, New York, NY 10112",
    notes: ["The Rink — live match viewing", "Channel Gardens champion tribute", "Top of the Rock viewpoint"],
    matchCount: 8,
    hasZones: false,
    faqs: [
      { q: "Where is the New York / New Jersey Fan Village?", a: "The NYNJ World Cup 26 & Telemundo Fan Village is at Rockefeller Center, 30 Rockefeller Plaza, New York, NY 10112." },
      { q: "When is the Fan Village open?", a: "Rockefeller Center lists the Fan Village as open to the public from July 6 through July 19, 2026." },
      { q: "Is this different from MetLife Stadium?", a: "Yes. MetLife Stadium hosts the World Cup matches. The Rockefeller Center Fan Village is a public Manhattan watch party and fan experience where fans can gather for live broadcasts and programming." },
      { q: "What happens at The Rink?", a: "The Rink at Rockefeller Center transforms into a soccer pitch with large screens for live match broadcasts and fan gatherings." },
      { q: "What else is part of the Fan Village?", a: "The experience includes Channel Gardens tributes to World Cup champions, Top of the Rock soccer moments, FIFA Museum programming, family-friendly activities, and brand activations across the Plaza." },
      { q: "Do I need a match ticket?", a: "No. The Fan Village is separate from the stadium matches and is open to the public. Some related attractions, like Top of the Rock, may require tickets." },
    ],
  },
} as const;

type CityKey = keyof typeof FAN_FESTS;

/* ─── Styles ─────────────────────────────────────────────────────────────────── */

const CSS = `
  :root{--mw-accent:oklch(0.72 0.19 28);}
  .ff{background:var(--background);min-height:100vh;color:var(--foreground);}
  .ff-bc{max-width:1200px;margin:0 auto;padding:20px 24px 0;display:flex;align-items:center;gap:6px;font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--muted-foreground);letter-spacing:.05em;}
  .ff-bc a{color:var(--muted-foreground);text-decoration:none;}.ff-bc a:hover{color:var(--mw-accent);}
  .ff-bc .sep{opacity:.4;}
  .ff-hero{position:relative;overflow:hidden;min-height:580px;display:flex;align-items:flex-end;}
  .ff-hi{position:absolute;inset:0;}.ff-hi img{width:100%;height:100%;object-fit:cover;}
  .ff-ho{position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.92) 0%,rgba(0,0,0,.5) 50%,rgba(0,0,0,.15) 100%);}
  .ff-hw{position:relative;z-index:2;max-width:1200px;margin:0 auto;padding:60px 24px 60px;width:100%;}
  .ff-badge{display:inline-flex;align-items:center;gap:8px;font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;padding:6px 14px;border-radius:999px;background:var(--mw-accent);color:#0a0b0d;font-weight:800;margin-bottom:20px;}
  .ff-badge .dot{width:6px;height:6px;background:#0a0b0d;border-radius:50%;animation:bd 1.4s infinite;}.@keyframes bd{0%,100%{opacity:.4;}50%{opacity:1;}}
  @keyframes bd{0%,100%{opacity:.4;}50%{opacity:1;}}
  .ff-h1{font-size:clamp(2.4rem,5.5vw,4rem);font-weight:900;line-height:1.05;color:#fff;margin:0 0 10px;letter-spacing:-.03em;font-family:"Space Grotesk",sans-serif;}
  .ff-sub{font-size:1.05rem;color:rgba(255,255,255,.75);margin-bottom:6px;font-style:italic;}
  .ff-addr{display:flex;align-items:center;gap:6px;font-size:13px;color:rgba(255,255,255,.55);margin-bottom:6px;}
  .ff-dates{display:flex;align-items:center;gap:6px;font-family:"JetBrains Mono",monospace;font-size:12px;color:var(--mw-accent);font-weight:700;margin-bottom:32px;}
  .ff-btns{display:flex;flex-wrap:wrap;gap:12px;}
  .ff-bp{display:inline-flex;align-items:center;gap:8px;padding:13px 26px;border-radius:999px;font-size:14px;font-weight:800;text-decoration:none;background:var(--mw-accent);color:#0a0b0d;transition:all .2s;}
  .ff-bp:hover{transform:translateY(-2px);box-shadow:0 12px 32px color-mix(in srgb,var(--mw-accent) 35%,transparent);}
  .ff-bg{display:inline-flex;align-items:center;gap:8px;padding:13px 26px;border-radius:999px;font-size:14px;font-weight:700;text-decoration:none;border:1px solid rgba(255,255,255,.25);color:rgba(255,255,255,.8);transition:all .2s;}
  .ff-bg:hover{border-color:rgba(255,255,255,.6);color:#fff;}
  .ff-wrap{max-width:1200px;margin:0 auto;padding:0 24px;}
  .ff-body{padding:72px 0 0;}
  .ff-grid{display:grid;grid-template-columns:1fr 360px;gap:48px;align-items:start;}
  .ff-sh{display:flex;align-items:baseline;gap:14px;margin-bottom:24px;}
  .ff-st{font-family:"Space Grotesk",sans-serif;font-weight:900;font-size:1.5rem;color:var(--foreground);letter-spacing:-.01em;}
  .ff-stag{font-family:"JetBrains Mono",monospace;font-size:10px;color:var(--mw-accent);letter-spacing:.1em;border:1px solid color-mix(in srgb,var(--mw-accent) 35%,transparent);padding:3px 8px;border-radius:4px;font-weight:700;}
  .ff-p{font-size:15px;color:var(--muted-foreground);line-height:1.8;margin-bottom:28px;}
  .ff-fg{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:32px;}
  .ff-fi{display:flex;align-items:center;gap:10px;padding:11px 13px;border:1px solid var(--border);background:var(--card);font-size:13px;color:var(--muted-foreground);}
  .ff-fi svg{color:var(--mw-accent);flex-shrink:0;}
  .ff-cap{display:flex;align-items:center;gap:6px;font-family:"JetBrains Mono",monospace;font-size:12px;color:var(--muted-foreground);padding-top:16px;border-top:1px solid var(--border);}
  .ff-side{border:1px solid color-mix(in srgb,var(--mw-accent) 28%,transparent);background:linear-gradient(145deg,color-mix(in srgb,var(--mw-accent) 5%,transparent),transparent),var(--card);padding:26px;display:flex;flex-direction:column;gap:11px;position:sticky;top:80px;}
  .ff-sl{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--mw-accent);font-weight:700;margin-bottom:3px;}
  .ff-sn{font-family:"Space Grotesk",sans-serif;font-size:16px;font-weight:900;color:var(--foreground);margin-bottom:2px;}
  .ff-sa{font-size:12px;color:var(--muted-foreground);display:flex;align-items:flex-start;gap:5px;line-height:1.4;}
  .ff-div{height:1px;background:var(--border);margin:2px 0;}
  .ff-snotes{font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--muted-foreground);display:flex;flex-direction:column;gap:3px;}
  .ff-sb2{display:flex;justify-content:center;align-items:center;gap:7px;padding:11px 14px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;transition:all .18s;}
  .ff-sb2.p{background:var(--mw-accent);color:#0a0b0d;}.ff-sb2.p:hover{opacity:.88;}
  .ff-sb2.g{border:1px solid var(--border);color:var(--muted-foreground);}.ff-sb2.g:hover{border-color:var(--muted-foreground);color:var(--foreground);}
  .ff-cta{padding:72px 0 80px;}
  .ff-cbox{border:1px solid var(--border);background:var(--card);padding:40px 44px;display:grid;grid-template-columns:1fr auto;gap:40px;align-items:center;}
  .ff-ck{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--mw-accent);margin-bottom:12px;font-weight:700;}
  .ff-ch{font-family:"Space Grotesk",sans-serif;font-size:1.65rem;font-weight:900;color:var(--foreground);margin-bottom:10px;line-height:1.1;}
  .ff-cp{font-size:14px;color:var(--muted-foreground);line-height:1.65;max-width:500px;}
  .ff-cbtns{display:flex;flex-direction:column;gap:10px;min-width:200px;}
  .ff-cb{display:flex;justify-content:center;align-items:center;gap:7px;padding:12px 20px;border-radius:999px;font-size:13px;font-weight:700;text-decoration:none;transition:all .18s;}
  .ff-cb.p{background:var(--mw-accent);color:#0a0b0d;}.ff-cb.p:hover{opacity:.88;}
  .ff-cb.g{border:1px solid var(--border);color:var(--muted-foreground);}.ff-cb.g:hover{border-color:var(--muted-foreground);color:var(--foreground);}
  .ff-faqw{padding:0 0 96px;}
  .ff-faq{border:1px solid var(--border);overflow:hidden;}
  .ff-faq-item{border-bottom:1px solid var(--border);}.ff-faq-item:last-child{border-bottom:none;}
  .ff-faq-q{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;cursor:pointer;font-family:"Space Grotesk",sans-serif;font-size:15px;font-weight:700;color:var(--foreground);background:none;border:none;width:100%;text-align:left;transition:background .12s;}
  .ff-faq-q:hover{background:rgba(255,255,255,.03);}
  .ff-faq-q svg{flex-shrink:0;color:var(--muted-foreground);transition:transform .2s;}.ff-faq-q.open svg{transform:rotate(180deg);}
  .ff-faq-a{padding:0 24px 20px;font-size:14px;color:var(--muted-foreground);line-height:1.7;}
  @media(max-width:1024px){.ff-grid{grid-template-columns:1fr;}.ff-cbox{grid-template-columns:1fr;gap:24px;}.ff-side{position:static;}}
  @media(max-width:640px){.ff-fg{grid-template-columns:1fr;}.ff-h1{font-size:2.1rem;}.ff-cbox{padding:28px 20px;}.ff-hw{padding:40px 20px 48px;}}
`;

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ff-faq-item">
      <button className={`ff-faq-q${open ? " open" : ""}`} onClick={() => setOpen((v) => !v)}>
        {q}<ChevronDown size={16} />
      </button>
      {open && <div className="ff-faq-a">{a}</div>}
    </div>
  );
}

export default function FanFestivalPage() {
  const pathname = usePathname() ?? "";
  // pathname: "/world-cup/houston/fan-festival" → parts[2] = "houston"
  const slug = pathname.split("/")[2] as CityKey;
  // Only the six host cities below have an official FIFA Fan Festival entry.
  // Any other slug used to silently fall back to Seattle's page — render 404 instead.
  if (!FAN_FESTS[slug]) notFound();
  const d = FAN_FESTS[slug];

  return (
    <div className="ff">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <FloatingNav />

      <div className="ff-bc">
        <Link href="/world-cup">World Cup 2026</Link>
        <span className="sep">/</span>
        <Link href={`/world-cup/${d.citySlug}`}>{d.cityName}</Link>
        <span className="sep">/</span>
        <span>Official FIFA Fan Festival™</span>
      </div>

      <section className="ff-hero">
        <div className="ff-hi">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={d.cover} alt={`FIFA Fan Festival ${d.cityName}`} />
        </div>
        <div className="ff-ho" />
        <div className="ff-hw">
          <div className="ff-badge"><span className="dot" />{d.badge}</div>
          <h1 className="ff-h1">{d.h1a}<br />{d.h1b}</h1>
          <div className="ff-sub">{d.subtitle}</div>
          <div className="ff-addr"><MapPin size={13} />{d.addrShort}</div>
          <div className="ff-dates"><Calendar size={13} />{d.dates}</div>
          <div className="ff-btns">
            <a href={d.website} target="_blank" rel="noopener noreferrer" className="ff-bp">
              <ExternalLink size={15} /> Official {d.cityName} Fan Festival Site
            </a>
            {d.hasZones && (
              <Link href={`/world-cup/${d.citySlug}/fan-zones`} className="ff-bg">
                <MapPin size={14} /> Community Fan Zones
              </Link>
            )}
            <Link href={`/world-cup/${d.citySlug}`} className="ff-bg">
              <ChevronRight size={14} /> {d.cityName} Watch Parties
            </Link>
          </div>
        </div>
      </section>

      <section className="ff-body">
        <div className="ff-wrap">
          <div className="ff-grid">
            <div>
              <div className="ff-sh">
                <div className="ff-st">About the Fan Festival</div>
                <span className="ff-stag">{d.cityName.toUpperCase()}</span>
              </div>
              <p className="ff-p">{d.p1}</p>
              <p className="ff-p" style={{ marginTop: -16 }}>{d.p2}</p>
              <div className="ff-fg">
                {d.features.map((f) => {
                  const Icon = f.icon;
                  return (
                    <div key={f.label} className="ff-fi">
                      <Icon size={15} />{f.label}
                    </div>
                  );
                })}
              </div>
              <div className="ff-cap">
                <Users size={13} />
                {d.capacity ? `Up to ${d.capacity.toLocaleString()} fans · ` : ""}{d.matchCount} {d.cityName} matches
              </div>
            </div>

            <div className="ff-side">
              <div>
                <div className="ff-sl">Official FIFA Fan Festival™</div>
                <div className="ff-sn">{d.sidebarName}</div>
                <div className="ff-sa"><MapPin size={11} style={{ flexShrink: 0, marginTop: 2 }} />{d.sidebarAddr}</div>
              </div>
              <div className="ff-div" />
              <div className="ff-snotes">{d.notes.map((n) => <span key={n}>{n}</span>)}</div>
              <div className="ff-div" />
              <a href={d.website} target="_blank" rel="noopener noreferrer" className="ff-sb2 p">
                <Globe size={14} /> Visit Official Website
              </a>
              <a href={d.mapsUrl} target="_blank" rel="noopener noreferrer" className="ff-sb2 g">
                <MapPin size={13} /> Get Directions
              </a>
              <Link href={`/world-cup/${d.citySlug}`} className="ff-sb2 g">
                <Building2 size={13} /> {d.cityName} Watch Parties
              </Link>
              {d.hasZones && (
                <Link href={`/world-cup/${d.citySlug}/fan-zones`} className="ff-sb2 g">
                  <MapPin size={13} /> Community Fan Zones
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="ff-cta">
        <div className="ff-wrap">
          <div className="ff-cbox">
            <div>
              <div className="ff-ck">Bars &amp; Restaurants Near the Fan Festival</div>
              <div className="ff-ch">Find a Watch Party Venue Nearby</div>
              <p className="ff-cp">
                Looking for a bar, restaurant, or rooftop near the {d.cityName} Fan Festival?
                MatchWatch lists hundreds of venues hosting World Cup watch parties across {d.cityName}.
              </p>
            </div>
            <div className="ff-cbtns">
              <Link href={`/world-cup/${d.citySlug}`} className="ff-cb p">
                <Building2 size={15} /> {d.cityName} Watch Parties
              </Link>
              <Link href="/for-venues/register" className="ff-cb g">
                Register Your Venue — Free
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="ff-faqw">
        <div className="ff-wrap">
          <div className="ff-sh">
            <div className="ff-st">FAQ</div>
            <span className="ff-stag">FIFA FAN FESTIVAL™ {d.cityName.toUpperCase()}</span>
          </div>
          <div className="ff-faq">
            {d.faqs.map((f) => <Faq key={f.q} q={f.q} a={f.a} />)}
          </div>
          <div style={{ marginTop: 48, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href={d.website} target="_blank" rel="noopener noreferrer" className="ff-bp" style={{ textDecoration: "none" }}>
              <Globe size={14} /> Official Fan Festival Site
            </a>
            {d.hasZones && (
              <Link href={`/world-cup/${d.citySlug}/fan-zones`} className="ff-bg" style={{ textDecoration: "none" }}>
                <MapPin size={14} /> Community Fan Zones
              </Link>
            )}
            <Link href={`/world-cup/${d.citySlug}`} className="ff-bg" style={{ textDecoration: "none" }}>
              <ChevronRight size={14} /> All {d.cityName} Watch Parties
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
