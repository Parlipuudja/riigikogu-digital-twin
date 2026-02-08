"""
Claude Code operator — the sixth autonomy loop.

Reads system state from MongoDB, evaluates trigger conditions,
and launches Claude Code sessions to modify the codebase.
Changes are tested before merging. Failed attempts are logged.

The system literally cannot break itself — natural selection at the code level.
"""

import logging
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import settings

logger = logging.getLogger(__name__)

REPO_ROOT = Path("/home/ubuntu/riigikogu-radar")
PROMPTS_DIR = REPO_ROOT / "service" / "prompts"


async def check_and_launch(db: AsyncIOMotorDatabase) -> dict | None:
    """Evaluate trigger conditions and launch a session if needed."""
    model_state = await db.model_state.find_one({"_id": "current"})
    if not model_state:
        logger.info("No model state yet, skipping operator check")
        return None

    # Get last operator session
    last_session = await db.operator_sessions.find_one(
        {}, sort=[("completedAt", -1)]
    )

    session_type = _evaluate_triggers(model_state, last_session)
    if session_type is None:
        logger.info("No operator trigger conditions met")
        return None

    logger.info(f"Operator trigger: {session_type}")
    return await launch_session(db, session_type, model_state)


def _evaluate_triggers(model_state: dict, last_session: dict | None) -> str | None:
    """Determine which session type to launch, if any."""
    accuracy = model_state.get("accuracy", {})
    error_cats = model_state.get("errorCategories", {})

    # Get accuracy from last session for comparison
    last_accuracy = None
    if last_session:
        last_accuracy = last_session.get("accuracyBefore")

    current_accuracy = accuracy.get("overall")

    # Trigger: accuracy drop
    if current_accuracy is not None and last_accuracy is not None:
        drop = last_accuracy - current_accuracy
        if drop > settings.operator_accuracy_drop_threshold * 100:
            return "improvement"

    # Trigger: new error pattern
    for category, count in error_cats.items():
        if count >= settings.operator_error_count_threshold:
            return "investigation"

    # Trigger: persistent sync failure
    # (checked via sync_progress in the actual implementation)

    return None


async def launch_session(
    db: AsyncIOMotorDatabase,
    session_type: str,
    state: dict,
) -> dict:
    """Launch a Claude Code operator session with git branch safety."""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    branch = f"operator/{session_type}/{timestamp}"

    # Build prompt
    prompt = _build_prompt(session_type, state)

    # Record session start
    session_doc = {
        "sessionType": session_type,
        "triggeredBy": f"scheduled_{session_type}",
        "stateSnapshot": _sanitize_state(state),
        "prompt": prompt[:2000],  # Truncate for storage
        "startedAt": datetime.now(timezone.utc),
        "branch": branch,
        "filesChanged": [],
        "testsPassed": False,
        "merged": False,
        "commitHash": None,
        "summary": "",
        "accuracyBefore": state.get("accuracy", {}).get("overall"),
        "accuracyAfter": None,
    }

    # Create git branch
    try:
        subprocess.run(
            ["git", "checkout", "-b", branch],
            cwd=REPO_ROOT, capture_output=True, check=True,
        )
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to create branch {branch}: {e}")
        session_doc["summary"] = f"Failed to create branch: {e}"
        session_doc["completedAt"] = datetime.now(timezone.utc)
        await db.operator_sessions.insert_one(session_doc)
        return session_doc

    try:
        # Launch Claude Code
        result = subprocess.run(
            ["claude", "--print", "-p", prompt,
             "--allowedTools", "Read,Write,Edit,Bash,Glob,Grep"],
            cwd=str(REPO_ROOT),
            capture_output=True, text=True,
            timeout=settings.operator_session_timeout_seconds,
        )

        session_doc["summary"] = result.stdout[:2000] if result.stdout else ""

        # Check what files changed
        diff_result = subprocess.run(
            ["git", "diff", "--name-only", "main"],
            cwd=REPO_ROOT, capture_output=True, text=True,
        )
        changed_files = [f for f in diff_result.stdout.strip().split("\n") if f]
        session_doc["filesChanged"] = changed_files

        # Safety check: too many files changed
        if len(changed_files) > settings.operator_max_files_per_session:
            logger.warning(f"Too many files changed ({len(changed_files)}), discarding")
            _discard_branch(branch)
            session_doc["summary"] += f"\nDiscarded: {len(changed_files)} files exceeds limit"
            session_doc["completedAt"] = datetime.now(timezone.utc)
            await db.operator_sessions.insert_one(session_doc)
            return session_doc

        # Safety check: SOUL.md or SPECS.md modified
        protected = {"SOUL.md", "SPECS.md", ".env", ".env.local"}
        if protected & set(changed_files):
            logger.warning("Protected files modified, discarding")
            _discard_branch(branch)
            session_doc["summary"] += "\nDiscarded: protected files modified"
            session_doc["completedAt"] = datetime.now(timezone.utc)
            await db.operator_sessions.insert_one(session_doc)
            return session_doc

        if not changed_files:
            logger.info("No files changed, nothing to merge")
            _discard_branch(branch)
            session_doc["summary"] += "\nNo changes made"
            session_doc["completedAt"] = datetime.now(timezone.utc)
            await db.operator_sessions.insert_one(session_doc)
            return session_doc

        # Run tests
        test_result = subprocess.run(
            ["sudo", "docker", "compose", "exec", "service",
             "python", "-m", "pytest", "tests/", "-x", "--tb=short"],
            cwd=REPO_ROOT, capture_output=True, text=True,
            timeout=120,
        )
        session_doc["testsPassed"] = test_result.returncode == 0

        if test_result.returncode == 0:
            # Merge to main
            subprocess.run(["git", "checkout", "main"], cwd=REPO_ROOT, check=True)
            merge_result = subprocess.run(
                ["git", "merge", "--no-ff", branch, "-m",
                 f"operator({session_type}): {session_doc['summary'][:80]}"],
                cwd=REPO_ROOT, capture_output=True, text=True,
            )

            if merge_result.returncode == 0:
                # Get commit hash
                hash_result = subprocess.run(
                    ["git", "rev-parse", "HEAD"],
                    cwd=REPO_ROOT, capture_output=True, text=True,
                )
                session_doc["merged"] = True
                session_doc["commitHash"] = hash_result.stdout.strip()

                # Rebuild service
                subprocess.run(
                    ["sudo", "docker", "compose", "up", "-d", "--build"],
                    cwd=REPO_ROOT, capture_output=True,
                    timeout=300,
                )
                logger.info(f"Operator session merged: {session_doc['commitHash']}")
            else:
                logger.error(f"Merge failed: {merge_result.stderr}")
                _discard_branch(branch)
        else:
            logger.warning(f"Tests failed, discarding branch: {test_result.stdout}")
            session_doc["summary"] += f"\nTests failed: {test_result.stdout[:500]}"
            _discard_branch(branch)

    except subprocess.TimeoutExpired:
        logger.error("Operator session timed out")
        session_doc["summary"] = "Session timed out"
        _discard_branch(branch)

    except Exception as e:
        logger.error(f"Operator session failed: {e}")
        session_doc["summary"] = f"Error: {e}"
        _discard_branch(branch)

    session_doc["completedAt"] = datetime.now(timezone.utc)
    await db.operator_sessions.insert_one(session_doc)
    return session_doc


def _discard_branch(branch: str):
    """Switch back to main and delete the branch."""
    try:
        subprocess.run(["git", "checkout", "main"], cwd=REPO_ROOT, capture_output=True)
        subprocess.run(["git", "branch", "-D", branch], cwd=REPO_ROOT, capture_output=True)
    except Exception as e:
        logger.error(f"Failed to discard branch {branch}: {e}")


def _build_prompt(session_type: str, state: dict) -> str:
    """Build the Claude Code prompt for a session."""
    import json

    # Try to load template
    template_path = PROMPTS_DIR / f"{session_type}.md"
    template = ""
    if template_path.exists():
        template = template_path.read_text()

    state_json = json.dumps(_sanitize_state(state), indent=2, default=str)

    base_prompt = f"""You are the autonomous operator of Riigikogu Radar.

Read SOUL.md for your philosophy. You never modify SOUL.md or SPECS.md.

Current system state:
{state_json}

Rules:
- One problem per session. Do not scope-creep.
- Never modify SOUL.md, SPECS.md, or .env
- Always run tests before committing
- Write commit messages that explain WHY, not just WHAT
- If uncertain, don't implement — just log your analysis
- Maximum {settings.operator_max_files_per_session} files changed per session
- Small, targeted changes. The minimum that addresses the issue.
"""

    if template:
        base_prompt += f"\n## Session Goal: {session_type}\n\n{template}"
    else:
        type_instructions = {
            "improvement": "Accuracy has dropped. Read error categories and weakest areas. Implement the single highest-impact fix.",
            "investigation": "A new error pattern appeared. Read examples. Determine root cause. Fix directly or add to improvement priorities.",
            "feature_engineering": "Features are stagnant. Design and implement one new feature targeting the most common error type.",
            "bug_fix": "A task is failing persistently. Read the error logs. Fix the bug. Add a regression test.",
            "review": "Weekly review. Check accuracy trends, session history, feature importances. Write summary to model_state.planHistory.",
        }
        base_prompt += f"\n## Session Goal\n\n{type_instructions.get(session_type, 'Review and improve.')}"

    return base_prompt


def _sanitize_state(state: dict) -> dict:
    """Remove large fields from state for prompt/storage."""
    sanitized = {}
    for key, value in state.items():
        if key == "_id":
            continue
        if key in ("trend", "planHistory") and isinstance(value, list):
            sanitized[key] = value[-5:]  # Last 5 entries only
        elif key == "accuracy" and isinstance(value, dict):
            # Include accuracy but limit byMP
            acc = dict(value)
            if "byMP" in acc and isinstance(acc["byMP"], list):
                acc["byMP"] = acc["byMP"][:10]  # Worst 10 only
            sanitized[key] = acc
        else:
            sanitized[key] = value
    return sanitized
