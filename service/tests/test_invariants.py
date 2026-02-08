"""Regression fixture tests for known-good MP records.

These test _parse_member, _parse_committees, and _parse_convocations
with API-shaped fixture data to catch silent parser regressions.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.sync.riigikogu import RiigikoguSync, extract_party_code, make_slug


def _make_sync():
    """Create a RiigikoguSync with a mocked DB (no real connection needed)."""
    db = MagicMock()
    sync = object.__new__(RiigikoguSync)
    sync.db = db
    sync.base_url = "https://api.riigikogu.ee/api"
    sync.delay_ms = 0
    sync.min_delay_ms = 0
    return sync


# --- Fixture data matching real Riigikogu API responses ---

HELME_RAW = {
    "uuid": "f4e5d00e-19d1-428a-ba5e-5ce9ae4ef2c2",
    "firstName": "Helle-Moonika",
    "lastName": "Helme",
    "fullName": "Helle-Moonika Helme",
    "active": True,
    "factions": [
        {
            "name": "Eesti Konservatiivse Rahvaerakonna fraktsioon",
            "membership": {"startDate": "2023-04-03", "endDate": None},
        },
    ],
    "photo": {
        "_links": {"download": {"href": "/api/files/4a4ad9bc/download"}},
    },
}

HELME_DETAIL = {
    "memberships": [
        {
            "membershipNumber": 14,
            "committees": [
                {
                    "name": "Kultuurikomisjon",
                    "membership": {"startDate": "2019-04-03", "endDate": "2023-04-02", "role": {"value": "liige"}},
                },
            ],
        },
        {
            "membershipNumber": 15,
            "committees": [
                {
                    "name": "Kultuurikomisjon",
                    "membership": {"startDate": "2023-04-03", "endDate": None, "role": {"value": "liige"}},
                },
            ],
        },
    ],
}

KUTT_RAW = {
    "uuid": "aaa-bbb-ccc",
    "firstName": "Helmen",
    "lastName": "Kütt",
    "fullName": "Helmen Kütt",
    "active": True,
    "factions": [
        {
            "name": "Fraktsiooni mittekuuluvad Riigikogu liikmed",
            "membership": {"startDate": "2023-04-03", "endDate": None},
        },
        {
            "name": "Sotsiaaldemokraatliku Erakonna fraktsioon",
            "membership": {"startDate": "2023-04-03", "endDate": None},
        },
    ],
    "photo": {
        "_links": {"download": {"href": "/api/files/xxx/download"}},
    },
}

KUTT_DETAIL = {
    "memberships": [
        {
            "membershipNumber": 12,
            "committees": [],
        },
        {
            "membershipNumber": 15,
            "committees": [
                {
                    "name": "Sotsiaalkomisjon",
                    "membership": {"startDate": "2023-04-03", "endDate": None, "role": {"value": "esimees"}},
                },
                {
                    "name": "Euroopa Liidu asjade komisjon",
                    "membership": {"startDate": "2023-04-03", "endDate": None, "role": {"value": "liige"}},
                },
            ],
        },
    ],
}

HUSSAR_RAW = {
    "uuid": "ddd-eee-fff",
    "firstName": "Lauri",
    "lastName": "Hussar",
    "fullName": "Lauri Hussar",
    "active": True,
    "factions": [
        {
            "name": "Eesti 200 fraktsioon",
            "membership": {"startDate": "2023-04-03", "endDate": "2024-03-01"},
        },
        {
            "name": "Reformierakonna fraktsioon",
            "membership": {"startDate": "2024-03-01", "endDate": None},
        },
    ],
    "photo": {
        "_links": {"download": {"href": "/api/files/yyy/download"}},
    },
}

HUSSAR_DETAIL = {
    "memberships": [
        {
            "membershipNumber": 15,
            "committees": [],  # Speaker has no committees
        },
    ],
}

JAANSON_RAW = {
    "uuid": "ggg-hhh-iii",
    "firstName": "Jüri",
    "lastName": "Jaanson",
    "fullName": "Jüri Jaanson",
    "active": True,
    "factions": [
        {
            "name": "Reformierakonna fraktsioon",
            "membership": {"startDate": "2019-04-03", "endDate": None},
        },
    ],
    "photo": {
        "_links": {"download": {"href": "/api/files/zzz/download"}},
    },
}

JAANSON_DETAIL = {
    "memberships": [
        {
            "membershipNumber": 14,
            "committees": [
                {
                    "name": "Keskkonnakomisjon",
                    "membership": {"startDate": "2019-04-03", "endDate": "2023-04-02", "role": {"value": "liige"}},
                },
            ],
        },
        {
            "membershipNumber": 15,
            "committees": [
                {
                    "name": "Keskkonnakomisjon",
                    "membership": {"startDate": "2023-04-03", "endDate": None, "role": {"value": "liige"}},
                },
                {
                    "name": "Sotsiaalkomisjon",
                    "membership": {"startDate": "2023-04-03", "endDate": None, "role": {"value": "liige"}},
                },
            ],
        },
    ],
}

GRUNTHAL_RAW = {
    "uuid": "jjj-kkk-lll",
    "firstName": "Kalle",
    "lastName": "Grünthal",
    "fullName": "Kalle Grünthal",
    "active": True,
    "factions": [
        {
            "name": "Eesti Konservatiivse Rahvaerakonna fraktsioon",
            "membership": {"startDate": "2019-04-03", "endDate": "2023-11-15"},
        },
        {
            "name": "Fraktsiooni mittekuuluvad Riigikogu liikmed",
            "membership": {"startDate": "2023-11-15", "endDate": None},
        },
    ],
    "photo": {
        "_links": {"download": {"href": "/api/files/www/download"}},
    },
}

# --- Tests ---


class TestHelmeFixture:
    """Helle-Moonika Helme: EKRE, Kultuurikomisjon, convocations 14+15."""

    def test_party(self):
        sync = _make_sync()
        member = sync._parse_member(HELME_RAW)
        assert member["partyCode"] == "EKRE"

    def test_slug(self):
        assert make_slug("Helle-Moonika", "Helme") == "helle-moonika-helme"

    def test_committees(self):
        sync = _make_sync()
        committees = sync._parse_committees(HELME_DETAIL)
        names = [c["name"] for c in committees]
        assert "Kultuurikomisjon" in names

    def test_convocations(self):
        sync = _make_sync()
        convocations = sync._parse_convocations(HELME_DETAIL)
        assert 14 in convocations
        assert 15 in convocations

    def test_photo(self):
        sync = _make_sync()
        member = sync._parse_member(HELME_RAW)
        assert member["photoUrl"] is not None
        assert "4a4ad9bc" in member["photoUrl"]


class TestKuttFixture:
    """Helmen Kütt: SDE (not FR), has Sotsiaalkomisjon."""

    def test_party_prefers_real_faction_over_mittekuuluvad(self):
        sync = _make_sync()
        member = sync._parse_member(KUTT_RAW)
        assert member["partyCode"] == "SDE", (
            "Should prefer SDE faction over mittekuuluvad"
        )

    def test_slug_ascii(self):
        assert make_slug("Helmen", "Kütt") == "helmen-kutt"

    def test_committees(self):
        sync = _make_sync()
        committees = sync._parse_committees(KUTT_DETAIL)
        names = [c["name"] for c in committees]
        assert "Sotsiaalkomisjon" in names
        assert "Euroopa Liidu asjade komisjon" in names

    def test_committee_role(self):
        sync = _make_sync()
        committees = sync._parse_committees(KUTT_DETAIL)
        sotsiaal = next(c for c in committees if c["name"] == "Sotsiaalkomisjon")
        assert sotsiaal["role"] == "esimees"


class TestHussarFixture:
    """Lauri Hussar: RE (current, after E200), Speaker (no committees)."""

    def test_party_uses_active_faction(self):
        sync = _make_sync()
        member = sync._parse_member(HUSSAR_RAW)
        assert member["partyCode"] == "RE", (
            "Should use active faction (RE), not ended one (E200)"
        )

    def test_no_committees(self):
        sync = _make_sync()
        committees = sync._parse_committees(HUSSAR_DETAIL)
        assert committees == []

    def test_slug(self):
        assert make_slug("Lauri", "Hussar") == "lauri-hussar"


class TestJaansonFixture:
    """Jüri Jaanson: RE, has committees, slug strips diacritics."""

    def test_party(self):
        sync = _make_sync()
        member = sync._parse_member(JAANSON_RAW)
        assert member["partyCode"] == "RE"

    def test_slug_strips_diacritics(self):
        assert make_slug("Jüri", "Jaanson") == "juri-jaanson"

    def test_committees_deduped(self):
        sync = _make_sync()
        committees = sync._parse_committees(JAANSON_DETAIL)
        names = [c["name"] for c in committees]
        assert "Keskkonnakomisjon" in names
        # Keskkonnakomisjon appears in both convocations but should be deduped
        assert names.count("Keskkonnakomisjon") == 1

    def test_convocations(self):
        sync = _make_sync()
        convocations = sync._parse_convocations(JAANSON_DETAIL)
        assert convocations == [14, 15]


class TestGrunthalFixture:
    """Kalle Grünthal: FR (correctly, after leaving EKRE)."""

    def test_party_is_fr_after_leaving_ekre(self):
        sync = _make_sync()
        member = sync._parse_member(GRUNTHAL_RAW)
        assert member["partyCode"] == "FR", (
            "EKRE membership ended, should be FR (mittekuuluvad)"
        )

    def test_slug_strips_diacritics(self):
        assert make_slug("Kalle", "Grünthal") == "kalle-grunthal"
