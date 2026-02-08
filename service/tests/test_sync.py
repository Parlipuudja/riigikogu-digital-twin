"""Tests for sync utility functions."""

from app.models import VoteDecision
from app.sync.riigikogu import extract_party_code, make_slug, normalize_decision


class TestNormalizeDecision:
    def test_estonian_for(self):
        assert normalize_decision("POOLT") == VoteDecision.FOR

    def test_estonian_against(self):
        assert normalize_decision("VASTU") == VoteDecision.AGAINST

    def test_estonian_abstain(self):
        assert normalize_decision("ERAPOOLETU") == VoteDecision.ABSTAIN

    def test_estonian_absent(self):
        assert normalize_decision("PUUDUB") == VoteDecision.ABSENT

    def test_english_for(self):
        assert normalize_decision("FOR") == VoteDecision.FOR

    def test_english_against(self):
        assert normalize_decision("AGAINST") == VoteDecision.AGAINST

    def test_dict_input(self):
        assert normalize_decision({"code": "POOLT"}) == VoteDecision.FOR

    def test_none_returns_absent(self):
        assert normalize_decision(None) == VoteDecision.ABSENT

    def test_unknown_returns_absent(self):
        assert normalize_decision("UNKNOWN") == VoteDecision.ABSENT

    def test_case_insensitive(self):
        assert normalize_decision("poolt") == VoteDecision.FOR

    def test_short_codes(self):
        assert normalize_decision("P") == VoteDecision.FOR
        assert normalize_decision("V") == VoteDecision.AGAINST
        assert normalize_decision("E") == VoteDecision.ABSTAIN


class TestExtractPartyCode:
    def test_reform(self):
        assert extract_party_code("Reformierakonna fraktsioon") == "RE"

    def test_ekre(self):
        assert extract_party_code("Konservatiivse Rahvaerakonna fraktsioon") == "EKRE"

    def test_isamaa(self):
        assert extract_party_code("Isamaa fraktsioon") == "I"

    def test_sde(self):
        assert extract_party_code("Sotsiaaldemokraatliku Erakonna fraktsioon") == "SDE"

    def test_keskerakond(self):
        assert extract_party_code("Keskerakonna fraktsioon") == "K"

    def test_e200(self):
        assert extract_party_code("Eesti 200 fraktsioon") == "E200"

    def test_none_returns_fr(self):
        assert extract_party_code(None) == "FR"

    def test_unknown_returns_fr(self):
        assert extract_party_code("Something Unknown") == "FR"

    def test_already_code(self):
        assert extract_party_code("RE") == "RE"
        assert extract_party_code("EKRE") == "EKRE"


class TestMakeSlug:
    def test_simple(self):
        assert make_slug("Kaja", "Kallas") == "kaja-kallas"

    def test_estonian_diacritics_stripped(self):
        assert make_slug("Jüri", "Ratas") == "juri-ratas"
        assert make_slug("Tõnis", "Lukas") == "tonis-lukas"
        assert make_slug("Helmen", "Kütt") == "helmen-kutt"
        assert make_slug("Õnne", "Pillak") == "onne-pillak"
        assert make_slug("Stig", "Rästa") == "stig-rasta"

    def test_estonian_caron_stripped(self):
        assert make_slug("Kristina", "Šmigun-Vähi") == "kristina-smigun-vahi"
        assert make_slug("Aleksandr", "Tšaplõgin") == "aleksandr-tsaplogin"
        assert make_slug("Züleyxa", "Izmailova") == "zuleyxa-izmailova"

    def test_space_in_first_name(self):
        assert make_slug("Kristo Enn", "Vaga") == "kristo-enn-vaga"
        assert make_slug("Helle-Moonika", "Helme") == "helle-moonika-helme"

    def test_hyphenated_last_name(self):
        assert make_slug("Lea", "Danilson-Järg") == "lea-danilson-jarg"
        assert make_slug("Anastassia", "Kovalenko-Kõlvart") == "anastassia-kovalenko-kolvart"

    def test_special_chars_removed(self):
        slug = make_slug("Test.", "Name!")
        assert "." not in slug
        assert "!" not in slug
