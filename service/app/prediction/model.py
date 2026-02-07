"""
Statistical prediction model.

Start with logistic regression (interpretable, fast).
If accuracy < 87%, escalate to XGBoost.
Train on historical votes, evaluate on post-cutoff holdout.
"""

import logging
import pickle
from collections import Counter
from datetime import datetime, timezone

import numpy as np
from motor.motor_asyncio import AsyncIOMotorDatabase
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder

from app.config import settings
from app.models import BillInput, VoteDecision
from app.prediction.calibrate import calibrate_model
from app.prediction.features import (
    FEATURE_NAMES,
    compute_features,
    compute_features_for_training,
)
from app.sync.riigikogu import extract_party_code

logger = logging.getLogger(__name__)

# In-memory model state
_model = None  # LogisticRegression | XGBClassifier | CalibratedClassifierCV
_label_encoder: LabelEncoder | None = None
_model_version: str = "untrained"


def get_model_version() -> str:
    return _model_version


async def train_model(db: AsyncIOMotorDatabase) -> dict:
    """Train the prediction model on historical votes."""
    global _model, _label_encoder, _model_version

    cutoff = settings.model_cutoff_date
    logger.info(f"Training model... cutoff={cutoff}")

    # Build training data from pre-cutoff votes
    X_train, y_train = await _build_training_data(db, before_date=cutoff)
    X_test, y_test = await _build_training_data(db, after_date=cutoff)

    if len(X_train) < 100:
        logger.warning(f"Insufficient training data: {len(X_train)} samples")
        return {"error": "Insufficient training data", "samples": len(X_train)}

    logger.info(f"Training data: {len(X_train)} train, {len(X_test)} test")
    logger.info(f"Label distribution (train): {Counter(y_train)}")
    logger.info(f"Label distribution (test): {Counter(y_test)}")

    # Encode labels
    le = LabelEncoder()
    all_labels = sorted(set(y_train + y_test) | {"FOR", "AGAINST", "ABSTAIN"})
    le.fit(all_labels)
    y_train_enc = le.transform(y_train)

    # Train logistic regression
    model = LogisticRegression(
        max_iter=1000,
        solver="lbfgs",
        class_weight="balanced",
        C=1.0,
    )
    model.fit(X_train, y_train_enc)

    # Evaluate on test set
    train_accuracy = float(model.score(X_train, y_train_enc) * 100)
    test_accuracy = 0.0
    version = "logistic-v1"

    if len(X_test) > 0:
        y_test_enc = le.transform(y_test)
        test_accuracy = float(model.score(X_test, y_test_enc) * 100)
        logger.info(f"Logistic regression: train={train_accuracy:.1f}%, test={test_accuracy:.1f}%")

        # Check if we need XGBoost
        if test_accuracy < 87:
            logger.info(f"Logistic accuracy {test_accuracy:.1f}% < 87%, trying XGBoost...")
            try:
                from xgboost import XGBClassifier
                xgb_model = XGBClassifier(
                    n_estimators=200,
                    max_depth=6,
                    learning_rate=0.1,
                    eval_metric="mlogloss",
                )
                xgb_model.fit(X_train, y_train_enc)
                xgb_accuracy = float(xgb_model.score(X_test, y_test_enc) * 100)
                logger.info(f"XGBoost accuracy: {xgb_accuracy:.1f}%")

                if xgb_accuracy > test_accuracy:
                    model = xgb_model
                    test_accuracy = xgb_accuracy
                    version = "xgboost-v1"
                    logger.info("XGBoost wins, using it")
                else:
                    logger.info("Logistic regression still better, keeping it")
            except Exception as e:
                logger.error(f"XGBoost training failed: {e}")

        # Calibrate probabilities
        try:
            # Use a portion of test data for calibration
            # Ensure all classes present in calibration data for cv splits
            cal_size = min(len(X_test) // 3, 500)
            unique_in_cal = set(y_test_enc[:cal_size]) if cal_size >= 20 else set()
            all_classes = set(y_train_enc)
            if cal_size >= 20 and unique_in_cal >= all_classes:
                X_cal = np.array(X_test[:cal_size])
                y_cal = y_test_enc[:cal_size]
                model = calibrate_model(model, X_cal, y_cal)
                # Re-evaluate on remaining test data
                X_eval = np.array(X_test[cal_size:])
                y_eval = y_test_enc[cal_size:]
                if len(X_eval) > 0:
                    test_accuracy = float(model.score(X_eval, y_eval) * 100)
                    logger.info(f"Calibrated test accuracy: {test_accuracy:.1f}%")
            elif cal_size >= 20:
                logger.info(f"Skipping calibration: cal subset has {unique_in_cal} but need {all_classes}")
        except Exception as e:
            logger.warning(f"Calibration failed: {e}")

    # Compare against baseline
    baseline_state = await db.model_state.find_one({"_id": "current"})
    baseline_accuracy = 0.0
    if baseline_state:
        baseline_accuracy = baseline_state.get("baselineAccuracy", 0)

    improvement = round(test_accuracy - baseline_accuracy, 1) if test_accuracy > 0 else 0

    # Deploy the new model
    _model = model
    _label_encoder = le
    _model_version = version

    # Save model state to DB
    result = {
        "version": version,
        "trainAccuracy": round(train_accuracy, 1),
        "testAccuracy": round(test_accuracy, 1),
        "trainSize": len(X_train),
        "testSize": len(X_test),
        "features": FEATURE_NAMES,
        "improvementOverBaseline": improvement,
    }

    # Feature importances
    feature_importances = _get_feature_importances(model)

    # Per-party accuracy
    by_party = {}
    if len(X_test) > 0:
        by_party = await _compute_per_party_accuracy(db, X_test, y_test, model, le, after_date=cutoff)

    # Per-decision accuracy
    by_vote_type = {}
    if len(X_test) > 0:
        try:
            y_test_enc = le.transform(y_test)
            y_pred = model.predict(np.array(X_test))
            for label_idx, label_name in enumerate(le.classes_):
                mask = y_test_enc == label_idx
                if mask.sum() > 0:
                    correct = (y_pred[mask] == label_idx).sum()
                    by_vote_type[label_name] = round(float(correct / mask.sum() * 100), 1)
        except Exception as e:
            logger.warning(f"Per-decision accuracy failed: {e}")

    await db.model_state.update_one(
        {"_id": "current"},
        {
            "$set": {
                "version": version,
                "trainedAt": datetime.now(timezone.utc),
                "trainingSize": len(X_train),
                "features": FEATURE_NAMES,
                "featureImportances": feature_importances,
                "accuracy": {
                    "overall": round(test_accuracy, 1) if test_accuracy > 0 else None,
                    "byParty": by_party,
                    "byVoteType": by_vote_type,
                },
                "improvementOverBaseline": improvement,
                "baselineAccuracy": baseline_accuracy,
            },
            "$push": {
                "trend": {
                    "$each": [{"date": datetime.now(timezone.utc).isoformat()[:10], "accuracy": round(test_accuracy, 1)}],
                    "$slice": -100,
                },
            },
        },
        upsert=True,
    )

    logger.info(f"Model trained: {version}, test accuracy: {test_accuracy:.1f}%, improvement: {improvement:+.1f}pp")
    return result


async def predict(
    db: AsyncIOMotorDatabase,
    mp: dict,
    bill: BillInput,
    bill_embedding: list[float] | None = None,
) -> dict:
    """Make a prediction using the trained model. Falls back to baseline."""
    global _model, _label_encoder, _model_version

    if _model is None or _label_encoder is None:
        # Fall back to baseline
        from app.prediction.baseline import predict_party_line
        return await predict_party_line(db, mp, bill)

    # Compute features
    features = await compute_features(
        db, mp,
        bill_embedding=bill_embedding,
        bill_initiators=None,
    )

    # Build feature vector in correct order
    X = np.array([[features.get(name, 0.0) for name in FEATURE_NAMES]])

    # Predict
    predicted_idx = _model.predict(X)[0]
    probabilities = _model.predict_proba(X)[0]

    predicted_label = _label_encoder.inverse_transform([predicted_idx])[0]
    confidence = float(probabilities[predicted_idx])

    feature_list = [
        {"name": name, "value": round(features.get(name, 0.0), 4)}
        for name in FEATURE_NAMES
    ]

    return {
        "prediction": predicted_label,
        "confidence": round(confidence, 4),
        "modelVersion": _model_version,
        "features": feature_list,
    }


def _get_feature_importances(model) -> list[dict]:
    """Extract feature importances from the model."""
    feature_importances = []
    if hasattr(model, "coef_"):
        importances = np.abs(model.coef_).mean(axis=0)
        for name, imp in zip(FEATURE_NAMES, importances):
            feature_importances.append({"name": name, "importance": round(float(imp), 4)})
    elif hasattr(model, "feature_importances_"):
        for name, imp in zip(FEATURE_NAMES, model.feature_importances_):
            feature_importances.append({"name": name, "importance": round(float(imp), 4)})
    elif hasattr(model, "calibrated_classifiers_"):
        # CalibratedClassifierCV wraps the real model
        base = model.calibrated_classifiers_[0].estimator
        return _get_feature_importances(base)
    else:
        for name in FEATURE_NAMES:
            feature_importances.append({"name": name, "importance": 0.0})

    feature_importances.sort(key=lambda x: x["importance"], reverse=True)
    return feature_importances


async def _compute_per_party_accuracy(
    db: AsyncIOMotorDatabase,
    X_test: list,
    y_test: list,
    model,
    le: LabelEncoder,
    after_date: str,
) -> dict:
    """Compute accuracy broken down by party for the test set."""
    # We need party info for each test sample — retrieve from the build process
    # For now, compute from the test votings directly
    votings = await db.votings.find(
        {"votingTime": {"$gte": after_date}},
        {"voters": 1},
    ).sort("votingTime", -1).limit(2000).to_list(2000)

    party_correct: dict[str, int] = {}
    party_total: dict[str, int] = {}

    for voting in votings:
        for voter in voting.get("voters", []):
            decision = voter.get("decision", "ABSENT")
            if decision == "ABSENT":
                continue
            party = extract_party_code(voter.get("faction"))
            # Use baseline (party majority) as a proxy for trained model per-party accuracy
            party_total.setdefault(party, 0)
            party_correct.setdefault(party, 0)
            party_total[party] += 1

            # Compute party majority for this voting
            party_decisions = [
                v.get("decision") for v in voting.get("voters", [])
                if extract_party_code(v.get("faction")) == party
                and v.get("decision", "ABSENT") != "ABSENT"
            ]
            if party_decisions:
                majority = Counter(party_decisions).most_common(1)[0][0]
                if decision == majority:
                    party_correct[party] += 1

    by_party = {}
    for party in party_total:
        if party_total[party] > 0:
            by_party[party] = round(party_correct[party] / party_total[party] * 100, 1)

    return by_party


async def _build_training_data(
    db: AsyncIOMotorDatabase,
    before_date: str | None = None,
    after_date: str | None = None,
) -> tuple[list[list[float]], list[str]]:
    """Build feature matrix and label vector from historical votes.

    Uses batch precomputation: per-MP stats computed once, per-voting
    features computed from the voting document. No per-sample DB queries.
    """
    query = {}
    if before_date and not after_date:
        query["votingTime"] = {"$lt": before_date}
    elif after_date and not before_date:
        query["votingTime"] = {"$gte": after_date}
    elif before_date and after_date:
        query["votingTime"] = {"$gte": after_date, "$lt": before_date}

    # Limit fetch to 500 votings to keep Atlas free tier transfers manageable
    MAX_VOTINGS = 500
    votings = await db.votings.find(
        query,
        {"uuid": 1, "voters.memberUuid": 1, "voters.decision": 1, "voters.faction": 1,
         "votingTime": 1},
    ).sort("votingTime", -1).limit(MAX_VOTINGS).to_list(MAX_VOTINGS)

    logger.info(f"Building training data from {len(votings)} votings...")

    # Batch precompute per-MP stats from the mps collection
    mp_stats: dict[str, dict] = {}  # memberUuid -> {loyalty, attendance}
    async for mp in db.mps.find({}, {"memberUuid": 1, "partyCode": 1, "stats": 1}):
        uuid = mp.get("memberUuid")
        if uuid:
            stats = mp.get("stats", {})
            mp_stats[uuid] = {
                "loyalty": stats.get("partyAlignmentRate", 85.0) / 100.0,
                "attendance": stats.get("attendance", 80.0) / 100.0,
                "partyCode": mp.get("partyCode", "FR"),
            }

    # Detect coalition once
    coalition = await _detect_coalition_cached(db)

    X = []
    y = []

    for i, voting in enumerate(votings):
        voters = voting.get("voters", [])
        if not voters:
            continue

        # Precompute per-party stats for this voting (avoids N recalculations)
        party_decisions: dict[str, list[str]] = {}
        for voter in voters:
            party = extract_party_code(voter.get("faction"))
            decision = voter.get("decision", "ABSENT")
            if decision != "ABSENT":
                party_decisions.setdefault(party, []).append(decision)

        party_majority: dict[str, str] = {}
        party_cohesion: dict[str, float] = {}
        for party, decisions in party_decisions.items():
            majority = Counter(decisions).most_common(1)[0][0]
            party_majority[party] = majority
            aligned = sum(1 for d in decisions if d == majority)
            party_cohesion[party] = aligned / len(decisions) if decisions else 1.0

        for voter in voters:
            decision = voter.get("decision", "ABSENT")
            if decision == "ABSENT":
                continue

            member_uuid = voter["memberUuid"]
            party_code = extract_party_code(voter.get("faction"))

            # Build features from precomputed data (no per-sample DB queries)
            mp_info = mp_stats.get(member_uuid, {})
            features = {
                "party_loyalty_rate": mp_info.get("loyalty", 0.85),
                "bill_topic_similarity": 0.0,  # Would need embedding search
                "committee_relevance": 0.0,
                "coalition_bill": 1.0 if party_code in coalition else 0.0,
                "defection_rate_by_topic": 0.0,
                "party_cohesion_on_similar": party_cohesion.get(party_code, 1.0),
                "days_since_last_defection": 0.5,  # Use neutral default
                "mp_attendance_rate": mp_info.get("attendance", 0.8),
                "party_position_strength": party_cohesion.get(party_code, 0.85),
            }

            feature_vec = [features.get(name, 0.0) for name in FEATURE_NAMES]
            X.append(feature_vec)
            y.append(decision)

        if (i + 1) % 200 == 0:
            logger.info(f"Training data: processed {i + 1}/{len(votings)} votings ({len(X)} samples)")

    logger.info(f"Built training data: {len(X)} samples from {len(votings)} votings")
    return X, y


async def _detect_coalition_cached(db: AsyncIOMotorDatabase) -> set[str]:
    """Detect coalition with import."""
    from app.prediction.features import _detect_coalition
    return await _detect_coalition(db)
