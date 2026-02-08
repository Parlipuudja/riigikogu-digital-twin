from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongodb_uri: str
    voyage_api_key: str = ""

    riigikogu_api_base: str = "https://api.riigikogu.ee/api"
    riigikogu_rate_limit_ms: int = 500

    sync_interval_hours: int = 6

    prediction_cache_ttl_days: int = 7
    stenogram_max_bytes: int = 10240  # 10KB per speaker
    db_size_limit_mb: int = 480  # Pause sync near this

    model_cutoff_date: str = "2025-05-01"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
