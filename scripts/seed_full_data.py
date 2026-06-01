#!/usr/bin/env python3
"""Seed data lengkap — laundry sudah berjalan 1 bulan penuh"""
import requests, json, sys, random
from pathlib import Path
from datetime import datetime, timedelta

TOKEN = Path("/Users/inurdiansyah/.supabase/access-token").read_text().strip()
PRJ = "wjjrcdhyrrburjlstttf"
API = f"https://api.supabase.com/v1/projects/{PRJ}/database"
HD = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

def sql(q):
    r = requests.post(f"{API}/query", headers=HD, json={"query": q})
    if r.status_code not in (200,201):
        print(f"SQL ERROR [{r.status_code}]: {r.text[:200]}")
        return r
    return r

# =====================================================
# STEP 1: Ambil tenant_id yang ada
# =====================================================
r = sql("select id, slug, nama from tenants order by created_at")
tenants = r.json()
print(f"\nTenants found: {len(tenants)}")
for t in tenants:
    print(f"  {t['slug']} — {t['id']}")

TID = tenants[0]['id']  # Gunakan tenant pertama (gevana)

# =====================================================
# STEP 2: Update tenant — toko sudah matured
# =====================================================
sql(f"""
update tenants set
  nama = 'Gevana Laundry',
  alamat = 'Jl. Melati No. 42, Kelurahan Cempaka Putih, Jakarta Pusat',
  nomor_hp = '0812-3456-7890',
  email = 'gevana@laundry.id',
  paket = 'pro',
  jam_operasional = '{{"senin": "07:00-21:00", "selasa": "07:00-21:00", "rabu": "07:00-21:00", "kamis": "07:00-21:00", "jumat": "07:00-21:00", "sabtu": "08:00-20:00", "minggu": "08:00-18:00"}}'::jsonb,
  updated_at = now()
where id = '{TID}'
""")

# =====================================================
# STEP 3: Layanan — 14 variasi (real laundry)
# =====================================================
sql(f"delete from order_items where order_id in (select id from orders where tenant_id = '{TID}')")
sql(f"delete from order_status_log where order_id in (select id from orders where tenant_id = '{TID}')")
sql(f"delete from payments where tenant_id = '{TID}'")
sql(f"delete from delivery_schedules where tenant_id = '{TID}'")
sql(f"delete from orders where tenant_id = '{TID}'")
sql(f"delete from points_log where member_id in (select id from members where tenant_id = '{TID}')")
sql(f"delete from members where tenant_id = '{TID}'")
sql(f"delete from customers where tenant_id = '{TID}'")
sql(f"delete from inventory_movements where item_id in (select id from inventory_items where tenant_id = '{TID}')")
sql(f"delete from inventory_items where tenant_id = '{TID}'")
sql(f"delete from delivery_schedules where tenant_id = '{TID}'")
sql(f"delete from drivers where tenant_id = '{TID}'")
sql(f"delete from expenses where tenant_id = '{TID}'")
sql(f"delete from layanan where tenant_id = '{TID}'")
sql(f"delete from promos where tenant_id = '{TID}'")

# Seed layanan — 14 jenis
layanan = [
    ("Cuci Basah", "kg", 4000, "Cuci"),
    ("Cuci Kering Reguler", "kg", 6000, "Cuci"),
    ("Cuci Kering Express", "kg", 10000, "Cuci"),
    ("Cuci + Setrika Reguler", "kg", 10000, "Cuci"),
    ("Cuci + Setrika Express", "kg", 15000, "Express"),
    ("Setrika Reguler", "kg", 5000, "Setrika"),
    ("Setrika Express", "kg", 8000, "Setrika"),
    ("Laundry Sepatu", "piece", 25000, "Lainnya"),
    ("Laundry Tas", "piece", 20000, "Lainnya"),
    ("Laundry Helm", "piece", 15000, "Lainnya"),
    ("Bed Cover (Kecil)", "set", 15000, "Lainnya"),
    ("Bed Cover (Besar)", "set", 25000, "Lainnya"),
    ("Karpet (per m²)", "piece", 20000, "Lainnya"),
    ("Dry Cleaning", "piece", 35000, "Lainnya"),
]
vals = ", ".join([
    f"('{TID}', '{n}', '{s}', {h}, '{k}')" for n, s, h, k in layanan
])
r = sql(f"insert into layanan(tenant_id, nama, satuan, harga, kategori) values {vals} returning id, nama, harga")
lids = {row['nama']: row['id'] for row in r.json()}
print(f"\nLayanan: {len(lids)} items")

# =====================================================
# STEP 4: Pelanggan — 25 orang (mix profile)
# =====================================================
pelanggan_data = [
    ("Budi Santoso", "0812-1111-0001", "Jl. Anggrek No. 10", 0),
    ("Siti Nurhaliza", "0812-1111-0002", "Jl. Melati No. 5", 0),
    ("Ahmad Fauzi", "0812-1111-0003", "Jl. Mawar No. 22", 0),
    ("Rina Amelia", "0812-1111-0004", "Perum Graha Asri Blok C/3", 0),
    ("Doni Prasetyo", "0812-1111-0005", "Jl. Cempaka No. 8", 0),
    ("Fitriani Lubis", "0812-1111-0006", "Jl. Dahlia No. 15", 0),
    ("Hendra Gunawan", "0812-1111-0007", "Komp. Villa Indah A/7", 0),
    ("Mega Putri", "0812-1111-0008", "Jl. Kenanga No. 30", 0),
    ("Rizky Ramadhan", "0812-1111-0009", "Jl. Flamboyan No. 12", 0),
    ("Dewi Lestari", "0812-1111-0010", "Apartemen City Park Tower A/1805", 0),
    ("Agus Wijaya", "0812-1111-0011", "Jl. Pahlawan No. 45", 0),
    ("Linda Kurnia", "0812-1111-0012", "Jl. Sudirman No. 100", 0),
    ("Bayu Saputra", "0812-1111-0013", "Perum Bumi Asri Blok D/2", 0),
    ("Nina Rosita", "0812-1111-0014", "Jl. Ahmad Yani No. 55", 0),
    ("Toni Hartono", "0812-1111-0015", "Jl. Diponegoro No. 77", 0),
    ("Yuni Rahayu", "0812-1111-0016", "Jl. Gatot Subroto No. 88", 0),
    ("Dimas Ardian", "0812-1111-0017", "Kost Putra Melati No. 3", 0),
    ("Rani Safitri", "0812-1111-0018", "Kost Putri Anggrek No. 7", 0),
    ("Indra Kusuma", "0812-1111-0019", "Jl. Veteran No. 33", 0),
    ("Putri Wulandari", "0812-1111-0020", "Cluster Permata Hijau No. 12", 0),
    ("Eko Prabowo", "0812-1111-0021", "Jl. Kartini No. 18", 0),
    ("Maya Sari", "0812-1111-0022", "Jl. Hasanudin No. 44", 0),
    ("Ferry Irawan", "0812-1111-0023", "Jl. Imam Bonjol No. 20", 0),
    ("Anita Dewi", "0812-1111-0024", "Jl. Thamrin No. 66", 0),
    ("Slamet Riyadi", "0812-1111-0025", "Jl. Merdeka No. 99", 0),
]
cvals = ", ".join([f"('{TID}', '{n}', '{hp}', '{al}', 0)" for n, hp, al, _ in pelanggan_data])
r = sql(f"insert into customers(tenant_id, nama, nomor_hp, alamat, total_belanja) values {cvals} returning id, nama")
cids = {row['nama']: row['id'] for row in r.json()}
print(f"Customers: {len(cids)} orang")

