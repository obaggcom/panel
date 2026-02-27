# Time Display Convention

This project stores timestamps in UTC and exposes display-ready fields for UI rendering.

## Storage Rule

- Persist timestamps as UTC SQL datetime (`YYYY-MM-DD HH:mm:ss`) or ISO UTC.
- Do not store local-time text in database columns.

## API Rule

- Raw time fields remain available (for sorting/comparison/backward compatibility), e.g. `created_at`.
- UI-facing APIs should additionally return display fields with `_display` suffix.
- Default display timezone is `Asia/Shanghai`.

## Naming Rule

- `*_display`: datetime with minute precision (`YYYY-MM-DD HH:mm`)
- `*_display_sec`: datetime with second precision (`YYYY-MM-DD HH:mm:ss`) if needed
- `*_date_display`: date only (`YYYY-MM-DD`)
- `*_time_display`: time only (`HH:mm`)
- `*_weekday_display`: localized weekday label (e.g. `周一`)

Examples:

- `created_at` + `created_at_display`
- `last_access` + `last_access_display`
- `mtime` + `mtime_display`

## Frontend Rule

- Prefer backend-provided `*_display` fields.
- Do not format raw UTC strings with ad-hoc `replace('T')`, `slice`, or browser locale APIs in feature code.
- Keep fallback to raw field only for backward compatibility during migration.

## Utility Rule

- Use `src/utils/time.js` as the single backend formatter/parsing entry.
