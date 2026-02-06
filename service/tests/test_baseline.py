"""Tests for the baseline predictor."""

from app.models import VoteDecision
from app.sync.riigikogu import normalize_decision, extract_party_code, make_slug


def test_normalize_decision_estonian():
    assert normalize_decision("POOLT") == VoteDecision.FOR
    assert normalize_decision("VASTU") == VoteDecision.AGAINST
    assert normalize_decision("ERAPOOLETU") == VoteDecision.ABSTAIN
    assert normalize_decision("PUUDUB") == VoteDecision.ABSENT


def test_normalize_decision_english():
    assert normalize_decision("FOR") == VoteDecision.FOR
    assert normalize_decision("AGAINST") == VoteDecision.AGAINST
    assert normalize_decision("ABSTAIN") == VoteDecision.ABSTAIN
    assert normalize_decision("ABSENT") == VoteDecision.ABSENT


def test_normalize_decision_codes():
    assert normalize_decision("P") == VoteDecision.FOR
    assert normalize_decision("V") == VoteDecision.AGAINST
    assert normalize_decision("E") == VoteDecision.ABSTAIN
    assert normalize_decision("-") == VoteDecision.ABSENT


def test_normalize_decision_dict():
    assert normalize_decision({"code": "POOLT"}) == VoteDecision.FOR
    assert normalize_decision({"value": "VASTU"}) == VoteDecision.AGAINST


def test_normalize_decision_none():
    assert normalize_decision(None) == VoteDecision.ABSENT


def test_extract_party_code():
    assert extract_party_code("Eesti Konservatiivne Rahvaerakond") == "EKRE"
    assert extract_party_code("Isamaa Erakond") == "I"
    assert extract_party_code("Eesti Reformierakond") == "RE"
    assert extract_party_code("Sotsiaaldemokraatlik Erakond") == "SDE"
    assert extract_party_code("Eesti Keskerakond") == "K"
    assert extract_party_code("Eesti 200") == "E200"
    assert extract_party_code("Fraktsioonitud") == "FR"
    assert extract_party_code(None) == "FR"
    assert extract_party_code("") == "FR"


def test_make_slug():
    assert make_slug("Martin", "Helme") == "martin-helme"
    assert make_slug("Kaja", "Kallas") == "kaja-kallas"
    assert make_slug("Züleyxa", "Izmailova") == "züleyxa-izmailova"
