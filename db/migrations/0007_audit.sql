-- 0007: audit log, filled by triggers on every create/update/delete
CREATE TABLE audit_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name text NOT NULL,
  row_id     text NOT NULL,
  action     text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old        jsonb,
  new        jsonb,
  actor_id   uuid,
  device_id  text,
  at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_row_idx ON audit_log(table_name, row_id);

-- The API sets app.user_id / app.device_id per transaction (SET LOCAL).
CREATE OR REPLACE FUNCTION audit_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit_log(table_name, row_id, action, old, new, actor_id, device_id)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)::text,
    TG_OP,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
    NULLIF(current_setting('app.user_id', true), '')::uuid,
    NULLIF(current_setting('app.device_id', true), '')
  );
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organiser', 'farmer', 'farm', 'hybrid', 'production_lot', 'stage_record', 'stage_definition', 'app_user'] LOOP
    EXECUTE format('CREATE TRIGGER %I_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_trigger()', t, t);
  END LOOP;
END $$;
