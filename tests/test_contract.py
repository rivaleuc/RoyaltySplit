"""RoyaltySplit tests: score guards, proportional split math, and create→add→settle payout flow."""


def test_normalize_scores(contract):
    n = contract.normalize_scores
    r = n({"scores": {"0": 80, "1": 20}, "note": "lead did most"}, ["0", "1"])
    assert r["scores"] == {"0": 80, "1": 20}
    assert n({"scores": {"0": 999}}, ["0", "1"])["scores"] == {"0": 100, "1": 0}   # clamp + fill
    assert n({}, ["0"])["note"] == "no note"

def test_validate_scores(contract):
    v = contract.validate_scores
    assert v({"scores": {"0": 50, "1": 50}}, ["0", "1"])
    assert not v({"scores": {"0": 50}}, ["0", "1"])           # missing id
    assert not v({"scores": {"0": 50, "1": 200}}, ["0", "1"]) # out of range
    assert not v({"scores": "nope"}, ["0"])

def test_split_by_scores(contract):
    s = contract.split_by_scores
    assert s(1000, [50, 50]) == [500, 500]
    assert s(1000, [70, 30]) == [700, 300]
    assert s(1000, [0, 0]) == [500, 500]                      # no signal -> equal
    assert sum(s(1000, [1, 1, 1])) == 1000                    # dust conserved
    assert s(1000, [1, 1, 1]) == [334, 333, 333]              # dust to top (first max)


def _new(contract):
    return contract, contract.RoyaltySplit()

def test_settle_guards(contract):
    mod, c = _new(contract)
    wid = c.create_work("Song A")
    mod.gl.message.value = 0
    try:
        c.settle(wid); assert False, "zero revenue should fail"
    except Exception:
        pass
    mod.gl.message.value = 10**18
    try:
        c.settle(wid); assert False, "no contributions should fail"
    except Exception:
        pass
    mod.gl.message.value = 0

def test_settle_splits_by_score(contract):
    mod, c = _new(contract)
    wid = c.create_work("Album track")
    c.add_contribution(wid, "0xWriter000000000000000000000000000000001", "wrote lyrics + melody")
    c.add_contribution(wid, "0xMixer0000000000000000000000000000000002", "mixed + mastered")
    mod.gl.nondet.exec_prompt = staticmethod(lambda *a, **k: {"scores": {"0": 80, "1": 20}, "note": "writer led"})
    mod.gl.message.value = 10**18
    out = c.settle(wid)
    assert out["distributed_wei"] == str(10**18) and out["scores"] == [80, 20]
    w = c.get_work(wid)
    assert w["state"] == "settled"
    assert w["contributions"][0]["paid_wei"] == str(8 * 10**17)   # 80%
    assert w["contributions"][1]["paid_wei"] == str(2 * 10**17)   # 20%
    assert c.stats()["settled"] == 1 and c.stats()["distributed_wei"] == str(10**18)
    mod.gl.nondet.exec_prompt = staticmethod(lambda *a, **k: {})
    mod.gl.message.value = 0
