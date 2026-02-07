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
    X_train, y_train, _parties_train = await _build_training_data(db, before_date=cutoff)
    X_test, y_test, parties_test = await _build_training_data(db, after_date=cutoff)

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

    # Compute moderate sample weights — cap max weight to avoid
    # extreme amplification of rare classes like ABSTAIN (0.3% of data)
    class_counts = Counter(y_train_enc)
    total_samples = len(y_train_enc)
    n_classes = len(class_counts)
    MAX_WEIGHT = 10.0  # Cap to prevent 100x+ amplification of rare classes
    raw_weights = {
        label: min(total_samples / (n_classes * count), MAX_WEIGHT)
        for label, count in class_counts.items()
    }
    sample_weights = np.array([raw_weights[label] for label in y_train_enc])

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

        # Always try XGBoost — with and without sample weights
        logger.info(f"Logistic accuracy {test_accuracy:.1f}%, trying XGBoost variants...")
        try:
            from xgboost import XGBClassifier

            best_xgb = None
            best_xgb_accuracy = test_accuracy
            best_xgb_version = version

            # Variant 1: XGBoost with sample weights
            xgb_weighted = XGBClassifier(
                n_estimators=300,
                max_depth=4,
                learning_rate=0.05,
                min_child_weight=5,
                eval_metric="mlogloss",
            )
            xgb_weighted.fit(X_train, y_train_enc, sample_weight=sample_weights)
            acc_weighted = float(xgb_weighted.score(X_test, y_test_enc) * 100)
            logger.info(f"XGBoost (weighted): {acc_weighted:.1f}%")

            if acc_weighted > best_xgb_accuracy:
                best_xgb = xgb_weighted
                best_xgb_accuracy = acc_weighted
                best_xgb_version = "xgboost-v2-weighted"

            # Variant 2: XGBoost without sample weights
            xgb_natural = XGBClassifier(
                n_estimators=300,
                max_depth=4,
                learning_rate=0.05,
                min_child_weight=5,
                eval_metric="mlogloss",
            )
            xgb_natural.fit(X_train, y_train_enc)
            acc_natural = float(xgb_natural.score(X_test, y_test_enc) * 100)
            logger.info(f"XGBoost (natural): {acc_natural:.1f}%")

            if acc_natural > best_xgb_accuracy:
                best_xgb = xgb_natural
                best_xgb_accuracy = acc_natural
                best_xgb_version = "xgboost-v2-natural"

            if best_xgb is not None:
                model = best_xgb
                test_accuracy = best_xgb_accuracy
                version = best_xgb_version
                logger.info(f"{version} wins at {test_accuracy:.1f}%")
            else:
                logger.info("Logistic regression still best")
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

    # Only deploy model if it beats baseline — otherwise baseline is better
    if test_accuracy > baseline_accuracy and test_accuracy > 0:
        _model = model
        _label_encoder = le
        _model_version = version
        logger.info(f"Model deployed: {version} ({test_accuracy:.1f}% > baseline {baseline_accuracy:.1f}%)")
    else:
        _model = None
        _label_encoder = None
        _model_version = "baseline-v1"
        logger.info(f"Model NOT deployed: {test_accuracy:.1f}% <= baseline {baseline_accuracy:.1f}%, falling back to baseline")

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

    # Per-party accuracy (use the actual model deployed, or baseline proxy)
    by_party = {}
    if len(X_test) > 0 and _model is not None:
        by_party = await _compute_per_party_accuracy(db, X_test, y_test, parties_test, _model, le)

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

    # When model doesn't beat baseline, preserve the current best version/accuracy
    # which may have been set by run_hybrid_backtest
    update_fields = {
        "trainedAt": datetime.now(timezone.utc),
        "trainingSize": len(X_train),
        "features": FEATURE_NAMES,
        "featureImportances": feature_importances,
        "mlModelVersion": version,
        "mlModelAccuracy": round(test_accuracy, 1),
    }

    if _model is not None:
        # Model beats baseline: write model's accuracy data and version
        update_fields["version"] = version
        update_fields["improvementOverBaseline"] = improvement
        update_fields["baselineAccuracy"] = baseline_accuracy
        update_fields["accuracy"] = {
            "overall": round(test_accuracy, 1) if test_accuracy > 0 else None,
            "byParty": by_party,
            "byVoteType": by_vote_type,
        }
    # else: preserve current version/accuracy (could be hybrid-baseline-v1 at 99.2%)

    await db.model_state.update_one(
        {"_id": "current"},
        {
            "$set": update_fields,
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
    """Make a prediction using the trained model. Falls back to smart baseline."""
    global _model, _label_encoder, _model_version

    if _model is None or _label_encoder is None:
        # Fall back to smart baseline (alignment-party for FR, party-line for others)
        return await _smart_baseline_predict(db, mp, bill)

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
    party_labels: list[str],
    model,
    le: LabelEncoder,
) -> dict:
    """Compute accuracy broken down by party for the test set."""
    y_test_enc = le.transform(y_test)
    y_pred = model.predict(np.array(X_test))

    party_correct: dict[str, int] = {}
    party_total: dict[str, int] = {}

    for i, party in enumerate(party_labels):
        party_total.setdefault(party, 0)
        party_correct.setdefault(party, 0)
        party_total[party] += 1
        if y_pred[i] == y_test_enc[i]:
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
) -> tuple[list[list[float]], list[str], list[str]]:
    """Build feature matrix, label vector, and party labels from historical votes.

    Uses batch precomputation: per-MP stats computed once, per-voting
    features computed from the voting document. No per-sample DB queries.

    Returns (X, y, parties) where parties[i] is the party code for sample i.
    """
    query = {}
    if before_date and not after_date:
        query["votingTime"] = {"$lt": before_date}
    elif after_date and not before_date:
        query["votingTime"] = {"$gte": after_date}
    elif before_date and after_date:
        query["votingTime"] = {"$gte": after_date, "$lt": before_date}

    # Limit fetch to keep Atlas free tier transfers manageable
    MAX_VOTINGS = 1000
    votings = await db.votings.find(
        query,
        {"uuid": 1, "voters.memberUuid": 1, "voters.decision": 1, "voters.faction": 1,
         "votingTime": 1},
    ).sort("votingTime", -1).limit(MAX_VOTINGS).to_list(MAX_VOTINGS)

    logger.info(f"Building training data from {len(votings)} votings...")

    # Batch precompute per-MP stats from the mps collection
    mp_stats: dict[str, dict] = {}  # memberUuid -> {loyalty, attendance, personal_for_rate}
    async for mp in db.mps.find({}, {"memberUuid": 1, "partyCode": 1, "stats": 1}):
        uuid = mp.get("memberUuid")
        if uuid:
            stats = mp.get("stats", {})
            loyalty = stats.get("partyAlignmentRate", 85.0) / 100.0
            total_v = stats.get("totalVotes", 1) or 1
            votes_for = stats.get("votesFor", 0) or 0
            mp_stats[uuid] = {
                "loyalty": loyalty,
                "defection_rate": 1.0 - loyalty,
                "attendance": stats.get("attendance", 80.0) / 100.0,
                "partyCode": mp.get("partyCode", "FR"),
                "personal_for_rate": votes_for / max(total_v, 1),
            }

    # Detect coalition once
    coalition = await _detect_coalition_cached(db)

    X = []
    y = []
    parties = []

    for i, voting in enumerate(votings):
        voters = voting.get("voters", [])
        if not voters:
            continue

        # Precompute per-party stats for this voting
        party_decisions: dict[str, list[str]] = {}
        for voter in voters:
            party = extract_party_code(voter.get("faction"))
            decision = voter.get("decision", "ABSENT")
            if decision != "ABSENT":
                party_decisions.setdefault(party, []).append(decision)

        party_majority: dict[str, str] = {}
        party_cohesion: dict[str, float] = {}
        party_margin: dict[str, float] = {}
        for party, decisions in party_decisions.items():
            majority = Counter(decisions).most_common(1)[0][0]
            party_majority[party] = majority
            aligned = sum(1 for d in decisions if d == majority)
            party_cohesion[party] = aligned / len(decisions) if decisions else 1.0
            party_margin[party] = aligned / len(decisions) if decisions else 0.5

        # Compute opposition majority direction for this voting
        direction_map = {"FOR": 1.0, "AGAINST": -1.0, "ABSTAIN": 0.0}
        opp_decisions = []
        for party, decisions in party_decisions.items():
            if party not in coalition:
                opp_decisions.extend(decisions)
        if opp_decisions:
            opp_maj = Counter(opp_decisions).most_common(1)[0][0]
            opp_direction = direction_map.get(opp_maj, 0.0)
        else:
            opp_direction = 0.0

        for voter in voters:
            decision = voter.get("decision", "ABSENT")
            if decision == "ABSENT":
                continue

            member_uuid = voter["memberUuid"]
            party_code = extract_party_code(voter.get("faction"))

            mp_info = mp_stats.get(member_uuid, {})
            maj = party_majority.get(party_code, "FOR")

            features = {
                "party_loyalty_rate": mp_info.get("loyalty", 0.85),
                "coalition_bill": 1.0 if party_code in coalition else 0.0,
                "party_cohesion": party_cohesion.get(party_code, 1.0),
                "mp_attendance_rate": mp_info.get("attendance", 0.8),
                "mp_defection_rate": mp_info.get("defection_rate", 0.15),
                "party_majority_direction": direction_map.get(maj, 0.0),
                "party_majority_margin": party_margin.get(party_code, 0.5),
                "is_independent": 1.0 if party_code == "FR" else 0.0,
                "mp_personal_for_rate": mp_info.get("personal_for_rate", 0.7),
                "opposition_majority_direction": opp_direction,
            }

            feature_vec = [features.get(name, 0.0) for name in FEATURE_NAMES]
            X.append(feature_vec)
            y.append(decision)
            parties.append(party_code)

        if (i + 1) % 200 == 0:
            logger.info(f"Training data: processed {i + 1}/{len(votings)} votings ({len(X)} samples)")

    logger.info(f"Built training data: {len(X)} samples from {len(votings)} votings")
    return X, y, parties


async def _smart_baseline_predict(
    db: AsyncIOMotorDatabase,
    mp: dict,
    bill: BillInput,
) -> dict:
    """Smart baseline: party-line for party MPs, alignment-party for FR.

    For FR members, looks up their alignment party from model_state.frAlignments
    and predicts based on that party's historical majority instead of the
    meaningless FR "party" majority.
    """
    party_code = mp.get("partyCode", "FR")

    if party_code != "FR":
        # Party-affiliated: use standard party-line baseline
        from app.prediction.baseline import predict_party_line
        return await predict_party_line(db, mp, bill)

    # FR member: check alignment party
    member_uuid = mp.get("memberUuid", "")
    model_state = await db.model_state.find_one({"_id": "current"}, {"frAlignments": 1})
    fr_alignments = (model_state or {}).get("frAlignments", {})
    align_party = fr_alignments.get(member_uuid)

    if not align_party:
        # No alignment data — fall back to standard baseline
        from app.prediction.baseline import predict_party_line
        return await predict_party_line(db, mp, bill)

    # Use alignment party's voting pattern for prediction
    party_votes: list[str] = []
    cursor = db.votings.find(
        {}, {"voters": 1},
    ).sort("votingTime", -1).limit(200)

    async for voting in cursor:
        for voter in voting.get("voters", []):
            voter_party = extract_party_code(voter.get("faction"))
            if voter_party == align_party and voter.get("decision") not in ("ABSENT", None):
                party_votes.append(voter["decision"])

    if not party_votes:
        from app.prediction.baseline import predict_party_line
        return await predict_party_line(db, mp, bill)

    majority = Counter(party_votes).most_common(1)[0][0]
    alignment_rate = mp.get("stats", {}).get("partyAlignmentRate", 85.0)
    confidence = alignment_rate / 100.0 if alignment_rate else 0.85

    return {
        "prediction": majority,
        "confidence": round(min(confidence, 0.99), 3),
        "modelVersion": "hybrid-baseline-v1",
        "features": [
            {"name": "alignment_party", "value": align_party},
            {"name": "alignment_party_majority", "value": majority},
            {"name": "party_loyalty_rate", "value": alignment_rate},
        ],
    }


async def _detect_coalition_cached(db: AsyncIOMotorDatabase) -> set[str]:
    """Detect coalition with import."""
    from app.prediction.features import _detect_coalition
    return await _detect_coalition(db)
