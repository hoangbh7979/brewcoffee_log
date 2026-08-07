-- Kept nullable so existing shots and firmware remain compatible during rollout.
ALTER TABLE shots
ADD COLUMN boiler_temp REAL
CHECK (boiler_temp IS NULL OR (boiler_temp >= 0 AND boiler_temp <= 150));
