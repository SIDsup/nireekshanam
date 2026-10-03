-- 0006: users and data scope
CREATE TYPE app_role AS ENUM ('FIELD_ASSISTANT', 'ORGANISER', 'SUPERVISOR', 'PRODUCTION_MANAGER', 'ADMIN', 'VIEWER');

CREATE TABLE app_user (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  mobile     char(10) NOT NULL UNIQUE CHECK (mobile ~ '^[6-9]\d{9}$'),
  email      text,
  role       app_role NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_scope (
  user_id    uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('STATE', 'DISTRICT', 'TALUK', 'VILLAGE', 'ORGANISER', 'LOT')),
  scope_id   text NOT NULL,
  PRIMARY KEY (user_id, scope_type, scope_id)
);

ALTER TABLE production_lot ADD CONSTRAINT lot_fa_fk FOREIGN KEY (field_assistant_id) REFERENCES app_user(id);
ALTER TABLE stage_record ADD CONSTRAINT record_user_fk FOREIGN KEY (captured_by) REFERENCES app_user(id);

CREATE TABLE device (
  id           text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES app_user(id),
  last_sync_at timestamptz,
  app_version  text
);
