INSERT INTO season (code, name, start_month, end_month) VALUES
  ('01', 'Kharif', 6, 10),
  ('02', 'Rabi', 10, 3),
  ('03', 'Summer', 2, 6)   -- reserved, SPECS §9 Q2
ON CONFLICT (code) DO NOTHING;
