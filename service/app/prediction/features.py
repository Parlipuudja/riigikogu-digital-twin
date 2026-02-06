"""
Feature engineering for vote prediction.

For each (MP, bill) pair, compute features from historical data.
These features feed the statistical model (logistic regression / XGBoost).
"""

import logging
from collections import Counter

import numpy as np
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.sync.riigikogu import extract_party_code

logger = logging.getLogger(__name__)

FEATURE_NAMES = [
    "party_loyalty_rate",
    "bill_topic_similarity",
    "committee_relevance",
    "coalition_bill",
    "defection_rate_by_topic",
    "party_cohesion_on_similar",
    "days_since_last_defection",
    "mp_attendance_rate",
    "party_position_strength",
]


async def compute_features(
    db: AsyncIOMotorDatabase,
    mp: dict,
    bill_embedding: list[float] | None = None,
    bill_initiators: list[str] | None = None,
) -> dict[str, float]:
    """Compute all features for an (MP, bill) prediction."""
    member_uuid = mp.get("memberUuid")
    party_code = mp.get("partyCode", "FR")

    features = {}

    # 1. Party loyalty rate (from precomputed stats or computed live)
    features["party_loyalty_rate"] = mp.get("stats", {}).get("partyAlignmentRate", 85.0) / 100.0

    # 2. Bill topic similarity (cosine similarity between bill and MP's past votes)
    if bill_embedding:
        features["bill_topic_similarity"] = await _bill_topic_similarity(
            db, member_uuid, party_code, bill_embedding
        )
    else:
        features["bill_topic_similarity"] = 0.0

    # 3. Committee relevance
    features["committee_relevance"] = await _committee_relevance(db, mp, bill_initiators)

    # 4. Coalition bill (did a coalition-aligned party initiate this?)
    features["coalition_bill"] = await _coalition_bill(db, party_code, bill_initiators)

    # 5. Defection rate by topic (MP's defection rate on similar votes)
    if bill_embedding:
        features["defection_rate_by_topic"] = await _defection_rate_by_topic(
            db, member_uuid, party_code, bill_embedding
        )
    else:
        features["defection_rate_by_topic"] = 0.0

    # 6. Party cohesion on similar votes
    if bill_embedding:
        features["party_cohesion_on_similar"] = await _party_cohesion_on_similar(
            db, party_code, bill_embedding
        )
    else:
        features["party_cohesion_on_similar"] = 1.0

    # 7. Days since last defection
    features["days_since_last_defection"] = await _days_since_last_defection(
        db, member_uuid, party_code
    )

    # 8. MP attendance rate
    features["mp_attendance_rate"] = mp.get("stats", {}).get("attendance", 80.0) / 100.0

    # 9. Party position strength
    features["party_position_strength"] = await _party_position_strength(db, party_code)

    return features


async def compute_features_for_training(
    db: AsyncIOMotorDatabase,
    member_uuid: str,
    party_code: str,
    voting: dict,
) -> dict[str, float] | None:
    """Compute features for a historical vote (for training data generation)."""
    features = {}

    # 1. Party loyalty rate up to this voting's date
    features["party_loyalty_rate"] = await _historical_loyalty(
        db, member_uuid, party_code, voting.get("votingTime")
    )

    # 2. Topic similarity
    embedding = voting.get("embedding")
    if embedding:
        features["bill_topic_similarity"] = await _bill_topic_similarity(
            db, member_uuid, party_code, embedding, before_date=voting.get("votingTime")
        )
    else:
        features["bill_topic_similarity"] = 0.0

    # 3-4: Committee relevance and coalition bill require additional data
    # Use defaults for historical training to keep it tractable
    features["committee_relevance"] = 0.0
    features["coalition_bill"] = 0.0

    # 5. Historical defection rate
    features["defection_rate_by_topic"] = 0.0

    # 6. Party cohesion on this voting
    features["party_cohesion_on_similar"] = _compute_party_cohesion(voting, party_code)

    # 7. Days since last defection (approximation)
    features["days_since_last_defection"] = 30.0  # Normalize later

    # 8. Attendance rate
    features["mp_attendance_rate"] = 0.8  # Default

    # 9. Party position strength on this vote
    features["party_position_strength"] = _compute_party_position_strength(voting, party_code)

    return features


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    a_arr = np.array(a)
    b_arr = np.array(b)
    dot = np.dot(a_arr, b_arr)
    norm = np.linalg.norm(a_arr) * np.linalg.norm(b_arr)
    if norm == 0:
        return 0.0
    return float(dot / norm)


async def _bill_topic_similarity(
    db: AsyncIOMotorDatabase,
    member_uuid: str,
    party_code: str,
    bill_embedding: list[float],
    before_date: str | None = None,
) -> float:
    """Cosine similarity between bill and mean of MP's past vote embeddings."""
    query = {"voters.memberUuid": member_uuid, "embedding": {"$exists": True}}
    if before_date:
        query["votingTime"] = {"$lt": before_date}

    cursor = db.votings.find(query, {"embedding": 1}).sort("votingTime", -1).limit(50)
    embeddings = []
    async for doc in cursor:
        if doc.get("embedding"):
            embeddings.append(doc["embedding"])

    if not embeddings:
        return 0.0

    mean_embedding = np.mean(embeddings, axis=0).tolist()
    return _cosine_similarity(bill_embedding, mean_embedding)


async def _committee_relevance(
    db: AsyncIOMotorDatabase,
    mp: dict,
    bill_initiators: list[str] | None,
) -> float:
    """Check if MP's committees overlap with bill's context."""
    if not bill_initiators:
        return 0.0

    # Get MP's committee names from members collection
    member = await db.members.find_one(
        {"uuid": mp.get("memberUuid")},
        {"committees": 1},
    )
    if not member:
        return 0.0

    committee_names = [c.get("name", "").lower() for c in member.get("committees", [])]
    if not committee_names:
        return 0.0

    # Check if any initiator or bill keyword matches a committee name
    initiator_text = " ".join(bill_initiators).lower()
    for committee in committee_names:
        if any(word in initiator_text for word in committee.split() if len(word) > 4):
            return 1.0

    return 0.0


async def _coalition_bill(
    db: AsyncIOMotorDatabase,
    mp_party: str,
    bill_initiators: list[str] | None,
) -> float:
    """Determine if the bill was initiated by a coalition-aligned party."""
    if not bill_initiators:
        return 0.0

    # Dynamic coalition detection: find parties that vote together >70% of the time
    coalition_partners = await _detect_coalition(db)

    mp_coalition = mp_party in coalition_partners
    initiator_text = " ".join(bill_initiators).lower()

    # Check if any coalition party name appears in initiators
    from app.sync.riigikogu import PARTY_NAMES
    for party_code in coalition_partners:
        names = PARTY_NAMES.get(party_code, ("", ""))
        for name in names:
            if name.lower() in initiator_text:
                return 1.0 if mp_coalition else 0.0

    return 0.5  # Unknown


async def _detect_coalition(db: AsyncIOMotorDatabase) -> set[str]:
    """
    Detect coalition parties from voting correlation patterns.
    Parties that vote together >70% of the time are coalition partners.
    """
    # Get recent votings
    votings = await db.votings.find(
        {},
        {"voters": 1},
    ).sort("votingTime", -1).limit(100).to_list(100)

    if not votings:
        return set()

    # Compute per-party majority per voting
    party_positions: dict[str, list[str]] = {}  # party -> [majority decisions]

    for voting in votings:
        party_decisions: dict[str, list[str]] = {}
        for voter in voting.get("voters", []):
            party = extract_party_code(voter.get("faction"))
            decision = voter.get("decision", "ABSENT")
            if decision != "ABSENT":
                party_decisions.setdefault(party, []).append(decision)

        for party, decisions in party_decisions.items():
            if decisions:
                majority = Counter(decisions).most_common(1)[0][0]
                party_positions.setdefault(party, []).append(majority)

    # Find clusters of parties that agree >70% of the time
    parties = list(party_positions.keys())
    agreement_matrix: dict[tuple[str, str], float] = {}

    for i, p1 in enumerate(parties):
        for p2 in parties[i + 1:]:
            pos1 = party_positions[p1]
            pos2 = party_positions[p2]
            min_len = min(len(pos1), len(pos2))
            if min_len == 0:
                continue
            agree = sum(1 for a, b in zip(pos1[:min_len], pos2[:min_len]) if a == b)
            agreement_matrix[(p1, p2)] = agree / min_len

    # Find the largest cluster with >70% agreement
    # Simple approach: find the party with most high-agreement partners
    coalition = set()
    for party in parties:
        partners = [party]
        for other in parties:
            if other == party:
                continue
            key = (min(party, other), max(party, other))
            if agreement_matrix.get(key, 0) > 0.7:
                partners.append(other)
        if len(partners) > len(coalition):
            coalition = set(partners)

    return coalition


async def _defection_rate_by_topic(
    db: AsyncIOMotorDatabase,
    member_uuid: str,
    party_code: str,
    bill_embedding: list[float],
) -> float:
    """MP's defection rate on historically similar bills."""
    # Find similar votings using embedding
    cursor = db.votings.find(
        {"voters.memberUuid": member_uuid, "embedding": {"$exists": True}},
        {"voters": 1, "embedding": 1},
    ).sort("votingTime", -1).limit(100)

    similar_votings = []
    async for voting in cursor:
        sim = _cosine_similarity(bill_embedding, voting.get("embedding", []))
        if sim > 0.5:  # Only consider similar votes
            similar_votings.append(voting)

    if not similar_votings:
        return 0.0

    defections = 0
    total = 0
    for voting in similar_votings:
        mp_decision, party_majority = _get_mp_and_party_decision(
            voting, member_uuid, party_code
        )
        if mp_decision and party_majority:
            total += 1
            if mp_decision != party_majority:
                defections += 1

    return defections / total if total > 0 else 0.0


async def _party_cohesion_on_similar(
    db: AsyncIOMotorDatabase,
    party_code: str,
    bill_embedding: list[float],
) -> float:
    """How united was the party on similar past votes?"""
    cursor = db.votings.find(
        {"embedding": {"$exists": True}},
        {"voters": 1, "embedding": 1},
    ).sort("votingTime", -1).limit(100)

    cohesions = []
    async for voting in cursor:
        sim = _cosine_similarity(bill_embedding, voting.get("embedding", []))
        if sim > 0.5:
            cohesion = _compute_party_cohesion(voting, party_code)
            cohesions.append(cohesion)

    return float(np.mean(cohesions)) if cohesions else 1.0


def _compute_party_cohesion(voting: dict, party_code: str) -> float:
    """Fraction of party members who voted with the party majority."""
    party_decisions = []
    for voter in voting.get("voters", []):
        if extract_party_code(voter.get("faction")) == party_code:
            decision = voter.get("decision", "ABSENT")
            if decision != "ABSENT":
                party_decisions.append(decision)

    if not party_decisions:
        return 1.0

    majority = Counter(party_decisions).most_common(1)[0][0]
    aligned = sum(1 for d in party_decisions if d == majority)
    return aligned / len(party_decisions)


def _compute_party_position_strength(voting: dict, party_code: str) -> float:
    """How strong is the party majority on this vote? 1.0 = unanimous."""
    return _compute_party_cohesion(voting, party_code)


async def _days_since_last_defection(
    db: AsyncIOMotorDatabase,
    member_uuid: str,
    party_code: str,
) -> float:
    """Days since MP last voted against their party. Normalized to 0-1 (more recent = closer to 0)."""
    cursor = db.votings.find(
        {"voters.memberUuid": member_uuid},
        {"voters": 1, "votingTime": 1},
    ).sort("votingTime", -1).limit(100)

    days = 365  # Default: hasn't defected in a year
    async for voting in cursor:
        mp_decision, party_majority = _get_mp_and_party_decision(
            voting, member_uuid, party_code
        )
        if mp_decision and party_majority and mp_decision != party_majority:
            from datetime import datetime
            try:
                vote_time = datetime.fromisoformat(voting["votingTime"].replace("Z", "+00:00"))
                delta = (datetime.now(vote_time.tzinfo) - vote_time).days
                days = min(days, max(delta, 0))
            except Exception:
                pass
            break

    # Normalize: 0 = defected today, 1 = hasn't defected in 365+ days
    return min(days / 365.0, 1.0)


async def _historical_loyalty(
    db: AsyncIOMotorDatabase,
    member_uuid: str,
    party_code: str,
    before_date: str | None = None,
) -> float:
    """Compute party loyalty rate up to a given date."""
    query = {"voters.memberUuid": member_uuid}
    if before_date:
        query["votingTime"] = {"$lt": before_date}

    cursor = db.votings.find(query, {"voters": 1}).sort("votingTime", -1).limit(100)

    aligned = 0
    total = 0
    async for voting in cursor:
        mp_decision, party_majority = _get_mp_and_party_decision(
            voting, member_uuid, party_code
        )
        if mp_decision and party_majority:
            total += 1
            if mp_decision == party_majority:
                aligned += 1

    return aligned / total if total > 0 else 0.85


async def _party_position_strength(db: AsyncIOMotorDatabase, party_code: str) -> float:
    """Average party cohesion across recent votes."""
    votings = await db.votings.find(
        {}, {"voters": 1}
    ).sort("votingTime", -1).limit(50).to_list(50)

    cohesions = [_compute_party_cohesion(v, party_code) for v in votings]
    return float(np.mean(cohesions)) if cohesions else 0.85


def _get_mp_and_party_decision(
    voting: dict, member_uuid: str, party_code: str
) -> tuple[str | None, str | None]:
    """Get MP's decision and party majority for a voting."""
    mp_decision = None
    party_decisions = []
    for voter in voting.get("voters", []):
        if voter["memberUuid"] == member_uuid:
            mp_decision = voter.get("decision")
        if extract_party_code(voter.get("faction")) == party_code:
            d = voter.get("decision", "ABSENT")
            if d != "ABSENT":
                party_decisions.append(d)

    if not party_decisions:
        return mp_decision, None

    party_majority = Counter(party_decisions).most_common(1)[0][0]
    return mp_decision, party_majority
