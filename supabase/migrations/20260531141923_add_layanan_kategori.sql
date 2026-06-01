-- Tambah kolom kategori ke layanan untuk grouping POS
alter table public.layanan
add column if not exists kategori text not null default 'Lainnya';

-- Update layanan existing dengan kategori default berdasarkan nama
update public.layanan set kategori = 'Cuci' where nama ilike '%cuci%' and kategori = 'Lainnya';
update public.layanan set kategori = 'Setrika' where nama ilike '%setrika%' and kategori = 'Lainnya';
update public.layanan set kategori = 'Express' where nama ilike '%express%' and kategori = 'Lainnya';
