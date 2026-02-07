"""
Planning loop — identify weaknesses and prioritize improvements.

The system's roadmap is live data in model_state, not a markdown file.
"""

import logging
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


async def plan_improvements(db: AsyncIOMotorDatabase) -> dict:
    """Analyze model state and write improvement priorities."""
    model_state = await db.model_state.find_one({"_id": "current"})
    if not model_state:
        logger.warning("No model state found, nothing to plan")
        return {"priorities": []}

    priorities = []
    accuracy = model_state.get("accuracy", {})
    error_cats = model_state.get("errorCategories", {})
    feature_importances = model_state.get("featureImportances", [])
    baseline_acc = model_state.get("baselineAccuracy", 98)
    model_version = model_state.get("version", "unknown")

    # 1. Weakest MPs (accuracy below baseline - 5pp)
    by_mp = accuracy.get("byMP", [])
    threshold = baseline_acc - 5
    weak_mps = [mp for mp in by_mp if mp.get("accuracy", 100) < threshold]
    if weak_mps:
        weak_mps.sort(key=lambda x: x.get("accuracy", 100))
        names = [m.get("fullName", m.get("memberUuid", "?")) for m in weak_mps[:5]]
        priorities.append({
            "area": "weak_mps",
            "expectedGain": len(weak_mps) * 0.1,
            "action": f"Investigate {len(weak_mps)} MPs with accuracy below {threshold:.0f}%: "
                      f"{', '.join(names)}",
        })

    # 2. Most common error category
    if error_cats:
        top_error = max(error_cats.items(), key=lambda x: x[1])
        if top_error[1] > 0:
            action_map = {
                "free_vote": "Add free-vote detection feature (party cohesion threshold)",
                "party_split": "Add real-time party cohesion monitoring",
                "stale_profile": "Trigger profile regeneration for affected MPs",
                "coalition_shift": "Recalculate coalition affiliations from recent data",
                "feature_gap": "Investigate high-confidence failures for missing signal",
            }
            priorities.append({
                "area": f"error_category:{top_error[0]}",
                "expectedGain": top_error[1] * 0.05,
                "action": action_map.get(top_error[0], f"Address {top_error[0]} errors"),
            })

    # 3. Low-importance features (candidates for replacement)
    if feature_importances:
        low_features = [f for f in feature_importances if f.get("importance", 1) < 0.01]
        if low_features:
            priorities.append({
                "area": "low_importance_features",
                "expectedGain": 0.5,
                "action": f"Consider replacing low-importance features: "
                          f"{', '.join(f['name'] for f in low_features)}",
            })

    # 4. Per-party weaknesses
    by_party = accuracy.get("byParty", {})
    weak_parties = [(p, acc) for p, acc in by_party.items() if acc < baseline_acc - 3]
    if weak_parties:
        weak_parties.sort(key=lambda x: x[1])
        party_strs = [f"{p} ({acc:.1f}%)" for p, acc in weak_parties[:5]]
        priorities.append({
            "area": "weak_parties",
            "expectedGain": len(weak_parties) * 0.3,
            "action": f"Parties below baseline: {', '.join(party_strs)}",
        })

    # 5. Model vs baseline gap
    improvement = model_state.get("improvementOverBaseline", 0)
    if model_version == "baseline-v1" or improvement < 0:
        priorities.append({
            "area": "model_vs_baseline",
            "expectedGain": 2.0,
            "action": f"Model ({model_version}) not beating baseline ({baseline_acc:.1f}%). "
                      f"Need better features or training approach.",
        })

    # 6. Overall accuracy vs baseline target
    overall = accuracy.get("overall")
    if overall is not None and overall < baseline_acc:
        gap = baseline_acc - overall
        priorities.append({
            "area": "overall_accuracy",
            "expectedGain": gap,
            "action": f"Overall accuracy {overall:.1f}% is {gap:.1f}pp below baseline {baseline_acc:.1f}%.",
        })

    # Sort by expected gain
    priorities.sort(key=lambda x: x.get("expectedGain", 0), reverse=True)

    # Write to model_state
    plan_entry = {
        "date": datetime.now(timezone.utc).isoformat()[:10],
        "priorities": priorities,
        "outcome": None,  # Filled after next backtest
    }

    await db.model_state.update_one(
        {"_id": "current"},
        {
            "$set": {"improvementPriorities": priorities},
            "$push": {"planHistory": {"$each": [plan_entry], "$slice": -50}},
        },
        upsert=True,
    )

    logger.info(f"Planned {len(priorities)} improvement priorities")
    return {"priorities": priorities}
