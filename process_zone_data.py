#!/usr/bin/env python3
"""
Process USDA Plant Hardiness Zone CSV data to generate
3-digit ZIP prefix to zone mapping for zone-selector.js
"""

import csv
from collections import Counter
import os

def parse_zone(zone_str):
    """Extract numeric zone (ignoring a/b suffix) for simpler lookup."""
    # Zone format: "7b", "6a", "10b", etc.
    # We'll keep the full zone string for accuracy
    return zone_str.strip().lower()

def get_zone_number(zone_str):
    """Extract just the number for sorting/comparison."""
    zone = zone_str.strip().lower()
    # Extract number (handles "7b", "10a", etc.)
    num = ""
    for c in zone:
        if c.isdigit():
            num += c
        else:
            break
    return int(num) if num else 0

def main():
    csv_files = [
        "phzm_us_zipcode_2023.csv",
        "phzm_ak_zipcode_2023.csv",
        "phzm_hi_zipcode_2023.csv"
    ]

    # Dictionary: prefix -> list of zones
    prefix_zones = {}

    for csv_file in csv_files:
        if not os.path.exists(csv_file):
            print(f"Warning: {csv_file} not found, skipping")
            continue

        with open(csv_file, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                zipcode = row['zipcode'].strip().zfill(5)
                zone = parse_zone(row['zone'])

                # Extract 3-digit prefix
                prefix = zipcode[:3]

                if prefix not in prefix_zones:
                    prefix_zones[prefix] = []
                prefix_zones[prefix].append(zone)

    # Find dominant zone for each prefix
    prefix_to_zone = {}
    for prefix, zones in prefix_zones.items():
        # Count occurrences of each zone
        zone_counts = Counter(zones)
        # Get most common zone
        dominant_zone = zone_counts.most_common(1)[0][0]
        prefix_to_zone[prefix] = dominant_zone

    # Sort by prefix
    sorted_prefixes = sorted(prefix_to_zone.keys())

    # Generate JavaScript object
    print("// Generated from USDA Plant Hardiness Zone data (2023)")
    print("// Source: Oregon State University PRISM Group")
    print("// https://prism.oregonstate.edu/phzm/")
    print(f"// Total prefixes: {len(sorted_prefixes)}")
    print("")
    print("const zipToZone = {")

    for i, prefix in enumerate(sorted_prefixes):
        zone = prefix_to_zone[prefix]
        comma = "," if i < len(sorted_prefixes) - 1 else ""
        print(f"  '{prefix}': '{zone}'{comma}")

    print("};")

    # Print stats
    print(f"\n// Stats:", file=__import__('sys').stderr)
    print(f"// - Total prefixes covered: {len(sorted_prefixes)}", file=__import__('sys').stderr)
    print(f"// - Range: {min(sorted_prefixes)} to {max(sorted_prefixes)}", file=__import__('sys').stderr)

    # Check for gaps
    all_prefixes = set(str(i).zfill(3) for i in range(1000))
    covered = set(sorted_prefixes)
    gaps = all_prefixes - covered
    if gaps:
        print(f"// - Missing prefixes: {len(gaps)}", file=__import__('sys').stderr)
        # Show some examples of gaps
        gap_list = sorted(list(gaps))[:20]
        print(f"// - Sample gaps: {', '.join(gap_list)}", file=__import__('sys').stderr)

if __name__ == "__main__":
    main()
