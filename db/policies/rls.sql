-- Row-level security. The API connects as role `app` and sets app.user_id per transaction.
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app_user_role() RETURNS app_role LANGUAGE sql STABLE AS
$$ SELECT role FROM app_user WHERE id = app_user_id() $$;

-- A user sees a lot if they manage everything, it is assigned to them, it belongs to their
-- organiser scope, or its village falls inside a region they supervise.
CREATE OR REPLACE FUNCTION can_see_lot(l production_lot) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT app_user_role() IN ('PRODUCTION_MANAGER', 'ADMIN', 'VIEWER')
      OR l.field_assistant_id = app_user_id()
      OR EXISTS (SELECT 1 FROM user_scope s WHERE s.user_id = app_user_id() AND s.scope_type = 'LOT' AND s.scope_id = l.lot_id)
      OR EXISTS (SELECT 1 FROM user_scope s JOIN organiser o ON o.code = s.scope_id
                 WHERE s.user_id = app_user_id() AND s.scope_type = 'ORGANISER' AND o.id = l.organiser_id)
      OR EXISTS (
        SELECT 1 FROM farmer fr
        JOIN village v ON v.id = fr.village_id
        JOIN taluk t ON t.id = v.taluk_id
        JOIN district d ON d.id = t.district_id
        JOIN user_scope s ON s.user_id = app_user_id()
        WHERE fr.id = l.farmer_id AND (
          (s.scope_type = 'VILLAGE' AND s.scope_id = v.id::text) OR
          (s.scope_type = 'TALUK' AND s.scope_id = t.id::text) OR
          (s.scope_type = 'DISTRICT' AND s.scope_id = d.id::text) OR
          (s.scope_type = 'STATE' AND s.scope_id = d.state_code)))
$$;

ALTER TABLE production_lot ENABLE ROW LEVEL SECURITY;
CREATE POLICY lot_read ON production_lot FOR SELECT USING (can_see_lot(production_lot));
CREATE POLICY lot_write ON production_lot FOR ALL
  USING (app_user_role() IN ('PRODUCTION_MANAGER', 'ADMIN') OR field_assistant_id = app_user_id())
  WITH CHECK (app_user_role() IN ('PRODUCTION_MANAGER', 'ADMIN') OR field_assistant_id = app_user_id());

ALTER TABLE stage_record ENABLE ROW LEVEL SECURITY;
CREATE POLICY record_read ON stage_record FOR SELECT
  USING (EXISTS (SELECT 1 FROM production_lot l WHERE l.id = stage_record.lot_id AND can_see_lot(l)));
-- Records are append-only: inserts by the capturing user, review updates by supervisors and up.
CREATE POLICY record_insert ON stage_record FOR INSERT WITH CHECK (captured_by = app_user_id());
CREATE POLICY record_review ON stage_record FOR UPDATE
  USING (app_user_role() IN ('SUPERVISOR', 'PRODUCTION_MANAGER', 'ADMIN'));

-- Personal data: farmer mobile numbers only for roles that need them.
ALTER TABLE farmer ENABLE ROW LEVEL SECURITY;
CREATE POLICY farmer_read ON farmer FOR SELECT USING (
  app_user_role() IN ('PRODUCTION_MANAGER', 'ADMIN', 'SUPERVISOR')
  OR EXISTS (SELECT 1 FROM production_lot l WHERE l.farmer_id = farmer.id AND can_see_lot(l)));
