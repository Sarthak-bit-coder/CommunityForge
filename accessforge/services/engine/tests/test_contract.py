from dataclasses import FrozenInstanceError, replace
from math import inf, nan

import pytest

from accessforge_engine import (
    Barrier,
    Destination,
    Edge,
    InvalidInstanceError,
    Node,
    Origin,
    ProblemInstance,
    Profile,
    Repair,
    SolveParams,
)


def profile() -> Profile:
    return Profile("wheelchair", 1, 0.08, frozenset({"step"}), {"rough": 2}, 500)


def instance() -> ProblemInstance:
    return ProblemInstance(
        (Edge("ab", "a", "b", 10, {"incline": 0.04}),),
        (Barrier("barrier", "ab", None, "step", 3, 1),),
        (Repair("repair", ("barrier",), 5, 4, 6),),
        (profile(),),
        (Origin("home", "a", 10, "tract"),),
        (Destination("clinic", "b", "health", 1),),
        (Node("a"), Node("b"), Node("isolated")),
    )


def test_contract_positional_fields_and_zero_budget() -> None:
    data = instance()
    params = SolveParams(0, "B0", 1, 0, None, 1)
    assert data.repairs[0].cost == 5
    assert params.budget == 0


@pytest.mark.parametrize("value", [-1, inf, -inf, nan, True, "10"])
def test_invalid_edge_length_fails(value: float) -> None:
    with pytest.raises(InvalidInstanceError, match="edge.length_m"):
        Edge("ab", "a", "b", value, {})


@pytest.mark.parametrize("value", [-0.1, 1.1, inf, nan])
def test_invalid_presence_probability_fails(value: float) -> None:
    with pytest.raises(InvalidInstanceError, match="presence_prob"):
        Barrier("b", "ab", None, "step", 1, value)


@pytest.mark.parametrize("severity", [0, 6, 1.5, True])
def test_invalid_severity_fails(severity: int) -> None:
    with pytest.raises(InvalidInstanceError, match="severity"):
        Barrier("b", "ab", None, "step", severity, 1)


@pytest.mark.parametrize("edge_id,node_id", [(None, None), ("ab", "a")])
def test_barrier_requires_one_location(
    edge_id: str | None, node_id: str | None
) -> None:
    with pytest.raises(InvalidInstanceError, match="exactly one"):
        Barrier("b", edge_id, node_id, "step", 1, 1)


def test_inputs_are_deeply_snapshotted() -> None:
    attrs: dict[str, float | str] = {"incline": 0.04}
    penalties = {"rough": 2.0}
    edge = Edge("ab", "a", "b", 10, attrs)
    person = replace(profile(), penalties=penalties)
    attrs["incline"] = 1
    penalties["rough"] = 100
    assert edge.attrs["incline"] == 0.04
    assert person.penalties["rough"] == 2
    with pytest.raises(TypeError):
        edge.attrs["incline"] = 1  # type: ignore[index]
    with pytest.raises(FrozenInstanceError):
        edge.id = "changed"  # type: ignore[misc]


@pytest.mark.parametrize(
    "field",
    ["nodes", "edges", "barriers", "repairs", "profiles", "origins", "destinations"],
)
def test_duplicate_ids_fail(field: str) -> None:
    data = instance()
    values = getattr(data, field)
    with pytest.raises(InvalidInstanceError, match="duplicate"):
        replace(data, **{field: values + values})


@pytest.mark.parametrize(
    "field,values",
    [
        ("edges", (Edge("x", "missing", "b", 1, {}),)),
        ("barriers", (Barrier("x", "missing", None, "step", 1, 1),)),
        ("barriers", (Barrier("x", None, "missing", "step", 1, 1),)),
        ("repairs", (Repair("x", ("missing",), 0, 0, 0),)),
        ("origins", (Origin("x", "missing", 1, "tract"),)),
        ("destinations", (Destination("x", "missing", "clinic", 1),)),
    ],
)
def test_dangling_references_fail(field: str, values: tuple[object, ...]) -> None:
    with pytest.raises(InvalidInstanceError, match="dangling"):
        replace(instance(), **{field: values})


@pytest.mark.parametrize(
    "changes",
    [
        {"budget": -1},
        {"budget": nan},
        {"n_scenarios": 0},
        {"n_scenarios": True},
        {"seed": -1},
        {"seed": 1.5},
        {"time_limit_s": 0},
        {"time_limit_s": inf},
        {"method": ""},
        {"equity": {}},
    ],
)
def test_invalid_solve_parameters_fail(changes: dict[str, object]) -> None:
    with pytest.raises(InvalidInstanceError):
        replace(SolveParams(10, "B0", 1, 0, None, 1), **changes)


def test_invalid_costs_penalties_and_profiles_fail() -> None:
    with pytest.raises(InvalidInstanceError, match="cost_low"):
        Repair("r", (), 3, 4, 5)
    with pytest.raises(InvalidInstanceError, match="duplicate"):
        Repair("r", ("b", "b"), 0, 0, 0)
    with pytest.raises(InvalidInstanceError, match="penalty"):
        replace(profile(), penalties={"rough": -1})
    with pytest.raises(InvalidInstanceError, match="positive total"):
        replace(instance(), profiles=(replace(profile(), weight=0),))
    with pytest.raises(InvalidInstanceError, match="positive total"):
        replace(instance(), profiles=())
    with pytest.raises(InvalidInstanceError, match="Node"):
        replace(instance(), nodes=("a",))  # type: ignore[arg-type]


@pytest.mark.parametrize("attrs", [{"incline": "8%"}, {"x": nan}, {"": "value"}])
def test_invalid_edge_attributes_fail(attrs: dict[str, float | str]) -> None:
    with pytest.raises(InvalidInstanceError):
        Edge("ab", "a", "b", 1, attrs)


def test_empty_ids_fail() -> None:
    with pytest.raises(InvalidInstanceError, match="nonempty"):
        Node(" ")


def test_scalar_barrier_type_cannot_silently_make_blocked_routes_passable() -> None:
    with pytest.raises(InvalidInstanceError, match="impassable_types"):
        replace(profile(), impassable_types="step")  # type: ignore[arg-type]


def test_scalar_repair_target_cannot_split_into_unrelated_barrier_ids() -> None:
    with pytest.raises(InvalidInstanceError, match="barrier_ids"):
        Repair("repair", "ab", 1, 1, 1)  # type: ignore[arg-type]
