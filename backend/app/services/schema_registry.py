from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List

from pymongo.errors import DuplicateKeyError

from app.db import get_db

logger = logging.getLogger(__name__)


async def register_fact_types(types: List[str], example_fact_id: str | None = None) -> None:
    if not types:
        return

    db = get_db()
    now = datetime.now(timezone.utc)
    
    unique_types = set(t.lower() for t in types)

    for type_name in unique_types:
        try:
            update_data = {
                "$setOnInsert": {
                    "type_name": type_name,
                    "description": f"Automatically extracted fact type: {type_name}",
                    "first_seen_at": now,
                }
            }
            if example_fact_id:
                update_data["$addToSet"] = {"example_fact_ids": example_fact_id}

            await db.fact_types.update_one(
                {"type_name": type_name},
                update_data,
                upsert=True
            )
        except Exception as e:
            logger.error("Error registering fact type '%s': %s", type_name, e)
