"""AccessForge's pure, modeled-accessibility engine inputs and graphs."""

from .contract import (
    Barrier,
    Destination,
    Edge,
    Explanation,
    SolveResult,
    Node,
    Origin,
    ProblemInstance,
    Profile,
    Repair,
    SolveParams,
)
from .evaluation import Accessibility, EvaluationMetrics, evaluate
from .graph import build_graph
from .optimization import solve
from .validation import InvalidInstanceError

__all__ = [
    "Explanation",
    "SolveResult",
    "solve",
    "Accessibility",
    "EvaluationMetrics",
    "evaluate",
    "Barrier",
    "Destination",
    "Edge",
    "InvalidInstanceError",
    "Node",
    "Origin",
    "ProblemInstance",
    "Profile",
    "Repair",
    "SolveParams",
    "build_graph",
]
