from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

DATABASE_URL = "postgresql+asyncpg://logitrack_user:logitrack_2024!@localhost:5432/logitrack"

engine = create_async_engine(
    DATABASE_URL,
    echo=True,
    poolclass=NullPool
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSession(engine, expire_on_commit=False) as session:
        yield session
