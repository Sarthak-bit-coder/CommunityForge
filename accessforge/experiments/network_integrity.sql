-- Read-only Fremont audit. Rows identify defects, disconnected vertices, or
-- off-vertex trip endpoints whose access leg has no stored pedestrian geometry.
WITH RECURSIVE point_records AS (
    SELECT 'node' AS kind, id::text AS id, geom, NULL::text AS node_id FROM network_node
    UNION ALL
    SELECT 'origin', id::text, geom, node_id::text FROM origin
    UNION ALL
    SELECT 'destination', id::text, geom, node_id::text FROM destination
), points AS (
    SELECT *, CASE
        WHEN ST_SRID(geom) = 4326 AND GeometryType(geom) = 'POINT' AND ST_NDims(geom) = 2
        -- Geographic area of UTM zone 10N (EPSG:32610).
        THEN ST_X(geom) BETWEEN -126 AND -120 AND ST_Y(geom) BETWEEN 0 AND 84
        ELSE false
    END AS valid FROM point_records
), edges AS (
    SELECT e.id::text AS id, e.from_node::text AS u, e.to_node::text AS v, e.geom, e.length_m,
           (u.id IS NOT NULL AND v.id IS NOT NULL AND u.id <> v.id) AS valid_references,
           CASE WHEN ST_SRID(e.geom) = 4326 AND u.valid AND v.valid
                THEN ST_Equals(ST_StartPoint(e.geom), u.geom)
                     AND ST_Equals(ST_EndPoint(e.geom), v.geom)
                ELSE false
           END AS aligned,
           CASE WHEN ST_SRID(e.geom) = 4326 AND GeometryType(e.geom) = 'LINESTRING'
                     AND ST_NDims(e.geom) = 2 AND ST_NPoints(e.geom) >= 2
                THEN NOT EXISTS (
                    SELECT 1 FROM ST_DumpPoints(e.geom) AS p
                    WHERE NOT (ST_X(p.geom) BETWEEN -126 AND -120
                               AND ST_Y(p.geom) BETWEEN 0 AND 84)
                )
                ELSE false
           END AS valid_geometry
    FROM network_edge e
    LEFT JOIN points u ON u.kind = 'node' AND u.id = e.from_node::text
    LEFT JOIN points v ON v.kind = 'node' AND v.id = e.to_node::text
), checked_edges AS (
    SELECT e.*, (
        e.length_m IS NULL OR e.length_m <= 0 OR e.length_m >= 'Infinity'::double precision
        -- Compare using the loader's projection, to one millimeter.
        OR COALESCE(p.length_m <= 0 OR abs(e.length_m - p.length_m) > 0.001, false)
    ) AS invalid_length
    FROM edges e
    CROSS JOIN LATERAL (VALUES (
        CASE WHEN e.valid_geometry THEN ST_Length(ST_Transform(e.geom, 32610)) END
    )) AS p(length_m)
), neighbors AS (
    SELECT DISTINCT n.u, n.v FROM checked_edges e
    CROSS JOIN LATERAL (VALUES (e.u, e.v), (e.v, e.u)) AS n(u, v)
    WHERE e.valid_references AND e.valid_geometry AND e.aligned AND NOT e.invalid_length
), vertices AS (
    SELECT DISTINCT u AS id FROM neighbors
), reachable(id) AS (
    SELECT min(id) FROM vertices HAVING count(*) > 0
    UNION
    SELECT n.v FROM reachable r JOIN neighbors n ON n.u = r.id
), issues AS (
    SELECT kind AS record_type, id, 'invalid_point' AS issue FROM points
    WHERE valid IS NOT TRUE
    UNION ALL
    SELECT p.kind, p.id, 'not_on_network' FROM points p
    WHERE p.kind <> 'node' AND NOT EXISTS (SELECT 1 FROM vertices v WHERE v.id = p.node_id)
    UNION ALL
    SELECT p.kind, p.id, 'unverified_access_leg' FROM points p
    JOIN vertices v ON v.id = p.node_id
    JOIN points n ON n.kind = 'node' AND n.id = v.id
    WHERE p.kind <> 'node' AND CASE WHEN p.valid AND n.valid
        THEN NOT ST_Equals(p.geom, n.geom) ELSE false END
    UNION ALL
    SELECT 'edge', e.id, i.issue FROM checked_edges e
    CROSS JOIN LATERAL (VALUES
        ('invalid_reference', NOT e.valid_references),
        ('invalid_line', NOT e.valid_geometry),
        ('endpoint_mismatch', e.valid_references AND e.valid_geometry AND e.aligned IS NOT TRUE),
        ('invalid_length', e.invalid_length)
    ) AS i(issue, invalid) WHERE i.invalid
    UNION ALL
    SELECT 'network', '', 'no_usable_edges' WHERE NOT EXISTS (SELECT 1 FROM vertices)
    UNION ALL
    SELECT 'node', id, 'outside_first_component' FROM vertices
    WHERE id NOT IN (SELECT id FROM reachable)
)
SELECT record_type, id, issue FROM issues ORDER BY record_type, id, issue;
