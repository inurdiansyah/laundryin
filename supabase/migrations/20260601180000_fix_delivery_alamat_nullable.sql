-- Make alamat nullable so delivery can be created without address initially
-- Address will be filled in later from the delivery UI or customer profile
ALTER TABLE public.delivery_schedules ALTER COLUMN alamat DROP NOT NULL;
