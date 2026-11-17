import json
import csv

def main():
    with open('raw_outputs/kuku_promos_full_dataset.json', 'r', encoding='utf-8') as f:
        json_data = json.load(f)

    with open('raw_outputs/kuku_promos_full_dataset.csv', 'r', encoding='utf-8') as f:
        csv_rows = list(csv.DictReader(f))

    print(f"=== RECONCILIATION AUDIT ===")
    print(f"JSON Record Count: {len(json_data)}")
    print(f"CSV Record Count:  {len(csv_rows)}")

    json_ids = [p['promo_id'] for p in json_data]
    csv_ids = [r['Promo Identifier'] for r in csv_rows]

    assert json_ids == csv_ids, "Promo IDs mismatch between JSON and CSV!"
    print("✓ Exact 1:1 ID match between JSON and CSV exports.")

    json_multi = [p for p in json_data if len(p.get('segments', [])) > 1]
    csv_multi = [r for r in csv_rows if int(r.get('Segment Count', 1)) > 1]
    print(f"JSON Multi-segment count: {len(json_multi)}")
    print(f"CSV Multi-segment count:  {len(csv_multi)}")
    assert len(json_multi) == len(csv_multi), "Multi-segment counts mismatch!"

    print("\nMulti-Segment Candidates in Final Export:")
    for m in json_multi:
        print(f"  - {m['promo_id']} (Ep {m['primary_episode_number']}): {len(m['segments'])} segments, duration={m['total_duration_seconds']}s, status={m['validation_status']}")
        for s in m['segments']:
            print(f"      Seg {s['segment_order']}: Ep {s['episode']} [{s['start_timestamp']} - {s['end_timestamp']}] ({s['duration_seconds']}s)")

    # Score stats
    scores = [p['overall_score'] for p in json_data]
    avg_score = sum(scores) / len(scores) if scores else 0.0
    print(f"\nAverage Score across export: {avg_score:.2f}")

    # Provider / model stats from reasons or logs
    print(f"\nStatus breakdown in export:")
    status_counts = {}
    for p in json_data:
        st = p['validation_status']
        status_counts[st] = status_counts.get(st, 0) + 1
    print(json.dumps(status_counts, indent=2))

if __name__ == '__main__':
    main()
