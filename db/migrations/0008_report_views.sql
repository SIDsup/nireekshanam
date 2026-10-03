-- 0008: report views used by the dashboard

-- Overdue inspections (W-03): mandatory stages past their due date with no record.
CREATE VIEW v_overdue_stage AS
SELECT l.lot_id, l.id AS lot_uuid, sd.stage_code, sd.name AS stage_name,
       l.female_sowing_date + sd.expected_day_offset AS due_on,
       (current_date - (l.female_sowing_date + sd.expected_day_offset)) AS days_late,
       l.field_assistant_id, l.organiser_id
FROM production_lot l
JOIN hybrid h ON h.id = l.hybrid_id
JOIN stage_definition sd ON sd.crop_code = h.crop_code AND sd.mandatory
WHERE l.status IN ('ACTIVE', 'HARVESTED')
  AND l.female_sowing_date IS NOT NULL
  AND l.female_sowing_date + sd.expected_day_offset < current_date
  AND NOT EXISTS (SELECT 1 FROM stage_record r WHERE r.lot_id = l.id AND r.stage_code = sd.stage_code AND r.supersedes IS NULL);

-- Compliance (W-06) per lot.
CREATE VIEW v_lot_compliance AS
SELECT l.lot_id, l.organiser_id, l.field_assistant_id,
       count(r.*) AS records,
       count(r.*) FILTER (WHERE r.inside_geofence) AS inside,
       count(r.*) FILTER (WHERE r.mock_location) AS mock_flags,
       count(r.*) FILTER (WHERE r.review_status = 'PENDING') AS pending_review
FROM production_lot l
LEFT JOIN stage_record r ON r.lot_id = l.id
GROUP BY l.id;

-- Estimated vs final yield (W-04) per lot, latest values.
CREATE VIEW v_lot_yield AS
SELECT l.lot_id, l.hybrid_id, l.organiser_id, l.farmer_id, l.target_yield_kg,
       (SELECT (r.data->>'estimated_seed_kg')::numeric FROM stage_record r
         WHERE r.lot_id = l.id AND r.stage_code = 'YIELD_EST' ORDER BY r.captured_at DESC LIMIT 1) AS estimated_kg,
       (SELECT (r.data->>'final_seed_kg')::numeric FROM stage_record r
         WHERE r.lot_id = l.id AND r.stage_code = 'FINAL_YIELD' ORDER BY r.captured_at DESC LIMIT 1) AS final_kg
FROM production_lot l;

-- Area variance (W-09).
CREATE VIEW v_farm_area_variance AS
SELECT f.id AS farm_id, f.declared_area_sqm, f.computed_area_sqm,
       (f.computed_area_sqm - f.declared_area_sqm) / f.declared_area_sqm AS variance
FROM farm f
WHERE abs(f.computed_area_sqm - f.declared_area_sqm) / f.declared_area_sqm > 0.10;
