-- Seed layanan (services) untuk demo tenant Gevana Laundry
-- Tenant ID: 00000000-0000-0000-0000-000000000001

-- Cari tenant_id dari user yang sudah terdaftar
do $$
declare
    t_id uuid;
begin
    select id into t_id from public.tenants where slug = 'gevana' limit 1;
    if t_id is not null then
        -- Hapus layanan existing untuk seed ulang (optional, aman untuk first time)
        delete from public.layanan where tenant_id = t_id;

        insert into public.layanan (tenant_id, nama, satuan, harga, kategori) values
            (t_id, 'Cuci Kering Reguler',   'kg', 6000,  'Cuci'),
            (t_id, 'Cuci Kering Express',   'kg', 10000, 'Cuci'),
            (t_id, 'Cuci Basah',            'kg', 4000,  'Cuci'),
            (t_id, 'Setrika Reguler',       'kg', 5000,  'Setrika'),
            (t_id, 'Setrika Express',       'kg', 8000,  'Setrika'),
            (t_id, 'Cuci + Setrika Reguler','kg', 10000, 'Cuci'),
            (t_id, 'Cuci + Setrika Express','kg', 15000, 'Express'),
            (t_id, 'Bed Cover',             'piece', 15000, 'Lainnya'),
            (t_id, 'Selimut',               'piece', 20000, 'Lainnya'),
            (t_id, 'Seprei',                'set', 8000,   'Lainnya'),
            (t_id, 'Karpet Sedang',         'piece', 25000, 'Lainnya'),
            (t_id, 'Karpet Besar',          'piece', 40000, 'Lainnya');
    end if;
end $$;
