from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongodb_uri: str
    anthropic_api_key: str
    voyage_api_key: str
    openai_api_key: str = ""
    google_ai_api_key: str = ""

    riigikogu_api_base: str = "https://api.riigikogu.ee/api"
    riigikogu_rate_limit_ms: int = 500

    sync_interval_hours: int = 6
    backtest_interval_days: int = 7
    retrain_interval_days: int = 14

    prediction_cache_ttl_days: int = 7
    stenogram_max_bytes: int = 10240  # 10KB per speaker
    db_size_limit_mb: int = 480  # Pause sync near this

    model_cutoff_date: str = "2025-05-01"  # Evaluation boundary

    # Operator (Claude Code self-improvement sessions)
    operator_enabled: bool = True
    operator_max_files_per_session: int = 5
    operator_session_timeout_seconds: int = 600
    operator_accuracy_drop_threshold: float = 0.02
    operator_error_count_threshold: int = 5

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
