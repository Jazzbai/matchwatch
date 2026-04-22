-- Step 1: Preview what will be deleted
SELECT l.id, l.name, l.external_id, COUNT(m.id) AS match_count
FROM leagues l
LEFT JOIN matches m ON m.league_id = l.id
WHERE
    l.external_id = 'oef91566'
    OR l.name ILIKE '%qualif%'
    OR l.name ILIKE '%playoff%'
    OR l.name ILIKE '%prelim%'
    OR l.name ILIKE '%round%'
GROUP BY l.id, l.name, l.external_id;

-- Step 2: Preview qualification matches by stage
SELECT m.id, m.external_match_id, m.stage, m.match_date_utc, l.name AS league_name
FROM matches m
JOIN leagues l ON l.id = m.league_id
WHERE
    m.stage ILIKE '%qualif%'
    OR m.stage ILIKE '%prelim%'
    OR l.external_id = 'oef91566'
ORDER BY m.match_date_utc
LIMIT 50;

-- Step 3: Delete bookings for affected venue_events (to avoid FK violations)
DELETE FROM bookings
WHERE venue_event_id IN (
    SELECT ve.id FROM venue_events ve
    JOIN matches m ON m.id = ve.match_id
    JOIN leagues l ON l.id = m.league_id
    WHERE
        m.stage ILIKE '%qualif%'
        OR m.stage ILIKE '%prelim%'
        OR l.external_id = 'oef91566'
);

-- Step 4: Delete venue_events for affected matches
DELETE FROM venue_events
WHERE match_id IN (
    SELECT m.id FROM matches m
    JOIN leagues l ON l.id = m.league_id
    WHERE
        m.stage ILIKE '%qualif%'
        OR m.stage ILIKE '%prelim%'
        OR l.external_id = 'oef91566'
);

-- Step 5: Delete the qualification matches
DELETE FROM matches
WHERE
    stage ILIKE '%qualif%'
    OR stage ILIKE '%prelim%'
    OR league_id IN (
        SELECT id FROM leagues
        WHERE external_id = 'oef91566'
    );

-- Step 6: Delete the qualification league(s)
DELETE FROM leagues
WHERE
    external_id = 'oef91566'
    OR name ILIKE '%qualif%'
    OR name ILIKE '%prelim%';

-- Confirm
SELECT COUNT(*) AS remaining_matches FROM matches;
SELECT COUNT(*) AS remaining_leagues FROM leagues;
