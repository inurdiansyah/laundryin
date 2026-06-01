#!/usr/bin/env python3
"""Seed full realistic data for LaundryIn — 1 month run."""
import json, requests, sys
from pathlib import Path
from datetime import datetime, timedelta
import random

random.seed(42)

TOKEN = Path("/Users/inurdiansyah/.supabase/access-token").read_text().strip()
PRJ = "wjjrcdhyrrburjlstttf"
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

def sql(q):
    r = requests.post(f"https://api.supabase.com/v1/projects/{PRJ}/database/query", headers=H, json={"query": q})
    r.raise_for_status()
    return r.json()

def q1(q):
    rows = sql(q)
    return rows[0] if rows else None

print("=== SEED FULL DATA ===")

# Get tenants
tenants = sql("select id, slug, nama from tenants")
print(f"Tenants: {[(t['slug'], t['id'][:8]) for t in tenants]}")

t_id = tenants[0]['id']
print(f"Using tenant: {tenants[0]['slug']} ({t_id[:8]})")
