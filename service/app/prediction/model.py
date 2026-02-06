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
from app.prediction.features import (
    FEATURE_NAMES,
    compute_features,
    compute_features_for_training,
)
from app.sync.riigikogu import extract_party_code

logger = logging.getLogger(__name__)

# In-memory model state
_model: LogisticRegression | None = None
_label_encoder: LabelEncoder | None = None
_model_version: str = "untrained"


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

    # Encode labels
    le = LabelEncoder()
    all_labels = list(set(y_train + y_test)) or ["FOR", "AGAINST", "ABSTAIN"]
    le.fit(all_labels)
    y_train_enc = le.transform(y_train)

    # Train logistic regression
    model = LogisticRegression(
        max_iter=1000,
        multi_class="multinomial",
        solver="lbfgs",
        class_weight="balanced",
    )
    model.fit(X_train, y_train_enc)

    # Evaluate on test set
    train_accuracy = 0.0
    test_accuracy = 0.0

    if len(X_test) > 0:
        y_test_enc = le.transform(y_test)
        test_accuracy = float(model.score(X_test, y_test_enc) * 100)
        train_accuracy = float(model.score(X_train, y_train_enc) * 100)
    else:
        train_accuracy = float(model.score(X_train, y_train_enc) * 100)

    # Check if we need XGBoost
    version = "logistic-v1"
    if test_accuracy > 0 and test_accuracy < 87:
        logger.info(f"Logistic accuracy {test_accuracy:.1f}% < 87%, trying XGBoost...")
        try:
            from xgboost import XGBClassifier
            xgb_model = XGBClassifier(
                n_estimators=200,
                max_depth=6,
                learning_rate=0.1,
                use_label_encoder=False,
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

    # Deploy
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
    }

    # Feature importances
    feature_importances = []
    if hasattr(model, "coef_"):
        importances = np.abs(model.coef_).mean(axis=0)
        for name, imp in zip(FEATURE_NAMES, importances):
            feature_importances.append({"name": name, "importance": round(float(imp), 4)})
    elif hasattr(model, "feature_importances_"):
        for name, imp in zip(FEATURE_NAMES, model.feature_importances_):
            feature_importances.append({"name": name, "importance": round(float(imp), 4)})

    feature_importances.sort(key=lambda x: x["importance"], reverse=True)

    await db.model_state.update_one(
        {"_id": "current"},
        {"$set": {
            "version": version,
            "trainedAt": datetime.now(timezone.utc),
            "trainingSize": len(X_train),
            "features": FEATURE_NAMES,
            "featureImportances": feature_importances,
            "accuracy": {
                "overall": round(test_accuracy, 1) if test_accuracy > 0 else None,
            },
        }},
        upsert=True,
    )

    logger.info(f"Model trained: {version}, test accuracy: {test_accuracy:.1f}%")
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


async def _build_training_data(
    db: AsyncIOMotorDatabase,
    before_date: str | None = None,
    after_date: str | None = None,
) -> tuple[list[list[float]], list[str]]:
    """Build feature matrix and label vector from historical votes."""
    query = {}
    if before_date and after_date:
        query["votingTime"] = {"$gte": after_date}
    elif before_date:
        query["votingTime"] = {"$lt": before_date}
    elif after_date:
        query["votingTime"] = {"$gte": after_date}

    votings = await db.votings.find(
        query,
        {"uuid": 1, "voters": 1, "votingTime": 1, "embedding": 1},
    ).sort("votingTime", -1).limit(2000).to_list(2000)

    X = []
    y = []

    # Get all MPs for reference
    mps_map = {}
    async for mp in db.mps.find({}, {"slug": 1, "memberUuid": 1, "partyCode": 1}):
        mps_map[mp.get("memberUuid")] = mp

    for voting in votings:
        voters = voting.get("voters", [])
        party_code_map: dict[str, str] = {}
        for voter in voters:
            party_code_map[voter["memberUuid"]] = extract_party_code(voter.get("faction"))

        for voter in voters:
            decision = voter.get("decision", "ABSENT")
            if decision == "ABSENT":
                continue  # Skip absent votes in training

            member_uuid = voter["memberUuid"]
            party_code = party_code_map.get(member_uuid, "FR")

            features = await compute_features_for_training(
                db, member_uuid, party_code, voting
            )
            if features is None:
                continue

            feature_vec = [features.get(name, 0.0) for name in FEATURE_NAMES]
            X.append(feature_vec)
            y.append(decision)

    return X, y
