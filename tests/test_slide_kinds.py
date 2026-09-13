from services.slide_kinds import ALL_SLIDE_KINDS, normalize_slide_kinds


def test_normalize_none_means_full_deck():
    assert normalize_slide_kinds(None) is None
    assert normalize_slide_kinds([]) is None


def test_normalize_keeps_known_kinds_only():
    got = normalize_slide_kinds(["kyrie", "nope", "PSALM", ""])
    assert got == {"kyrie", "psalm"}
    assert got <= ALL_SLIDE_KINDS
