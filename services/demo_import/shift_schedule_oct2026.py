"""Move only the 248 legacy demo duty shifts to October/November 2026.

This intentionally leaves historical appointments, medical records, birthdays,
account timestamps and immutable historical_records unchanged.
"""

import argparse
import asyncio
import os
from datetime import date

import aiomysql

from demo_import.import_history import connection_settings


SOURCE_START = date(2026, 6, 1)
SOURCE_END = date(2026, 7, 1)
TARGET_START = date(2026, 10, 1)
TARGET_END = date(2026, 11, 1)
EXPECTED_ROWS = 248


async def shift(*, apply: bool) -> None:
    settings = connection_settings("scheduling")
    if os.getenv("DB_NAME") == "scheduling_db":
        settings.update(
            host=os.environ["DB_HOST"], port=int(os.getenv("DB_PORT", "3306")),
            user=os.environ["DB_USER"], password=os.environ["DB_PASSWORD"],
        )
    connection = await aiomysql.connect(**settings)
    try:
        async with connection.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(
                "SELECT COUNT(*) AS total, MIN(duty_date) AS first_day, "
                "MAX(duty_date) AS last_day FROM doctor_schedules"
            )
            all_schedules = await cursor.fetchone()
            if (all_schedules["total"] == EXPECTED_ROWS
                    and all_schedules["first_day"] == TARGET_START
                    and all_schedules["last_day"] == TARGET_END):
                print("All 248 demo shifts are already in 2026-10-01..2026-11-01; no data changed")
                return
            if (all_schedules["total"] != EXPECTED_ROWS
                    or all_schedules["first_day"] != SOURCE_START
                    or all_schedules["last_day"] != SOURCE_END):
                raise RuntimeError("Schedule set differs from the 248-row demo snapshot; no change made")

            for table in ("slot_inventory", "slot_holds"):
                await cursor.execute(f"SELECT COUNT(*) AS total FROM {table}")
                if (await cursor.fetchone())["total"]:
                    raise RuntimeError(f"{table} is not empty; no change made")

            await cursor.execute(
                "SELECT COUNT(*) AS total FROM doctor_schedules "
                "WHERE duty_date BETWEEN %s AND %s", (TARGET_START, TARGET_END),
            )
            if (await cursor.fetchone())["total"]:
                raise RuntimeError("Target date range already contains shifts; no change made")
            if not apply:
                print("Dry run: 248 demo shifts can move from 2026-06-01..2026-07-01 "
                      "to 2026-10-01..2026-11-01; no data changed")
                return

            await cursor.execute(
                "UPDATE doctor_schedules SET duty_date = DATE_ADD(duty_date, INTERVAL 4 MONTH) "
                "WHERE duty_date BETWEEN %s AND %s", (SOURCE_START, SOURCE_END),
            )
            if cursor.rowcount != EXPECTED_ROWS:
                raise RuntimeError("Unexpected number of updated shifts; transaction rolled back")
            await cursor.execute(
                "SELECT COUNT(*) AS total, MIN(duty_date) AS first_day, "
                "MAX(duty_date) AS last_day FROM doctor_schedules"
            )
            result = await cursor.fetchone()
            if (result["total"] != EXPECTED_ROWS
                    or result["first_day"] != TARGET_START
                    or result["last_day"] != TARGET_END):
                raise RuntimeError("Post-update verification failed; transaction rolled back")
        await connection.commit()
        print("Updated 248 demo shifts to 2026-10-01..2026-11-01")
    except Exception:
        await connection.rollback()
        raise
    finally:
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Commit the date change")
    arguments = parser.parse_args()
    asyncio.run(shift(apply=arguments.apply))


if __name__ == "__main__":
    main()
