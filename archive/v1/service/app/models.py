"""Pydantic models mirroring the MongoDB schema from SPECS.md."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class VoteDecision(str, Enum):
    FOR = "FOR"
    AGAINST = "AGAINST"
    ABSTAIN = "ABSTAIN"
    ABSENT = "ABSENT"


# --- Members ---


class Committee(BaseModel):
    name: str
    role: str | None = None
    active: bool = True


class Member(BaseModel):
    uuid: str
    firstName: str
    lastName: str
    fullName: str
    active: bool = True
    faction: dict | None = None  # { name: str }
    partyCode: str = "FR"
    photoUrl: str | None = None
    committees: list[Committee] = []
    convocations: list[int] = []
    syncedAt: datetime | None = None


# --- Votings ---


class Voter(BaseModel):
    memberUuid: str
    fullName: str
    faction: str | None = None
    decision: VoteDecision


class Voting(BaseModel):
    uuid: str
    title: str
    titleEn: str | None = None
    description: str | None = None
    votingTime: str | None = None
    sessionDate: str | None = None
    type: dict | None = None  # { code, value }
    result: str | None = None
    inFavor: int = 0
    against: int = 0
    abstained: int = 0
    absent: int = 0
    voters: list[Voter] = []
    relatedDraftUuid: str | None = None
    embedding: list[float] | None = None
    syncedAt: datetime | None = None


# --- Stenograms ---


class Speaker(BaseModel):
    memberUuid: str | None = None
    fullName: str
    text: str
    topic: str | None = None


class Stenogram(BaseModel):
    uuid: str
    sessionDate: str | None = None
    sessionType: str | None = None
    speakers: list[Speaker] = []
    syncedAt: datetime | None = None


# --- Drafts ---


class Draft(BaseModel):
    uuid: str
    number: str | None = None
    title: str
    titleEn: str | None = None
    type: dict | None = None
    status: dict | None = None
    summary: str | None = None
    initiators: list[str] = []
    submitDate: str | None = None
    relatedVotingUuids: list[str] = []
    embedding: list[float] | None = None
    syncedAt: datetime | None = None


# --- MPs (enriched profiles) ---


class MPStats(BaseModel):
    totalVotes: int = 0
    attendance: float = 0.0
    votesFor: int = 0
    votesAgainst: int = 0
    votesAbstain: int = 0
    partyAlignmentRate: float = 0.0


class MP(BaseModel):
    slug: str
    memberUuid: str
    name: str
    firstName: str
    lastName: str
    party: str = ""
    partyCode: str = "FR"
    photoUrl: str | None = None
    status: str = "active"
    isCurrentMember: bool = True
    stats: MPStats = Field(default_factory=MPStats)
    instruction: dict | None = None
    backtest: dict | None = None


# --- Sync Progress ---


class SyncCheckpoint(BaseModel):
    year: int
    completed: bool = False
    recordCount: int = 0
    lastOffset: int = 0


class SyncProgress(BaseModel):
    id: str = Field(alias="_id")
    status: str = "idle"
    totalRecords: int = 0
    earliestDate: str | None = None
    latestDate: str | None = None
    checkpoints: list[SyncCheckpoint] = []
    lastRunAt: datetime | None = None
    error: str | None = None


# --- Prediction ---


class FeatureValue(BaseModel):
    name: str
    value: float
    importance: float | None = None


class Prediction(BaseModel):
    mpSlug: str
    mpUuid: str | None = None
    votingUuid: str | None = None
    billTitle: str
    billHash: str | None = None
    predicted: VoteDecision
    confidence: float
    featuresUsed: list[FeatureValue] = []
    modelVersion: str | None = None
    reasoning: dict | None = None  # { et: str, en: str }
    predictedAt: datetime | None = None
    actual: VoteDecision | None = None
    correct: bool | None = None
    resolvedAt: datetime | None = None


# --- API request/response ---


class BillInput(BaseModel):
    title: str
    description: str | None = None
    fullText: str | None = None
    billType: str | None = None
    draftUuid: str | None = None


class PredictionResponse(BaseModel):
    prediction: VoteDecision
    confidence: float
    reasoning: dict | None = None
    features: list[FeatureValue] = []
    modelVersion: str | None = None
    cached: bool = False
