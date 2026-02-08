"""
Riigikogu API sync client.

Ports the 867-line TypeScript client. Critical behaviors preserved:
- Dynamic rate limiting with backoff
- Checkpoint-based resumable sync
- Session flattening (sessions → individual votings)
- Decision normalization (Estonian → English)
- Party code extraction from faction names
- Database size monitoring (512MB free tier)
"""

import asyncio
import logging
import re
from datetime import datetime, timezone

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import settings
from app.models import VoteDecision

logger = logging.getLogger(__name__)

# --- Constants ---

DECISION_MAP: dict[str, VoteDecision] = {
    "POOLT": VoteDecision.FOR,
    "FOR": VoteDecision.FOR,
    "P": VoteDecision.FOR,
    "KOHAL": VoteDecision.FOR,
    "VASTU": VoteDecision.AGAINST,
    "AGAINST": VoteDecision.AGAINST,
    "V": VoteDecision.AGAINST,
    "ERAPOOLETU": VoteDecision.ABSTAIN,
    "ABSTAIN": VoteDecision.ABSTAIN,
    "E": VoteDecision.ABSTAIN,
    "PUUDUB": VoteDecision.ABSENT,
    "PUUDUS": VoteDecision.ABSENT,
    "ABSENT": VoteDecision.ABSENT,
    "-": VoteDecision.ABSENT,
}

PARTY_CODE_PATTERNS: list[tuple[str, str]] = [
    ("Konservatiiv", "EKRE"),
    ("EKRE", "EKRE"),
    ("Isamaa", "I"),
    ("Reform", "RE"),
    ("Sotsiaaldemokraat", "SDE"),
    ("Kesk", "K"),
    ("200", "E200"),
    ("Paremp", "PAREMPOOLSED"),
    ("mittekuuluv", "FR"),
]

PARTY_NAMES: dict[str, tuple[str, str]] = {
    "EKRE": ("Eesti Konservatiivne Rahvaerakond", "Estonian Conservative People's Party"),
    "I": ("Isamaa Erakond", "Isamaa Party"),
    "RE": ("Eesti Reformierakond", "Estonian Reform Party"),
    "SDE": ("Sotsiaaldemokraatlik Erakond", "Social Democratic Party"),
    "K": ("Eesti Keskerakond", "Estonian Centre Party"),
    "E200": ("Eesti 200", "Estonia 200"),
    "PAREMPOOLSED": ("Parempoolsed", "Right-wing"),
    "FR": ("Fraktsioonitud", "Non-affiliated"),
}


def normalize_decision(raw: str | dict | None) -> VoteDecision:
    """Normalize vote decision from API format to standard enum."""
    if raw is None:
        return VoteDecision.ABSENT
    if isinstance(raw, dict):
        raw = raw.get("code") or raw.get("value") or ""
    raw = str(raw).strip().upper()
    return DECISION_MAP.get(raw, VoteDecision.ABSENT)


VALID_PARTY_CODES = {"EKRE", "I", "RE", "SDE", "K", "E200", "PAREMPOOLSED", "FR"}


def extract_party_code(faction_name: str | None) -> str:
    """Extract party code from Estonian faction name or return if already a code."""
    if not faction_name:
        return "FR"
    # If it's already a valid party code, return it directly
    stripped = faction_name.strip()
    if stripped in VALID_PARTY_CODES:
        return stripped
    for pattern, code in PARTY_CODE_PATTERNS:
        if pattern.lower() in faction_name.lower():
            return code
    return "FR"


def make_slug(first_name: str, last_name: str) -> str:
    """Create URL-friendly slug from name."""
    slug = f"{first_name}-{last_name}".lower()
    slug = re.sub(r"[^a-z0-9äöüõšž-]", "", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


class RiigikoguSync:
    """Sync client for the Riigikogu API."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.base_url = settings.riigikogu_api_base
        self.delay_ms = settings.riigikogu_rate_limit_ms
        self.min_delay_ms = 200
        self.client = httpx.AsyncClient(timeout=30.0)

    async def close(self):
        await self.client.aclose()

    # --- Rate limiting ---

    async def _rate_limit(self):
        await asyncio.sleep(self.delay_ms / 1000.0)

    def _on_success(self):
        self.delay_ms = max(self.min_delay_ms, int(self.delay_ms * 0.9))

    def _on_rate_limit(self):
        self.delay_ms = min(10000, self.delay_ms * 2)
        logger.warning(f"Rate limited, backoff to {self.delay_ms}ms")

    async def _get(self, path: str, params: dict | None = None) -> dict | list | None:
        """GET with rate limiting and retry."""
        url = f"{self.base_url}{path}"
        for attempt in range(3):
            await self._rate_limit()
            try:
                resp = await self.client.get(url, params=params)
                if resp.status_code == 429:
                    self._on_rate_limit()
                    continue
                if resp.status_code == 404:
                    return None
                resp.raise_for_status()
                self._on_success()
                return resp.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"HTTP {e.response.status_code} for {url}: {e}")
                if attempt == 2:
                    raise
            except httpx.RequestError as e:
                logger.error(f"Request error for {url}: {e}")
                if attempt == 2:
                    raise
                await asyncio.sleep(2 ** attempt)
        return None

    # --- Database size monitoring ---

    async def _check_db_size(self) -> bool:
        """Return False if database is too large to continue syncing."""
        try:
            stats = await self.db.command("dbStats")
            size_mb = stats.get("dataSize", 0) / (1024 * 1024)
            if size_mb > settings.db_size_limit_mb:
                logger.warning(f"Database size {size_mb:.1f}MB exceeds limit {settings.db_size_limit_mb}MB")
                return False
            return True
        except Exception as e:
            logger.error(f"Failed to check db size: {e}")
            return True  # Continue on error

    # --- Checkpoint management ---

    async def _get_progress(self, sync_type: str) -> dict:
        doc = await self.db.sync_progress.find_one({"_id": sync_type})
        if doc is None:
            doc = {
                "_id": sync_type,
                "status": "idle",
                "totalRecords": 0,
                "checkpoints": [],
                "lastRunAt": None,
                "error": None,
            }
        return doc

    async def _save_progress(self, sync_type: str, update: dict):
        await self.db.sync_progress.update_one(
            {"_id": sync_type},
            {"$set": update},
            upsert=True,
        )

    async def _is_year_completed(self, sync_type: str, year: int) -> bool:
        progress = await self._get_progress(sync_type)
        for cp in progress.get("checkpoints", []):
            if cp["year"] == year and cp.get("completed"):
                return True
        return False

    async def _save_checkpoint(self, sync_type: str, year: int, record_count: int,
                                completed: bool = False, last_offset: int = 0):
        progress = await self._get_progress(sync_type)
        checkpoints = progress.get("checkpoints", [])
        found = False
        for cp in checkpoints:
            if cp["year"] == year:
                cp["recordCount"] = record_count
                cp["completed"] = completed
                cp["lastOffset"] = last_offset
                found = True
                break
        if not found:
            checkpoints.append({
                "year": year,
                "recordCount": record_count,
                "completed": completed,
                "lastOffset": last_offset,
            })
        await self._save_progress(sync_type, {"checkpoints": checkpoints})

    # --- Members sync ---

    async def sync_members(self) -> int:
        """Sync all parliament members. Returns count synced."""
        logger.info("Syncing members...")
        await self._save_progress("members", {
            "status": "running",
            "lastRunAt": datetime.now(timezone.utc),
            "error": None,
        })

        try:
            # Get all plenary members
            data = await self._get("/plenary-members", {"lang": "ET"})
            if not data or not isinstance(data, list):
                logger.warning("No members returned from API")
                await self._save_progress("members", {"status": "completed", "totalRecords": 0})
                return 0

            count = 0
            for raw in data:
                member = self._parse_member(raw)
                if member is None:
                    continue

                # Fetch detail for committees and convocations
                detail = await self._get(f"/plenary-members/{member['uuid']}", {"lang": "ET"})
                if detail:
                    member["committees"] = self._parse_committees(detail)
                    member["convocations"] = self._parse_convocations(detail)

                member["syncedAt"] = datetime.now(timezone.utc)
                await self.db.members.update_one(
                    {"uuid": member["uuid"]},
                    {"$set": member},
                    upsert=True,
                )

                # Also create/update the enriched MP profile
                await self._upsert_mp_profile(member)
                count += 1

                if count % 10 == 0:
                    logger.info(f"Synced {count}/{len(data)} members")

            await self._save_progress("members", {
                "status": "completed",
                "totalRecords": count,
            })
            logger.info(f"Members sync complete: {count} members")
            return count

        except Exception as e:
            logger.error(f"Members sync failed: {e}")
            await self._save_progress("members", {"status": "error", "error": str(e)})
            raise

    def _parse_member(self, raw: dict) -> dict | None:
        """Parse a member from the API response."""
        uuid = raw.get("uuid")
        if not uuid:
            return None

        first_name = raw.get("firstName", "")
        last_name = raw.get("lastName", "")
        full_name = raw.get("fullName") or f"{first_name} {last_name}"

        # Handle both old and new faction format
        faction_name = None
        if "factions" in raw and isinstance(raw["factions"], list):
            # New format: factions array with membership sub-objects
            # Find active membership (no endDate) that isn't "mittekuuluvad" (non-affiliated)
            non_affiliated = "mittekuuluvad"
            fallback = None
            for f in raw["factions"]:
                mem = f.get("membership", {})
                if mem.get("endDate") is not None:
                    continue  # Ended membership, skip
                name = f.get("name", "")
                if non_affiliated in name.lower():
                    fallback = name  # Remember as fallback
                else:
                    faction_name = name
                    break
            if faction_name is None:
                faction_name = fallback
        elif "faction" in raw and raw["faction"]:
            # Old format
            faction = raw["faction"]
            faction_name = faction.get("name") or faction.get("value") or ""

        party_code = extract_party_code(faction_name)

        # Photo URL
        photo_url = None
        photo = raw.get("photo")
        if photo and isinstance(photo, dict):
            links = photo.get("_links", {})
            download = links.get("download", {})
            href = download.get("href")
            if href:
                photo_url = f"https://api.riigikogu.ee{href}" if href.startswith("/") else href

        return {
            "uuid": uuid,
            "firstName": first_name,
            "lastName": last_name,
            "fullName": full_name,
            "active": raw.get("active", True),
            "faction": {"name": faction_name} if faction_name else None,
            "partyCode": party_code,
            "photoUrl": photo_url,
        }

    def _parse_committees(self, detail: dict) -> list[dict]:
        """Extract committee memberships from member detail.

        API structure: memberships[] each has a committees[] array with objects like:
        { name: "Kultuurikomisjon", type: {...}, active: true, membership: { startDate, endDate, role: { value } } }
        """
        committees = []
        seen = set()
        for membership in detail.get("memberships", []):
            for c in membership.get("committees", []):
                name = c.get("name", "")
                if not name or name in seen:
                    continue
                seen.add(name)
                mem = c.get("membership", {})
                role = mem.get("role", {})
                committees.append({
                    "name": name,
                    "role": role.get("value") if role else None,
                    "active": mem.get("endDate") is None,
                })
        return committees

    def _parse_convocations(self, detail: dict) -> list[int]:
        """Extract convocation numbers from member detail."""
        convocations = []
        for m in detail.get("memberships", []):
            num = m.get("membershipNumber")
            if num is not None:
                convocations.append(int(num))
        return sorted(set(convocations))

    async def _upsert_mp_profile(self, member: dict):
        """Create or update the enriched MP profile."""
        slug = make_slug(member["firstName"], member["lastName"])
        party_code = member["partyCode"]
        party_names = PARTY_NAMES.get(party_code, ("", ""))

        update_fields = {
            "slug": slug,
            "memberUuid": member["uuid"],
            "name": member["fullName"],
            "firstName": member["firstName"],
            "lastName": member["lastName"],
            "party": party_names[0] if party_names[0] else party_code,
            "partyCode": party_code,
            "photoUrl": member.get("photoUrl"),
            "status": "active" if member.get("active") else "inactive",
            "isCurrentMember": member.get("active", False),
        }

        # Include committees and convocations if present
        if "committees" in member:
            update_fields["committees"] = member["committees"]
        if "convocations" in member:
            update_fields["convocations"] = member["convocations"]

        await self.db.mps.update_one(
            {"slug": slug},
            {"$set": update_fields},
            upsert=True,
        )

    # --- Votings sync ---

    async def sync_votings(self) -> int:
        """Sync all voting records. Returns count synced."""
        logger.info("Syncing votings...")
        await self._save_progress("votings", {
            "status": "running",
            "lastRunAt": datetime.now(timezone.utc),
            "error": None,
        })

        try:
            total_count = 0
            # Iterate by year from 2023 (XV Riigikogu) to now
            current_year = datetime.now().year
            for year in range(2023, current_year + 1):
                # Never skip the current year — new votes arrive throughout the year
                if year < current_year and await self._is_year_completed("votings", year):
                    logger.info(f"Votings {year}: already completed, skipping")
                    continue

                count = await self._sync_votings_year(year)
                total_count += count
                await self._save_checkpoint("votings", year, count, completed=(year < current_year))

                if not await self._check_db_size():
                    logger.warning("DB size limit reached, pausing votings sync")
                    break

            await self._save_progress("votings", {
                "status": "completed",
                "totalRecords": total_count,
            })
            logger.info(f"Votings sync complete: {total_count} votings")
            return total_count

        except Exception as e:
            logger.error(f"Votings sync failed: {e}")
            await self._save_progress("votings", {"status": "error", "error": str(e)})
            raise

    async def _sync_votings_year(self, year: int) -> int:
        """Sync votings for a single year."""
        start_date = f"{year}-01-01"
        end_date = f"{year}-12-31"

        logger.info(f"Syncing votings for {year}...")

        # Get voting sessions
        sessions = await self._get("/votings", {
            "startDate": start_date,
            "endDate": end_date,
        })

        if not sessions or not isinstance(sessions, list):
            return 0

        count = 0
        for session in sessions:
            # Flatten: each session contains nested votings
            nested_votings = session.get("votings", [])
            if not nested_votings:
                # Sessions without votings are empty sittings — skip them
                continue

            for voting_ref in nested_votings:
                voting_uuid = voting_ref.get("uuid")
                if not voting_uuid:
                    continue

                # Check if already synced
                existing = await self.db.votings.find_one(
                    {"uuid": voting_uuid},
                    {"uuid": 1},
                )
                if existing:
                    count += 1
                    continue

                # Fetch full voting detail
                detail = await self._get(f"/votings/{voting_uuid}")
                if not detail:
                    continue

                voting_doc = self._parse_voting(detail, session)
                if voting_doc:
                    await self.db.votings.update_one(
                        {"uuid": voting_doc["uuid"]},
                        {"$set": voting_doc},
                        upsert=True,
                    )
                    count += 1

                if count % 50 == 0:
                    logger.info(f"Votings {year}: synced {count}")
                    if count % 100 == 0 and not await self._check_db_size():
                        return count

        return count

    def _parse_voting(self, detail: dict, session: dict | None = None) -> dict | None:
        """Parse a voting detail response into our schema."""
        uuid = detail.get("uuid")
        if not uuid:
            return None

        # Extract voters with normalized decisions
        voters = []
        for v in detail.get("voters", []):
            voter_uuid = v.get("uuid")
            if not voter_uuid:
                continue

            faction_name = None
            faction = v.get("faction")
            if isinstance(faction, dict):
                faction_name = faction.get("name") or faction.get("value")
            elif isinstance(faction, str):
                faction_name = faction

            decision_raw = v.get("decision")
            decision = normalize_decision(decision_raw)

            voters.append({
                "memberUuid": voter_uuid,
                "fullName": v.get("fullName") or f"{v.get('firstName', '')} {v.get('lastName', '')}",
                "faction": faction_name,
                "decision": decision.value,
            })

        session_date = None
        voting_time = detail.get("startDateTime")
        if session and session.get("sittingDateTime"):
            session_date = session["sittingDateTime"][:10]
        elif voting_time:
            session_date = voting_time[:10]

        return {
            "uuid": uuid,
            "title": detail.get("description") or detail.get("title") or "",
            "description": detail.get("description"),
            "votingTime": voting_time,
            "sessionDate": session_date,
            "type": detail.get("type"),
            "result": detail.get("result"),
            "inFavor": detail.get("inFavor", 0),
            "against": detail.get("against", 0),
            "abstained": detail.get("abstained", 0),
            "absent": detail.get("absent", 0),
            "voters": voters,
            "syncedAt": datetime.now(timezone.utc),
        }

    # --- Stenograms sync ---

    async def sync_stenograms(self) -> int:
        """Sync parliamentary speeches. Returns count synced."""
        logger.info("Syncing stenograms...")
        await self._save_progress("stenograms", {
            "status": "running",
            "lastRunAt": datetime.now(timezone.utc),
            "error": None,
        })

        try:
            total_count = 0
            current_year = datetime.now().year
            for year in range(2023, current_year + 1):
                if year < current_year and await self._is_year_completed("stenograms", year):
                    logger.info(f"Stenograms {year}: already completed, skipping")
                    continue

                count = await self._sync_stenograms_year(year)
                total_count += count
                await self._save_checkpoint("stenograms", year, count, completed=(year < current_year))

                if not await self._check_db_size():
                    logger.warning("DB size limit reached, pausing stenograms sync")
                    break

            await self._save_progress("stenograms", {
                "status": "completed",
                "totalRecords": total_count,
            })
            logger.info(f"Stenograms sync complete: {total_count}")
            return total_count

        except Exception as e:
            logger.error(f"Stenograms sync failed: {e}")
            await self._save_progress("stenograms", {"status": "error", "error": str(e)})
            raise

    async def _sync_stenograms_year(self, year: int) -> int:
        """Sync stenograms for a single year."""
        start_date = f"{year}-01-01"
        end_date = f"{year}-12-31"

        data = await self._get("/steno/verbatims", {
            "startDate": start_date,
            "endDate": end_date,
            "lang": "et",
        })

        if not data or not isinstance(data, list):
            return 0

        count = 0
        max_text_bytes = settings.stenogram_max_bytes

        for session in data:
            session_date = session.get("date")
            session_type = session.get("title", "")
            agenda_items = session.get("agendaItems", [])

            speakers: list[dict] = []
            for item in agenda_items:
                topic = item.get("title", "")
                for event in item.get("events", []):
                    if event.get("type") != "SPEECH":
                        continue
                    text = event.get("text")
                    if not text:
                        continue

                    # Truncate text to limit
                    if len(text.encode("utf-8")) > max_text_bytes:
                        text = text[:max_text_bytes]

                    speakers.append({
                        "memberUuid": event.get("uuid"),
                        "fullName": event.get("speaker", ""),
                        "text": text,
                        "topic": topic,
                    })

            if not speakers:
                continue

            # Use session date + type as a composite identifier
            steno_id = f"{session_date}_{session_type}"[:80]

            await self.db.stenograms.update_one(
                {"uuid": steno_id},
                {"$set": {
                    "uuid": steno_id,
                    "sessionDate": session_date,
                    "sessionType": session_type,
                    "speakers": speakers,
                    "syncedAt": datetime.now(timezone.utc),
                }},
                upsert=True,
            )
            count += 1

        return count

    # --- Drafts sync ---

    async def sync_drafts(self) -> int:
        """Sync legislative drafts. Returns count synced."""
        logger.info("Syncing drafts...")
        await self._save_progress("drafts", {
            "status": "running",
            "lastRunAt": datetime.now(timezone.utc),
            "error": None,
        })

        try:
            total_count = 0
            current_year = datetime.now().year
            for year in range(2023, current_year + 1):
                if year < current_year and await self._is_year_completed("drafts", year):
                    logger.info(f"Drafts {year}: already completed, skipping")
                    continue

                count = await self._sync_drafts_year(year)
                total_count += count
                await self._save_checkpoint("drafts", year, count, completed=(year < current_year))

                if not await self._check_db_size():
                    logger.warning("DB size limit reached, pausing drafts sync")
                    break

            await self._save_progress("drafts", {
                "status": "completed",
                "totalRecords": total_count,
            })
            logger.info(f"Drafts sync complete: {total_count}")
            return total_count

        except Exception as e:
            logger.error(f"Drafts sync failed: {e}")
            await self._save_progress("drafts", {"status": "error", "error": str(e)})
            raise

    async def _sync_drafts_year(self, year: int) -> int:
        """Sync drafts for a single year with pagination."""
        start_date = f"{year}-01-01"
        end_date = f"{year}-12-31"
        page = 0
        count = 0

        while True:
            data = await self._get("/volumes/drafts", {
                "startDate": start_date,
                "endDate": end_date,
                "lang": "et",
                "size": 500,
                "page": page,
            })

            if not data:
                break

            # Handle paginated response
            embedded = data.get("_embedded", data)
            content = embedded.get("content", [])
            if not content:
                break

            for raw in content:
                draft_uuid = raw.get("uuid")
                if not draft_uuid:
                    continue

                # Fetch detail
                detail = await self._get(f"/volumes/drafts/{draft_uuid}", {"lang": "et"})
                if not detail:
                    continue

                draft_doc = self._parse_draft(detail)
                if draft_doc:
                    await self.db.drafts.update_one(
                        {"uuid": draft_doc["uuid"]},
                        {"$set": draft_doc},
                        upsert=True,
                    )
                    count += 1

            # Check pagination
            page_info = data.get("page", {})
            total_pages = page_info.get("totalPages", 1)
            if page + 1 >= total_pages:
                break
            page += 1

        return count

    def _parse_draft(self, detail: dict) -> dict | None:
        """Parse a draft detail into our schema."""
        uuid = detail.get("uuid")
        if not uuid:
            return None

        initiators = []
        for init in detail.get("initiators", []):
            if isinstance(init, str):
                initiators.append(init)
            elif isinstance(init, dict):
                initiators.append(init.get("name", str(init)))

        # Extract related voting UUIDs
        related_votings = []
        for rv in detail.get("relatedVotings", []):
            if isinstance(rv, dict) and rv.get("uuid"):
                related_votings.append(rv["uuid"])
            elif isinstance(rv, str):
                related_votings.append(rv)

        return {
            "uuid": uuid,
            "number": detail.get("number") or detail.get("mark"),
            "title": detail.get("title", ""),
            "type": detail.get("draftType"),
            "status": detail.get("draftStatus"),
            "summary": detail.get("summary"),
            "initiators": initiators,
            "submitDate": detail.get("submitDate"),
            "relatedVotingUuids": related_votings,
            "syncedAt": datetime.now(timezone.utc),
        }

    # --- Full sync orchestrator ---

    async def sync_all(self) -> dict:
        """Run a full sync of all data types."""
        results = {}
        try:
            results["members"] = await self.sync_members()
        except Exception as e:
            results["members"] = f"error: {e}"
            logger.error(f"Members sync error: {e}")

        try:
            results["votings"] = await self.sync_votings()
        except Exception as e:
            results["votings"] = f"error: {e}"
            logger.error(f"Votings sync error: {e}")

        try:
            results["stenograms"] = await self.sync_stenograms()
        except Exception as e:
            results["stenograms"] = f"error: {e}"
            logger.error(f"Stenograms sync error: {e}")

        try:
            results["drafts"] = await self.sync_drafts()
        except Exception as e:
            results["drafts"] = f"error: {e}"
            logger.error(f"Drafts sync error: {e}")

        return results


async def compute_mp_stats(db: AsyncIOMotorDatabase):
    """Compute voting statistics for all MPs from the votings collection."""
    logger.info("Computing MP stats...")

    mps = await db.mps.find({}, {"slug": 1, "memberUuid": 1, "partyCode": 1}).to_list(None)

    for mp in mps:
        uuid = mp.get("memberUuid")
        party_code = mp.get("partyCode", "FR")
        if not uuid:
            continue

        # Count this MP's votes
        pipeline = [
            {"$match": {"voters.memberUuid": uuid}},
            {"$unwind": "$voters"},
            {"$match": {"voters.memberUuid": uuid}},
            {"$group": {
                "_id": "$voters.decision",
                "count": {"$sum": 1},
            }},
        ]
        cursor = db.votings.aggregate(pipeline)
        decision_counts: dict[str, int] = {}
        async for doc in cursor:
            decision_counts[doc["_id"]] = doc["count"]

        total = sum(decision_counts.values())
        votes_for = decision_counts.get("FOR", 0)
        votes_against = decision_counts.get("AGAINST", 0)
        votes_abstain = decision_counts.get("ABSTAIN", 0)
        votes_absent = decision_counts.get("ABSENT", 0)
        attendance = ((total - votes_absent) / total * 100) if total > 0 else 0

        # Compute party alignment rate
        alignment_count = 0
        alignment_total = 0

        # Get party majority decisions for votings this MP participated in
        party_pipeline = [
            {"$match": {"voters.memberUuid": uuid}},
            {"$unwind": "$voters"},
            {"$match": {"voters.decision": {"$ne": "ABSENT"}}},
            {"$group": {
                "_id": {"voting": "$uuid", "faction": "$voters.faction"},
                "decisions": {"$push": "$voters.decision"},
                "memberDecision": {
                    "$max": {
                        "$cond": [{"$eq": ["$voters.memberUuid", uuid]}, "$voters.decision", None]
                    }
                },
            }},
        ]

        # Simpler approach: for each voting, find party majority and compare
        vote_cursor = db.votings.find(
            {"voters.memberUuid": uuid},
            {"uuid": 1, "voters": 1},
        )
        async for voting in vote_cursor:
            mp_decision = None
            party_decisions = []
            for voter in voting.get("voters", []):
                voter_code = extract_party_code(voter.get("faction"))
                if voter["memberUuid"] == uuid:
                    mp_decision = voter["decision"]
                if voter_code == party_code and voter["decision"] != "ABSENT":
                    party_decisions.append(voter["decision"])

            if mp_decision and mp_decision != "ABSENT" and party_decisions:
                # Find party majority
                from collections import Counter
                majority = Counter(party_decisions).most_common(1)[0][0]
                alignment_total += 1
                if mp_decision == majority:
                    alignment_count += 1

        alignment_rate = (alignment_count / alignment_total * 100) if alignment_total > 0 else 0

        await db.mps.update_one(
            {"slug": mp["slug"]},
            {"$set": {
                "stats": {
                    "totalVotes": total,
                    "attendance": round(attendance, 1),
                    "votesFor": votes_for,
                    "votesAgainst": votes_against,
                    "votesAbstain": votes_abstain,
                    "partyAlignmentRate": round(alignment_rate, 1),
                },
            }},
        )

    logger.info(f"MP stats computed for {len(mps)} MPs")
