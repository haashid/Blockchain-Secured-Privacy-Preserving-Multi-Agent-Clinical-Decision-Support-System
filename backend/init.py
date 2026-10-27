import asyncio
import os
import sys

_root = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend.core.database import init_db, async_session_factory
from backend.services.auth import get_or_create_default_admin
from backend.services.agent import seed_agents

async def run():
    print("Initializing DB...")
    await init_db()
    print("DB Initialized. Seeding...")
    async with async_session_factory() as db:
        await get_or_create_default_admin(db)
        await seed_agents(db)
        await db.commit()
    print("Seeding OK.")

if __name__ == "__main__":
    asyncio.run(run())
