# RoyaltySplit

**Revenue split by consensus-scored contribution, on GenLayer.**

[![GenLayer](https://img.shields.io/badge/GenLayer-Bradbury-ff4d6d)](https://genlayer.com) [![chainId](https://img.shields.io/badge/chainId-4221-4dd0e1)](https://docs.genlayer.com) [![contract](https://img.shields.io/badge/contract-Python%20GenVM-8a63d2)](https://docs.genlayer.com) [![tests](https://img.shields.io/badge/tests-5%2F5%20passing-3fb950)](tests) [![frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite%20%2B%20genlayer--js-22a6f2)](app) [![live](https://img.shields.io/badge/live-royaltysplit.pages.dev-f59e0b)](https://royaltysplit.pages.dev) [![License](https://img.shields.io/badge/license-MIT-2dd4bf)](LICENSE)

Co-creators register a work and log their contributions (each with evidence). `settle` is payable:
every validator independently scores each contribution's weight from its evidence, accepted only when
they agree on the relative weighting (comparative equivalence — the top contributor + scores within a
margin). The incoming revenue is split proportionally to the agreed scores and paid out via
`emit_transfer` — no pre-agreed percentages, no manual haggling.

The verb is **"score contributions → proportional payout"** — a fair split decided by consensus over
evidence, distinct from a fixed escrow or a single winner.

- **Live demo:** https://royaltysplit.pages.dev
- **Contract (Bradbury, chain 4221):** `0xf29E70fA0C70B4f9634398F6AC9B718c2C40E474`
- **Deployed from:** `rivale` (`0xc388…51A44`)
- **Explorer:** https://explorer-bradbury.genlayer.com/contract/0xf29E70fA0C70B4f9634398F6AC9B718c2C40E474

---

## Why GenLayer is essential

Splitting revenue fairly across collaborators means weighing qualitative contributions — a judgment a
deterministic EVM can't make. GenLayer has validators score the same contributions and agree before the
money moves, turning a contentious negotiation into an evidence-based, automatic payout.

## Workflow

| Step | Method | What happens |
| --- | --- | --- |
| Create | `create_work(title)` | Opens a work. |
| Contribute | `add_contribution(work_id, contributor, evidence)` | Logs a collaborator + evidence. |
| Settle | `settle(work_id)` *(payable)* | Consensus scores contributions; revenue split + paid out. |
| Read | `get_work(id)` / `stats()` | Scores, per-contributor payouts. |

### Correctness check & split math

`_score` wraps the scoring in **`gl.eq_principle.prompt_comparative`** — principle: *"the highest-scored
contribution id must match, and each score must agree within 20 points."* `validate_scores` requires a
0–100 score for every contributor; `normalize_scores` clamps + fills. `split_by_scores(value, scores)`
does the proportional integer split (equal split if no signal), conserving every wei — **dust goes to the
top contributor**. Unit-tested incl. split math, dust conservation, and a full create→add→settle(80/20).

## Architecture

```
RoyaltySplit/
├── contracts/royalty_split.py  ← GenLayer Intelligent Contract (consensus contribution scoring + proportional emit_transfer)
├── tests/                      ← pytest: score guards, split_by_scores math + dust, settle payout flow
└── app/                        ← React + Vite + Tailwind v4 + Framer Motion (21st.dev style)
                                  gold royalty theme, contributor board + proportional split bar + payouts
```

## Tests

```bash
cd RoyaltySplit
python3 -m venv .venv && .venv/bin/pip install pytest -q
.venv/bin/python -m pytest tests/ -q
```
Covers `normalize_scores` / `validate_scores`, `split_by_scores` (proportional + equal-fallback + dust
conservation), settle guards, and a full **create → add ×2 → settle(80/20)** payout run (shim auto-inits
`TreeMap`, stubs `emit_transfer`). On-chain: deployment verified live (`stats`); payable `settle` in-app.

## Deploy

```bash
genlayer deploy --contract contracts/royalty_split.py
```
