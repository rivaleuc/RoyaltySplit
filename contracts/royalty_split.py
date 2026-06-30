# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
RoyaltySplit — revenue split by consensus-scored contribution, on GenLayer.

Co-creators register a work and log their contributions (each with evidence).
`settle` is payable: every validator independently scores each contribution's
weight from its evidence, accepted only when they agree on the relative weighting
(comparative equivalence — the top contributor + scores within a margin). The
incoming revenue is then split proportionally to the agreed scores and paid out
via emit_transfer — no pre-agreed percentages, no manual haggling.

The verb is "score contributions → proportional payout" — a fair split decided by
consensus over evidence, distinct from a fixed escrow or a single winner.
"""
import json
from genlayer import *


def normalize_scores(raw, valid_ids) -> dict:
    if not isinstance(raw, dict):
        raw = {}
    valid = [str(i) for i in valid_ids]
    scores_in = raw.get("scores") if isinstance(raw.get("scores"), dict) else {}
    scores = {}
    for i in valid:
        s = scores_in.get(i)
        if not isinstance(s, int) or isinstance(s, bool):
            s = 0
        scores[i] = max(0, min(100, s))
    note = raw.get("note")
    note = note[:500] if isinstance(note, str) and note.strip() else "no note"
    return {"scores": scores, "note": note}


def validate_scores(data, valid_ids) -> bool:
    if not isinstance(data, dict):
        return False
    s = data.get("scores")
    if not isinstance(s, dict):
        return False
    for i in valid_ids:
        v = s.get(str(i))
        if not isinstance(v, int) or isinstance(v, bool) or v < 0 or v > 100:
            return False
    return True


def split_by_scores(value: int, scores):
    """Proportional integer split; dust goes to the highest-scored contributor."""
    value = int(value)
    scores = [int(x) for x in scores]
    n = len(scores)
    if n == 0:
        return []
    total = sum(scores)
    if total <= 0:                       # no signal -> equal split
        base = value // n
        out = [base] * n
        out[-1] += value - base * n
        return out
    out = [value * s // total for s in scores]
    rem = value - sum(out)
    if rem > 0:
        top = max(range(n), key=lambda i: scores[i])
        out[top] += rem
    return out


@gl.evm.contract_interface
class _Payee:
    class View:
        pass

    class Write:
        pass


class RoyaltySplit(gl.Contract):
    works: TreeMap[str, str]
    work_count: u256
    settled_count: u256
    distributed_wei: u256

    def __init__(self):
        self.work_count = u256(0)
        self.settled_count = u256(0)
        self.distributed_wei = u256(0)

    @gl.public.write
    def create_work(self, title: str) -> str:
        title = str(title).strip()
        if not title:
            raise Exception("title required")
        key = str(int(self.work_count))
        rec = {
            "creator": str(gl.message.sender_address),
            "title": title[:200],
            "contributions": [],       # [{contributor, evidence, score, paid_wei}]
            "state": "open",           # open -> settled
            "note": "",
        }
        self.works[key] = json.dumps(rec)
        self.work_count += u256(1)
        return key

    @gl.public.write
    def add_contribution(self, work_id: str, contributor: str, evidence: str) -> dict:
        work_id = str(work_id)
        if work_id not in self.works:
            raise Exception("unknown work")
        w = json.loads(self.works[work_id])
        if w["state"] != "open":
            raise Exception("work already settled")
        contributor = str(contributor).strip()
        evidence = str(evidence).strip()
        if not contributor or not evidence:
            raise Exception("contributor and evidence required")
        if len(w["contributions"]) >= 12:
            raise Exception("contribution limit reached")
        w["contributions"].append({"contributor": contributor[:60], "evidence": evidence[:600], "score": 0, "paid_wei": "0"})
        self.works[work_id] = json.dumps(w)
        return {"work": work_id, "contributions": len(w["contributions"])}

    @gl.public.write.payable
    def settle(self, work_id: str) -> dict:
        """Pay in revenue; consensus scores contributions and splits proportionally."""
        work_id = str(work_id)
        if work_id not in self.works:
            raise Exception("unknown work")
        w = json.loads(self.works[work_id])
        if w["state"] != "open":
            raise Exception("already settled")
        revenue = int(gl.message.value)
        if revenue <= 0:
            raise Exception("send revenue to settle")
        n = len(w["contributions"])
        if n < 1:
            raise Exception("no contributions to split")

        ids = [str(i) for i in range(n)]
        res = self._score(w["title"], w["contributions"], ids)
        scores = [res["scores"].get(str(i), 0) for i in range(n)]
        payouts = split_by_scores(revenue, scores)

        for i in range(n):
            w["contributions"][i]["score"] = scores[i]
            w["contributions"][i]["paid_wei"] = str(payouts[i])
            if payouts[i] > 0:
                _Payee(Address(w["contributions"][i]["contributor"])).emit_transfer(value=u256(int(payouts[i])))
        w["note"] = res["note"]
        w["state"] = "settled"
        self.works[work_id] = json.dumps(w)
        self.settled_count += u256(1)
        self.distributed_wei += u256(revenue)
        return {"work": work_id, "distributed_wei": str(revenue), "scores": scores}

    def _score(self, title: str, contributions, ids) -> dict:
        block = "\n".join(f"[{i}] {c['contributor']}: {c['evidence'][:400]}" for i, c in enumerate(contributions))

        def do_score() -> str:
            prompt = f"""You are splitting revenue for a collaborative work by contribution weight.

WORK: {title}

CONTRIBUTIONS (id in brackets):
{block}

Score each contribution's weight 0-100 (relative importance to the work).
Reply ONLY JSON: {{"scores": {{"<id>": <int 0-100>}}, "note": "<short rationale>"}}"""
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(raw, dict):
                try:
                    raw = json.loads(str(raw))
                except Exception:
                    raw = {}
            return json.dumps(normalize_scores(raw, ids))

        result = gl.eq_principle.prompt_comparative(
            do_score,
            principle=(
                "The highest-scored contribution id must match across validators, and each score must "
                "agree within 20 points. The note may differ."
            ),
        )
        data = json.loads(result) if isinstance(result, str) else result
        if not validate_scores(data, ids):
            data = normalize_scores(data if isinstance(data, dict) else {}, ids)
        return data

    @gl.public.view
    def get_work(self, work_id: str) -> dict:
        work_id = str(work_id)
        if work_id not in self.works:
            return {"exists": False}
        w = json.loads(self.works[work_id])
        w["exists"] = True
        return w

    @gl.public.view
    def stats(self) -> dict:
        return {"total_works": int(self.work_count), "settled": int(self.settled_count), "distributed_wei": str(int(self.distributed_wei))}
