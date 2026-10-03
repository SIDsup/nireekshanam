INSERT INTO crop (code, name, is_transplanted, pollination_method) VALUES
  ('HP', 'Hot Pepper', true, 'HAND_EMASCULATION'),
  ('OK', 'Okra', false, 'HAND_EMASCULATION'),
  ('TO', 'Tomato', true, 'HAND_EMASCULATION'),
  ('WM', 'Water Melon', false, 'HAND_POLLINATION_ONLY'),
  ('CU', 'Cucumber', false, 'HAND_POLLINATION_ONLY'),
  ('BG', 'Bitter Gourd', false, 'HAND_POLLINATION_ONLY'),
  ('RG', 'Ridge Gourd', false, 'HAND_POLLINATION_ONLY'),
  ('SG', 'Snake Gourd', false, 'HAND_POLLINATION_ONLY'),
  ('ON', 'Onion', false, 'BULB_CROSSING'),     -- flow pending, SPECS §9 Q6
  ('CA', 'Capsicum', true, 'HAND_EMASCULATION'),
  ('SC', 'Sweet Corn', false, 'DETASSELING')
ON CONFLICT (code) DO NOTHING;

INSERT INTO state (code, name, area_display_unit) VALUES
  ('TS', 'Telangana', 'GUNTA'), ('AP', 'Andhra Pradesh', 'CENT'), ('KA', 'Karnataka', 'GUNTA'), ('KL', 'Kerala', 'CENT')
ON CONFLICT (code) DO NOTHING;
