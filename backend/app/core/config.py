import os
from typing import List, Union
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator


class Settings(BaseSettings):
    PROJECT_NAME: str = "ReelFinder AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    DEBUG: bool = Field(default=True, env="DEBUG")
    
    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    def get_cors_origins(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        if isinstance(self.CORS_ORIGINS, str):
            v = self.CORS_ORIGINS.strip()
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [x.strip() for x in v.split(",") if x.strip()]
        return ["*"]
    
    # Database
    DATABASE_URL: str = Field(
        default="sqlite:///./data/promofinder.db",
        env="DATABASE_URL"
    )
    
    # AI / LLM Configuration
    GROQ_API_KEY: str = Field(default="", env="GROQ_API_KEY")
    GROQ_MODEL: str = Field(default="openai/gpt-oss-120b", env="GROQ_MODEL")
    GEMINI_API_KEY: str = Field(default="", env="GEMINI_API_KEY")
    GEMINI_MODEL: str = Field(default="gemini-3.8-flash", env="GEMINI_MODEL")
    USE_MOCK_LLM: bool = Field(default=False, env="USE_MOCK_LLM")
    
    # Storage & File Upload
    UPLOAD_DIR: str = Field(default="./uploads", env="UPLOAD_DIR")
    MAX_UPLOAD_SIZE_MB: int = Field(default=50, env="MAX_UPLOAD_SIZE_MB")
    
    # Promo Validation Rules
    MIN_PROMO_DURATION: float = Field(default=20.0, description="Minimum duration in seconds")
    MAX_PROMO_DURATION: float = Field(default=60.0, description="Maximum duration in seconds")
    HOOK_WINDOW_SECONDS: float = Field(default=3.0, description="Opening hook must occur within first 3s")
    
    # Scoring Weights (Total = 1.0)
    WEIGHT_HOOK: float = 0.25
    WEIGHT_CLIFFHANGER: float = 0.25
    WEIGHT_STANDALONE: float = 0.20
    WEIGHT_EMOTIONAL_IMPACT: float = 0.15
    WEIGHT_NARRATIVE_CONTINUITY: float = 0.15

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
