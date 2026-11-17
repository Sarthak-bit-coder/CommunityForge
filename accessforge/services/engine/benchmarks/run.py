"""Persist reproducible synthetic experiment inputs, environment, and every result."""

import argparse
from dataclasses import asdict, replace
import json
import os
from pathlib import Path
import platform
from collections import Counter

import networkx as nx

from accessforge_engine.benchmark import (
    BenchmarkRow,
    DEFAULT_METHODS,
    benchmark_network,
    run_sweep,
)
from accessforge_engine.validation import unique
from accessforge_engine.optimization import ENGINE_VERSION
from accessforge_engine.synthetic import SyntheticConfig, complementarity_case


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", choices=("grid", "complementarity"), default="grid")
    parser.add_argument("--width", type=int, default=3)
    parser.add_argument("--height", type=int, default=3)
    parser.add_argument("--barriers", type=int, default=6)
    parser.add_argument("--cost-min", type=int, default=10)
    parser.add_argument("--cost-max", type=int, default=30)
    parser.add_argument("--edge-length-m", type=float, default=25)
    parser.add_argument("--threshold-m", type=float, default=150)
    parser.add_argument("--clusterings", type=float, nargs="+", default=[0, 1])
    parser.add_argument("--seeds", type=int, nargs="+", default=[0, 1, 2, 3, 4])
    parser.add_argument(
        "--budgets", type=float, nargs="+", default=[0.05, 0.1, 0.2, 0.5]
    )
    parser.add_argument(
        "--methods", nargs="+", choices=DEFAULT_METHODS, default=list(DEFAULT_METHODS)
    )
    parser.add_argument("--time-limit-s", type=float, default=30)
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="new JSON file; existing evidence is never overwritten",
    )
    args = parser.parse_args()
    if args.output.exists():
        parser.error("output already exists; choose a new file")
    return args


def write_artifact(
    args: argparse.Namespace,
    configs: list[dict[str, object]],
    rows: list[BenchmarkRow],
    shared: dict[str, object],
) -> None:
    artifact = {
        "schema_version": 1,
        "synthetic": True,
        "engine_version": ENGINE_VERSION,
        "environment": {
            "python": platform.python_version(),
            "networkx": nx.__version__,
            "platform": platform.platform(),
            "machine": platform.machine(),
            "processor": platform.processor(),
            "logical_cpus": os.cpu_count(),
        },
        "protocol": {"case": args.case, "configs": configs, **shared},
        "rows": [row.to_dict() for row in rows],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x") as output:
        json.dump(artifact, output, indent=2, allow_nan=False)
        output.write("\n")
    print(
        json.dumps(
            {
                "output": str(args.output),
                "rows": len(rows),
                "statuses": dict(Counter(row.status for row in rows)),
            }
        )
    )


def main() -> None:
    args = parse_args()
    unique(tuple(args.clusterings), "clusterings")
    unique(tuple(args.seeds), "seeds")
    rows: list[BenchmarkRow] = []
    configs: list[dict[str, object]] = []
    shared = {
        "seeds": tuple(args.seeds),
        "budget_fractions": tuple(args.budgets),
        "methods": tuple(args.methods),
        "time_limit_s": args.time_limit_s,
    }
    if args.case == "grid":
        base = SyntheticConfig(
            args.width,
            args.height,
            args.barriers,
            args.cost_min,
            args.cost_max,
            edge_length_m=args.edge_length_m,
            threshold_m=args.threshold_m,
        )
        for clustering in args.clusterings:
            config = replace(base, clustering=clustering)
            configs.append(asdict(config))
            rows.extend(run_sweep(config, **shared))
    else:
        for seed in args.seeds:
            rows.extend(
                benchmark_network(
                    complementarity_case(),
                    case="complementarity",
                    seed=seed,
                    budget_fractions=tuple(args.budgets),
                    methods=tuple(args.methods),
                    time_limit_s=args.time_limit_s,
                )
            )
    write_artifact(args, configs, rows, shared)


if __name__ == "__main__":
    main()
