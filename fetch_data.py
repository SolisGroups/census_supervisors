"""
fetch_data.py — Superviseurs de terrain · 4eme RGPH/RGAE Cameroun
Récupère toutes les soumissions + le schéma du formulaire KoboToolbox
et les sauvegarde dans data/submissions.json et data/schema.json.
Exécuté par GitHub Actions — aucun problème CORS.
"""

import os, json, sys
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    print("❌ Module 'requests' manquant. Lancez : pip install requests")
    sys.exit(1)

TOKEN    = os.environ.get("KOBO_TOKEN", "d7a3665f98d0d72d41f4def5c149da9eb5bf4564")
FORM_UID = os.environ.get("FORM_UID",   "aGFaz86f9uVHSr4LX37haY")
BASE_URL = "https://kf.kobotoolbox.org/api/v2"
HEADERS  = {"Authorization": f"Token {TOKEN}"}
DATA_DIR = "data"

os.makedirs(DATA_DIR, exist_ok=True)

def fetch_json(url, label=""):
    print(f"  → {label or url}")
    r = requests.get(url, headers=HEADERS, timeout=60)
    r.raise_for_status()
    return r.json()

print("📋 Récupération du schéma…")
schema = fetch_json(f"{BASE_URL}/assets/{FORM_UID}/?format=json", "schéma formulaire")
with open(os.path.join(DATA_DIR, "schema.json"), "w", encoding="utf-8") as f:
    json.dump(schema, f, ensure_ascii=False, indent=2)
print(f"   ✅ Schéma sauvegardé")

print("📊 Récupération des soumissions…")
all_results = []
url = f"{BASE_URL}/assets/{FORM_UID}/data/?format=json&limit=5000"
page = 1
while url:
    data = fetch_json(url, f"page {page} ({len(all_results)} enregistrements)")
    all_results.extend(data.get("results", []))
    url = data.get("next")
    page += 1

print(f"   ✅ {len(all_results)} soumissions récupérées.")

now_iso = datetime.now(timezone.utc).isoformat()
output  = {"fetched_at": now_iso, "count": len(all_results),
           "form_uid": FORM_UID, "results": all_results}

subs_path = os.path.join(DATA_DIR, "submissions.json")
with open(subs_path, "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

print(f"   ✅ {os.path.getsize(subs_path)//1024} Ko → {subs_path}")
print(f"\n🎉 Synchronisation terminée à {now_iso}")
