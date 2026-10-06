"""Benchmark service for centralized vs blockchain comparison."""

import statistics
import time
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.models import BenchmarkResult
from backend.orchestrator.workflow import run_workflow
from backend.storage.base import StorageProvider


async def run_benchmark(
    db: AsyncSession,
    storage: StorageProvider | None = None,
    coordination_mode: str | None = None,
    num_agents_list: list[int] | None = None,
    tasks_per_config: int = 3,
    name: str | None = None,
) -> list[dict]:
    """Run benchmarks across agent counts and coordination modes."""
    if num_agents_list is None:
        num_agents_list = [1, 2, 4]

    modes = [coordination_mode] if coordination_mode else ["centralized", "blockchain"]
    results = []

    for mode in modes:
        for num_agents in num_agents_list:
            latencies = []
            agent_latencies = []
            blockchain_latencies = []
            verification_latencies = []
            completed = 0
            failed = 0
            start_time = time.time()

            for i in range(tasks_per_config):
                task_data = {
                    "title": f"Benchmark Task {i+1}",
                    "description": "Analyze patient with fever, elevated WBC, and diabetes. Determine likely diagnosis and recommend treatment.",
                    "domain": "healthcare",
                    "patient_context": {"temperature": 38.5, "diabetic": True},
                    "required_agents": _select_agents_for_count(num_agents),
                }
                task_id = str(uuid.uuid4())

                run_start = time.time()
                try:
                    result = await run_workflow(
                        task_id=task_id,
                        task_data=task_data,
                        mode=mode,
                        storage=storage,
                        db=db,
                    )
                    latencies.append(result.total_latency_ms)
                    agent_latencies.append(result.agent_latency_ms)
                    blockchain_latencies.append(result.blockchain_latency_ms)
                    verification_latencies.append(result.verification_latency_ms)
                    completed += 1
                except Exception:
                    failed += 1

            total_time = time.time() - start_time

            # Save benchmark result
            bench = BenchmarkResult(
                id=uuid.uuid4(),
                name=name or f"benchmark-{mode}-{num_agents}agents",
                coordination_mode=mode,
                num_agents=num_agents,
                total_tasks=tasks_per_config,
                completed_tasks=completed,
                failed_tasks=failed,
                avg_latency_ms=statistics.mean(latencies) if latencies else None,
                min_latency_ms=min(latencies) if latencies else None,
                max_latency_ms=max(latencies) if latencies else None,
                p50_latency_ms=statistics.median(latencies) if latencies else None,
                p95_latency_ms=_percentile(latencies, 95) if latencies else None,
                p99_latency_ms=_percentile(latencies, 99) if latencies else None,
                throughput_tasks_per_min=(completed / total_time * 60) if total_time > 0 else None,
                avg_agent_latency_ms=statistics.mean(agent_latencies) if agent_latencies else None,
                avg_blockchain_latency_ms=statistics.mean(blockchain_latencies) if blockchain_latencies else None,
                avg_verification_latency_ms=statistics.mean(verification_latencies) if verification_latencies else None,
                started_at=datetime.fromtimestamp(start_time, tz=timezone.utc),
                completed_at=datetime.now(timezone.utc),
            )
            db.add(bench)
            await db.flush()
            results.append(_bench_to_dict(bench))

    await db.flush()
    return results


def _select_agents_for_count(n: int) -> list[str]:
    all_agents = ["clinical_reasoning", "history", "laboratory", "medication", "risk", "evidence"]
    return all_agents[:n] + ["verifier", "synthesizer"]


def _percentile(data: list[float], p: int) -> float:
    if not data:
        return 0.0
    sorted_data = sorted(data)
    k = (len(sorted_data) - 1) * p / 100
    f = int(k)
    c = f + 1
    if c >= len(sorted_data):
        return sorted_data[-1]
    d = k - f
    return sorted_data[f] + d * (sorted_data[c] - sorted_data[f])


def _bench_to_dict(bench: BenchmarkResult) -> dict:
    return {
        "id": str(bench.id),
        "name": bench.name,
        "coordination_mode": bench.coordination_mode,
        "num_agents": bench.num_agents,
        "total_tasks": bench.total_tasks,
        "completed_tasks": bench.completed_tasks,
        "failed_tasks": bench.failed_tasks,
        "avg_latency_ms": bench.avg_latency_ms,
        "min_latency_ms": bench.min_latency_ms,
        "max_latency_ms": bench.max_latency_ms,
        "p50_latency_ms": bench.p50_latency_ms,
        "p95_latency_ms": bench.p95_latency_ms,
        "p99_latency_ms": bench.p99_latency_ms,
        "throughput_tasks_per_min": bench.throughput_tasks_per_min,
    }
