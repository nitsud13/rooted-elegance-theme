#!/usr/bin/env python3
"""
Process USDA Plant Hardiness Zone CSV data to generate
COMPLETE 3-digit ZIP prefix to zone mapping for zone-selector.js.
Fills gaps by interpolating from nearby prefixes.
"""

import csv
from collections import Counter
import os

def parse_zone(zone_str):
    """Extract zone string."""
    return zone_str.strip().lower()

def get_zone_number(zone_str):
    """Extract just the number and letter for comparison."""
    zone = zone_str.strip().lower()
    num = ""
    letter = ""
    for c in zone:
        if c.isdigit():
            num += c
        elif c in 'ab':
            letter = c
            break
    return (int(num) if num else 7, letter or 'a')

def zone_to_float(zone_str):
    """Convert zone to float for interpolation (e.g., 7a=7.0, 7b=7.5)."""
    num, letter = get_zone_number(zone_str)
    return num + (0.5 if letter == 'b' else 0.0)

def float_to_zone(value):
    """Convert float back to zone string."""
    num = int(value)
    is_b = (value - num) >= 0.25
    return f"{num}{'b' if is_b else 'a'}"

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

                prefix = zipcode[:3]

                if prefix not in prefix_zones:
                    prefix_zones[prefix] = []
                prefix_zones[prefix].append(zone)

    # Find dominant zone for each prefix
    prefix_to_zone = {}
    for prefix, zones in prefix_zones.items():
        zone_counts = Counter(zones)
        dominant_zone = zone_counts.most_common(1)[0][0]
        prefix_to_zone[prefix] = dominant_zone

    # Fill in missing prefixes by interpolating from nearby known prefixes
    all_prefixes = [str(i).zfill(3) for i in range(1000)]

    for prefix in all_prefixes:
        if prefix in prefix_to_zone:
            continue

        # Find nearest known prefixes
        prefix_num = int(prefix)
        lower = None
        upper = None

        # Search backward
        for i in range(prefix_num - 1, -1, -1):
            p = str(i).zfill(3)
            if p in prefix_to_zone:
                lower = (i, prefix_to_zone[p])
                break

        # Search forward
        for i in range(prefix_num + 1, 1000):
            p = str(i).zfill(3)
            if p in prefix_to_zone:
                upper = (i, prefix_to_zone[p])
                break

        # Interpolate or use nearest
        if lower and upper:
            # Weighted average based on distance
            total_dist = upper[0] - lower[0]
            lower_dist = prefix_num - lower[0]

            lower_val = zone_to_float(lower[1])
            upper_val = zone_to_float(upper[1])

            # Linear interpolation
            interp_val = lower_val + (upper_val - lower_val) * (lower_dist / total_dist)
            prefix_to_zone[prefix] = float_to_zone(interp_val)
        elif lower:
            prefix_to_zone[prefix] = lower[1]
        elif upper:
            prefix_to_zone[prefix] = upper[1]
        else:
            # Default to zone 7a (moderate)
            prefix_to_zone[prefix] = '7a'

    # Sort by prefix
    sorted_prefixes = sorted(prefix_to_zone.keys())

    # Generate JavaScript object
    print("  // Generated from USDA Plant Hardiness Zone data (2023)")
    print("  // Source: Oregon State University PRISM Group")
    print("  // https://prism.oregonstate.edu/phzm/")
    print(f"  // Complete coverage: all {len(sorted_prefixes)} prefixes (000-999)")
    print("")
    print("  zipToZone: {")

    for i, prefix in enumerate(sorted_prefixes):
        zone = prefix_to_zone[prefix]
        comma = "," if i < len(sorted_prefixes) - 1 else ""
        print(f"    '{prefix}': '{zone}'{comma}")

    print("  },")

if __name__ == "__main__":
    main()
