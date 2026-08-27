# Verified rules

Files in this directory override generated import data. Every regulatory correction must cite a current official government source. Commercial catalog data is not sufficient for `OFFICIALLY_VERIFIED` status.

- `manual-overrides.json`: canonical names, safe local assets, award-specific corrections, device overrides.
- `service-precedence.json`: ordered service tables verified against the cited official publication.
- `device-definitions.json`: device semantics and approved local assets.

Never edit `military/military-data.js` directly; rebuild it from normalized and verified data.
