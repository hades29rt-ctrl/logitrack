from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://logitrack_user:logitrack_2024!@localhost:5432/logitrack"
    secret_key: str = "logitrack-secret-key-2024"
    app_port: int = 8000
    debug: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
