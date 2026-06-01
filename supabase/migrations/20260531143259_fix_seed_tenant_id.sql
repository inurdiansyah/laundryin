-- Fix: pastikan seed layanan ada untuk tenant gevana, dan user punya akses
do $$
declare
    t_id uuid;
    u_id uuid;
begin
    -- Cari tenant
    select id into t_id from public.tenants where slug = 'gevana' limit 1;
    
    -- Cari user
    select id into u_id from auth.users where email = 'admin@gevana.com' limit 1;
    
    if t_id is not null and u_id is not null then
        -- Pastikan user ada di tenant_users (hindari duplicate)
        if not exists (select 1 from public.tenant_users where tenant_id = t_id and user_id = u_id) then
            insert into public.tenant_users (tenant_id, user_id, email, nama, role, aktif)
            values (t_id, u_id, 'admin@gevana.com', 'Admin Gevana', 'admin', true);
        end if;
        
        -- Hapus & re-seed layanan
        delete from public.layanan where tenant_id = t_id;
        
        insert into public.layanan (tenant_id, nama, satuan, harga, kategori, workflow) values
            (t_id, 'Cuci Kering Reguler',   'kg',    6000,  'Cuci',    ARRAY['diterima','proses_cuci','proses_kering','siap_diambil','selesai']),
            (t_id, 'Cuci Kering Express',   'kg',   10000,  'Cuci',    ARRAY['diterima','proses_cuci','proses_kering','siap_diambil','selesai']),
            (t_id, 'Cuci Basah',            'kg',    4000,  'Cuci',    ARRAY['diterima','proses_cuci','siap_diambil','selesai']),
            (t_id, 'Setrika Reguler',       'kg',    5000,  'Setrika', ARRAY['diterima','setrika','siap_diambil','selesai']),
            (t_id, 'Setrika Express',       'kg',    8000,  'Setrika', ARRAY['diterima','setrika','siap_diambil','selesai']),
            (t_id, 'Cuci + Setrika Reguler','kg',   10000,  'Cuci',    ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai']),
            (t_id, 'Cuci + Setrika Express','kg',   15000,  'Express', ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai']),
            (t_id, 'Bed Cover',             'piece', 15000,  'Lainnya', ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai']),
            (t_id, 'Selimut',               'piece', 20000,  'Lainnya', ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai']),
            (t_id, 'Seprei',                'set',   8000,   'Lainnya', ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai']),
            (t_id, 'Karpet Sedang',         'piece', 25000,  'Lainnya', ARRAY['diterima','proses_cuci','proses_kering','siap_diambil','selesai']),
            (t_id, 'Karpet Besar',          'piece', 40000,  'Lainnya', ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai']);
    end if;
end $$;
