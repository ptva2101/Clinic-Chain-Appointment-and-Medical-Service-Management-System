"""Small local read-only QoS smoke test for all seven services.

This is not a capacity benchmark or a substitute for authenticated booking load.
"""

import argparse
import asyncio
import statistics
import time

import httpx


SERVICES = {
    "identity": 8001,
    "registry": 8002,
    "scheduling": 8003,
    "appointment": 8004,
    "billing": 8005,
    "clinical": 8006,
    "laboratory": 8007,
}


async def sample(client: httpx.AsyncClient, semaphore: asyncio.Semaphore, url: str) -> tuple[float, bool]:
    async with semaphore:
        started = time.perf_counter()
        try:
            response = await client.get(url)
            return (time.perf_counter() - started) * 1000, response.status_code == 200
        except httpx.RequestError:
            return (time.perf_counter() - started) * 1000, False


async def run(requests: int, concurrency: int, host: str) -> int:
    failures = 0
    semaphore = asyncio.Semaphore(concurrency)
    async with httpx.AsyncClient(timeout=5.0) as client:
        for name, port in SERVICES.items():
            url = f"http://{host}:{port}/ready"
            results = await asyncio.gather(*[
                sample(client, semaphore, url) for _ in range(requests)
            ])
            latencies = sorted(duration for duration, _ in results)
            errors = sum(not ok for _, ok in results)
            failures += errors
            p95_index = max(0, int(0.95 * len(latencies) + 0.999999) - 1)
            p95 = latencies[p95_index]
            print(f"{name:12} requests={requests:3} errors={errors:2} "
                  f"p50={statistics.median(latencies):7.1f}ms p95={p95:7.1f}ms")
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--requests", type=int, default=30)
    parser.add_argument("--concurrency", type=int, default=5)
    parser.add_argument("--host", default="127.0.0.1")
    arguments = parser.parse_args()
    if arguments.requests < 1 or arguments.concurrency < 1 or arguments.requests > 1000:
        parser.error("requests must be 1..1000 and concurrency must be positive")
    return asyncio.run(run(arguments.requests, arguments.concurrency, arguments.host))


if __name__ == "__main__":
    raise SystemExit(main())
