-- Remove all matches + league for 0EF91D66-2DBA-4BAA-B3D5-6564FB9FA632

-- 1. Preview
SELECT id, name, external_id FROM leagues WHERE id = '0ef91d66-2dba-4baa-b3d5-6564fb9fa632';
SELECT COUNT(*) AS matches_to_delete FROM matches WHERE league_id = '0ef91d66-2dba-4baa-b3d5-6564fb9fa632';

-- 2. Drop bookings for any venue_events on these matches
DELETE FROM bookings
WHERE venue_event_id IN (
    SELECT ve.id FROM venue_events ve
    WHERE ve.match_id IN (
        SELECT id FROM matches WHERE league_id = '0ef91d66-2dba-4baa-b3d5-6564fb9fa632'
    )
);

-- 3. Drop venue_events
DELETE FROM venue_events
WHERE match_id IN (
    SELECT id FROM matches WHERE league_id = '0ef91d66-2dba-4baa-b3d5-6564fb9fa632'
);

-- 4. Drop the matches
DELETE FROM matches WHERE league_id = '0ef91d66-2dba-4baa-b3d5-6564fb9fa632';

-- 5. Drop the league
DELETE FROM leagues WHERE id = '0ef91d66-2dba-4baa-b3d5-6564fb9fa632';

-- 6. Also remove any other obvious qualification/nations leagues
DELETE FROM bookings
WHERE venue_event_id IN (
    SELECT ve.id FROM venue_events ve
    JOIN matches m ON m.id = ve.match_id
    JOIN leagues l ON l.id = m.league_id
    WHERE l.name ILIKE '%nation%' OR l.name ILIKE '%qualif%' OR l.name ILIKE '%world cup%qualif%'
);

DELETE FROM venue_events
WHERE match_id IN (
    SELECT m.id FROM matches m
    JOIN leagues l ON l.id = m.league_id
    WHERE l.name ILIKE '%nation%' OR l.name ILIKE '%qualif%'
);

DELETE FROM matches
WHERE league_id IN (
    SELECT id FROM leagues
    WHERE name ILIKE '%nation%' OR name ILIKE '%qualif%'
);

DELETE FROM leagues
WHERE name ILIKE '%nation%' OR name ILIKE '%qualif%';

-- Confirm
SELECT COUNT(*) AS remaining_matches FROM matches;
SELECT id, name, external_id FROM leagues ORDER BY name;
