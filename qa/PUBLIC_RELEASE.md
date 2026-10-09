# Public portfolio release review — 2026-10-09

## Verified in this review

- Existing 13 scoring/retrieval tests pass. Three API regression tests add origin/identity rejection, streamed-body byte limits and prevention of user-ID quota bypass: **16/16 pass**.
- TypeScript check and production build pass (rechecked after the API edits).
- Local development server responds; `/api/live` reports Brave unconfigured and scoring unavailable.
- README now provides an English overview, screenshots, reproducible commands and clear separation of fictional demo / public-source research. Chinese instructions remain available.
- Existing English screenshot inspected. Live initial page checked at 1440×1000 and 390×844; mobile scroll width equals viewport width. Live profile-link discovery checked against the local API. Evidence drawer, human review and JSON export browser checks use a synthetic API response, not proof of provider retrieval. Earlier demo screenshots retain their original dates.

## Privacy review scope

Current repository file list, local matching source and two existing commit records were checked. No real API key or employer research file was found in the checked project source. Fictional demo/test fixtures are intentional. This is a focused release check, not a guarantee that every possible sensitive value is detectable. Existing commits contain the author's GitHub-associated email; publication exposes commit metadata as well as files.

## Remaining product work

- Successful live-provider end-to-end acceptance with configured credentials remains outstanding. Current environment has no Brave key; it cannot prove Brave live results.
- Broader Live browser acceptance with real-provider results remains outstanding.
- User testing, scoring calibration and measured business impact have not been completed.
- An unrestricted hosted Live service needs durable rate limits, access control and spending limits. Repository publication does not deploy such a service.

## Changes

Bound request bytes during stream consumption rather than after loading an entire body. Do not derive rate-limit identity from a caller-provided authenticated-user header. Preserve the existing reviewed scoring and demo behavior.
