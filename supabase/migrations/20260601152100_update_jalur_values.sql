-- Update existing orders to new jalur values
UPDATE orders SET jalur = 'drop_ambil' WHERE jalur = 'antar_sendiri';
UPDATE orders SET jalur = 'jemput_ambil' WHERE jalur = 'jemput';
