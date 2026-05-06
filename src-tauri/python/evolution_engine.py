import json
import math
import random
from itertools import combinations
from copy import deepcopy

try:
    from deap import base, creator, tools, algorithms
except Exception:
    # If DEAP is not available, provide a clear error at runtime
    base = creator = tools = algorithms = None


EVOLUTION_PROGRESS = {
    "generation": 0,
    "best_fitness": 0.0,
    "total_generations": 0,
    "message": "等待开始",
}


def get_progress_snapshot():
    return dict(EVOLUTION_PROGRESS)


def _safe_float(value, default=0.0):
    try:
        if value is None:
            return float(default)
        return float(value)
    except Exception:
        return float(default)


def _extract_height(student, default=0.0):
    if not isinstance(student, dict):
        return float(default)

    factors = student.get("factors", {})
    if isinstance(factors, dict):
        for key in ("height", "身高", "student_height", "stature"):
            if key in factors:
                return _safe_float(factors.get(key), default)

    for key in ("height", "身高", "student_height", "stature"):
        if key in student:
            return _safe_float(student.get(key), default)

    return float(default)


def _extract_metric(student, keys, default=0.0):
    if not isinstance(student, dict):
        return float(default)

    factors = student.get("factors", {})
    if isinstance(factors, dict):
        for key in keys:
            if key in factors:
                return _safe_float(factors.get(key), default)

    for key in keys:
        if key in student:
            return _safe_float(student.get(key), default)

    return float(default)


def _extract_score(student, default=0.5):
    return _extract_metric(student, ("score", "grade", "成绩", "performance", "score_value"), default)


def _find_reward_config(conditions):
    if not isinstance(conditions, list):
        return {}
    for item in conditions:
        if isinstance(item, dict) and item.get("_isRewardConfig"):
            return item
    return {}


def _build_seat_positions(total_seats, rows=None, cols=None):
    total_seats = max(1, int(total_seats or 1))
    if rows is None or cols is None:
        cols = max(1, int(math.ceil(math.sqrt(total_seats))))
        rows = max(1, int(math.ceil(total_seats / cols)))
    else:
        rows = max(1, int(rows))
        cols = max(1, int(cols))

    positions = []
    for r in range(rows):
        for c in range(cols):
            positions.append((r, c))

    if len(positions) < total_seats:
        extra = total_seats - len(positions)
        for i in range(extra):
            positions.append((rows + (i // cols), i % cols))

    return positions[:total_seats], rows, cols


def _spread_score(occupied_positions):
    if len(occupied_positions) <= 1:
        return 0.0

    total = 0.0
    count = 0
    for (r1, c1), (r2, c2) in combinations(occupied_positions, 2):
        total += abs(r1 - r2) + abs(c1 - c2)
        count += 1
    return total / max(1, count)


def _balance_score(occupied_positions, rows, cols):
    if not occupied_positions:
        return 0.0

    row_counts = [0] * rows
    col_counts = [0] * cols
    for r, c in occupied_positions:
        if 0 <= r < rows:
            row_counts[r] += 1
        if 0 <= c < cols:
            col_counts[c] += 1

    # Smaller variance means more even distribution.
    mean_rows = sum(row_counts) / float(rows)
    mean_cols = sum(col_counts) / float(cols)
    row_var = sum((x - mean_rows) ** 2 for x in row_counts) / float(rows)
    col_var = sum((x - mean_cols) ** 2 for x in col_counts) / float(cols)
    return -float(row_var + col_var)


def _repair_height_constraint(individual, student_heights, seat_positions):
    """Hard constraint: taller students should not be placed in front of shorter students.

    We model the front row as smaller row index and the back row as larger row index.
    The repair step sorts students by height descending and assigns them to seats from back to front.
    """
    if not individual:
        return individual

    seat_count = len(individual)
    # 获取所有已分配的学生ID（非空位）
    ranked_students = [sid for sid in individual if isinstance(sid, int) and sid >= 0]
    ranked_students = list(dict.fromkeys(ranked_students))

    # Add missing students to avoid dropping anyone.
    for sid in range(len(student_heights)):
        if sid not in ranked_students:
            ranked_students.append(sid)

    ranked_students.sort(key=lambda sid: (-student_heights[sid], sid))

    # Seats sorted from back row to front row, then left-to-right.
    seat_order = sorted(
        range(seat_count),
        key=lambda idx: (seat_positions[idx][0], seat_positions[idx][1]),
        reverse=True,
    )

    repaired = [-1] * seat_count
    for pos_idx, sid in zip(seat_order, ranked_students):
        repaired[pos_idx] = sid

    # Remaining seats stay empty.
    individual[:] = repaired
    return individual


def run_evolution(payload_json: str, progress_callback=None):
    """DEAP-based genetic algorithm entrypoint called from Rust via PyO3.

    - Expects payload to contain `names`, optional `personal_attrs`, and `generations`.
    - Returns dict with `generation`, `best_fitness`, `message`, `seat_order` (dict of seat_id -> student_name).
    """
    payload = json.loads(payload_json or "{}")
    generations = int(payload.get("generations", 120) or 120)
    names = payload.get("names", []) or []
    personal_attrs = payload.get("personal_attrs", []) or []
    seat_layout = payload.get("seat_layout") or {}
    seat_ids = [str(sid) for sid in (payload.get("seat_ids") or []) if str(sid).strip()]
    reward_config = _find_reward_config(payload.get("conditions") or [])
    adjacency_rewards = reward_config.get("adjacencyRewards") or reward_config.get("adjacency_rewards") or {}

    EVOLUTION_PROGRESS["generation"] = 0
    EVOLUTION_PROGRESS["best_fitness"] = 0.0
    EVOLUTION_PROGRESS["total_generations"] = generations
    EVOLUTION_PROGRESS["message"] = "演化准备中"

    if base is None:
        return {
            "generation": 0,
            "best_fitness": 0.0,
            "message": "DEAP 未安装，请先 pip install deap",
            "seat_order": {},
        }

    # Problem size
    n_students = len(names)
    if n_students == 0:
        return {"generation": 0, "best_fitness": 0.0, "message": "无学生数据", "seat_order": {}}

    # population size: allow override from payload, fallback to heuristic
    pop_size = int(payload.get("pop_size") or 0) or max(40, n_students * 8)
    # cap to a reasonable upper bound
    pop_size = max(4, min(pop_size, 2000))

    # seat count and geometry
    total_seats = seat_layout.get("total_seats") or seat_layout.get("totalSeats") or len(seat_ids) or n_students
    total_seats = max(1, int(total_seats))
    rows = seat_layout.get("rows") or seat_layout.get("row_count")
    cols = seat_layout.get("cols") or seat_layout.get("col_count")
    seat_positions, rows, cols = _build_seat_positions(total_seats, rows, cols)
    if len(seat_ids) != total_seats:
        seat_ids = [str(i) for i in range(total_seats)]

    occupied_target = min(n_students, total_seats)
    small_class_ratio = occupied_target / float(total_seats)
    # 人少时更强调均匀分布，人数多时更强调总体适配
    spread_weight = 1.4 if occupied_target <= max(4, total_seats * 0.4) else 0.8
    balance_weight = 1.2 if occupied_target <= max(6, total_seats * 0.5) else 0.7
    utility_weight = 1.0

    # prepare student score function
    def student_score(idx):
        if idx < 0 or idx >= n_students:
            return 0.0
        student = personal_attrs[idx] if idx < len(personal_attrs) else {}
        factors = student.get("factors", {}) if isinstance(student.get("factors"), dict) else {}
        s = 0.0
        for v in factors.values():
            try:
                s += float(v)
            except Exception:
                continue
        # name length tiny bias
        s += min(len(str(names[idx])), 20) * 0.01
        return s

    student_heights = [_extract_height(personal_attrs[i] if i < len(personal_attrs) else {}, 0.0) for i in range(n_students)]
    student_low_visibility = [_extract_metric(personal_attrs[i] if i < len(personal_attrs) else {}, ("mobility", "sensitivity", "visibility"), 0.5) for i in range(n_students)]
    student_scores = [_extract_score(personal_attrs[i] if i < len(personal_attrs) else {}, 0.5) for i in range(n_students)]

    score_gap_deskmate_weight = _safe_float(adjacency_rewards.get("score_gap"), 0.7)
    score_gap_neighbor_weight = _safe_float(adjacency_rewards.get("neighbor_score_gap"), 0.6)

    # seat desirability: front seats have slightly higher value, but not too steep
    seat_weights = []
    for pos_idx, (r, c) in enumerate(seat_positions):
        front_bias = (rows - r) / float(rows)
        center_bias = 1.0 - (abs(c - (cols - 1) / 2.0) / max(1.0, cols / 2.0)) * 0.15
        seat_weights.append(0.75 * front_bias + 0.25 * center_bias)

    # Precompute adjacency pairs (right/left as deskmate, front/back as neighbor)
    position_index_by_rc = {(r, c): idx for idx, (r, c) in enumerate(seat_positions)}
    deskmate_pairs = []
    neighbor_pairs = []
    for idx, (r, c) in enumerate(seat_positions):
        right_idx = position_index_by_rc.get((r, c + 1))
        if right_idx is not None:
            deskmate_pairs.append((idx, right_idx))
        down_idx = position_index_by_rc.get((r + 1, c))
        if down_idx is not None:
            neighbor_pairs.append((idx, down_idx))

    # DEAP setup (creator may already exist in long-running interpreter)
    # Our evaluate returns 3 objectives, ensure fitness weights length matches.
    try:
        creator.create("FitnessMax", base.Fitness, weights=(1.0, 1.0, 1.0))
    except Exception:
        # If class already exists, try to adjust weights in-place if possible.
        try:
            if hasattr(creator, 'FitnessMax') and getattr(creator.FitnessMax, 'weights', None) and len(creator.FitnessMax.weights) != 3:
                creator.FitnessMax.weights = (1.0, 1.0, 1.0)
        except Exception:
            pass
    try:
        creator.create("Individual", list, fitness=creator.FitnessMax)
    except Exception:
        pass

    toolbox = base.Toolbox()

    # Individual: permutation of indices length == total_seats
    # 每个位置可以是学生索引或 -1（空位），允许跳座
    def init_individual():
        # Fill with all students and empty seats, then shuffle.
        seq = list(range(n_students)) + [-1] * max(0, total_seats - n_students)
        random.shuffle(seq)
        return seq[:total_seats]

    toolbox.register("individual", tools.initIterate, creator.Individual, init_individual)
    toolbox.register("population", tools.initRepeat, list, toolbox.individual)

    def evaluate(individual):
        # Hard constraint: height ordering must be respected.
        # If violated, return a strongly dominated fitness.
        occupied = []
        height_violation = 0.0
        for pos_idx, sid in enumerate(individual):
            if not (isinstance(sid, int) and sid >= 0 and sid < n_students):
                continue
            occupied.append((pos_idx, sid))

        # Check all pairs: a taller student cannot be in a more front seat than a shorter one.
        for (pos_a, sid_a), (pos_b, sid_b) in combinations(occupied, 2):
            row_a = seat_positions[pos_a][0]
            row_b = seat_positions[pos_b][0]
            h_a = student_heights[sid_a]
            h_b = student_heights[sid_b]
            if h_a > h_b and row_a < row_b:
                height_violation += (h_a - h_b) * (row_b - row_a + 1)
            elif h_b > h_a and row_b < row_a:
                height_violation += (h_b - h_a) * (row_a - row_b + 1)

        if height_violation > 0:
            penalty = -1e9 - height_violation
            return (penalty, penalty, penalty)

        # Objective 1: utility score of assignment
        utility = 0.0
        occupied_positions = []
        for pos_idx, sid in enumerate(individual):
            if isinstance(sid, int) and sid >= 0 and sid < n_students:
                occupied_positions.append(seat_positions[pos_idx])
                visibility_bonus = 1.0 - 0.15 * student_low_visibility[sid]
                utility += student_score(sid) * seat_weights[pos_idx] * visibility_bonus

        # Objective 2: spread score, favor even distribution when student count is low
        spread = _spread_score(occupied_positions)

        # Objective 3: balance score, lower variance means more evenly spread across rows/columns
        balance = _balance_score(occupied_positions, rows, cols)

        # Smaller classes should prefer a flatter distribution, so increase balance/spread pressure.
        occupancy_factor = 1.0 - min(1.0, small_class_ratio)
        spread_obj = spread * spread_weight * (1.0 + occupancy_factor)
        balance_obj = balance * balance_weight * (1.0 + occupancy_factor)
        def _avg_score_gap(pairs):
            total = 0.0
            count = 0
            for left_idx, right_idx in pairs:
                sid_a = individual[left_idx]
                sid_b = individual[right_idx]
                if not (isinstance(sid_a, int) and 0 <= sid_a < n_students):
                    continue
                if not (isinstance(sid_b, int) and 0 <= sid_b < n_students):
                    continue
                total += abs(student_scores[sid_a] - student_scores[sid_b])
                count += 1
            return total / count if count > 0 else 0.0

        score_gap_bonus = 0.0
        if score_gap_deskmate_weight > 0:
            score_gap_bonus += score_gap_deskmate_weight * _avg_score_gap(deskmate_pairs)
        if score_gap_neighbor_weight > 0:
            score_gap_bonus += score_gap_neighbor_weight * _avg_score_gap(neighbor_pairs)

        utility_obj = (utility * utility_weight) + score_gap_bonus

        return (float(utility_obj), float(spread_obj), float(balance_obj))

    toolbox.register("evaluate", evaluate)
    # allow override of crossover / mutation probabilities
    cxpb = float(payload.get("cxpb", 0.7) or 0.7)
    mutpb = float(payload.get("mutpb", 0.2) or 0.2)

    toolbox.register("mate", tools.cxPartialyMatched)
    toolbox.register("mutate", tools.mutShuffleIndexes, indpb=0.08)
    toolbox.register("clone", deepcopy)

    pop = toolbox.population(n=pop_size)
    hof = tools.ParetoFront()

    # basic stats (optional)
    stats = tools.Statistics(lambda ind: ind.fitness.values)

    def _stats_max(vals):
        if not vals:
            return ()
        return tuple(max(v[i] for v in vals) for i in range(len(vals[0])))

    def _stats_avg(vals):
        if not vals:
            return ()
        return tuple(sum(v[i] for v in vals) / len(vals) for i in range(len(vals[0])))

    stats.register("max", _stats_max)
    stats.register("avg", _stats_avg)

    # run GA
    cxpb = 0.7
    mutpb = 0.2
    ref_points = tools.uniform_reference_points(3, p=max(6, min(12, total_seats)))
    toolbox.register("select", tools.selNSGA3, ref_points=ref_points)

    for gen_idx in range(1, generations + 1):
        # Evaluate invalid individuals
        invalid_ind = [ind for ind in pop if not ind.fitness.valid]
        for ind in invalid_ind:
            ind.fitness.values = toolbox.evaluate(ind)

        # Repair infeasible individuals before selection to keep height as a hard constraint
        for ind in pop:
            _repair_height_constraint(ind, student_heights, seat_positions)
            if ind.fitness.valid:
                del ind.fitness.values

        for ind in pop:
            if not ind.fitness.valid:
                ind.fitness.values = toolbox.evaluate(ind)

        hof.update(pop)

        # NSGA-III selection with variation
        offspring = toolbox.select(pop, len(pop), ref_points=ref_points)
        offspring = list(map(toolbox.clone, offspring))

        for child1, child2 in zip(offspring[::2], offspring[1::2]):
            if random.random() < cxpb:
                toolbox.mate(child1, child2)
                del child1.fitness.values
                del child2.fitness.values

        for mutant in offspring:
            if random.random() < mutpb:
                toolbox.mutate(mutant)
                del mutant.fitness.values

        for ind in offspring:
            _repair_height_constraint(ind, student_heights, seat_positions)

        invalid_offspring = [ind for ind in offspring if not ind.fitness.valid]
        for ind in invalid_offspring:
            ind.fitness.values = toolbox.evaluate(ind)

        pop[:] = offspring

        best_in_gen = None
        best_candidates = [ind for ind in pop if ind.fitness.valid]
        if best_candidates:
            best_in_gen = max(best_candidates, key=lambda ind: ind.fitness.values)

        best_fitness_gen = float(best_in_gen.fitness.values[0]) if best_in_gen else 0.0
        EVOLUTION_PROGRESS["generation"] = gen_idx
        EVOLUTION_PROGRESS["best_fitness"] = float(round(best_fitness_gen, 6))
        EVOLUTION_PROGRESS["message"] = f"Python 演化中：第 {gen_idx}/{generations} 代"

        if progress_callback is not None:
            try:
                progress_callback(gen_idx, EVOLUTION_PROGRESS["best_fitness"], EVOLUTION_PROGRESS["message"])
            except Exception:
                pass

    # best individual
    feasible_candidates = [ind for ind in pop if ind.fitness.valid]
    if feasible_candidates:
        # choose the one with the best first objective, then spread, then balance
        best = max(feasible_candidates, key=lambda ind: ind.fitness.values)
    elif len(hof) > 0:
        best = hof[0]
    else:
        best = tools.selBest(pop, 1)[0]

    if not best.fitness.valid:
        best.fitness.values = evaluate(best)
    best_fitness = float(best.fitness.values[0])

    # 构建座位ID -> 学生姓名的映射
    seat_order = {}
    for pos_idx, sid in enumerate(best):
        if isinstance(sid, int) and 0 <= sid < n_students:
            seat_order[str(seat_ids[pos_idx])] = names[sid]
        # 空位不加入映射（即没有该座位ID的条目）

    EVOLUTION_PROGRESS["generation"] = generations
    EVOLUTION_PROGRESS["best_fitness"] = float(round(best_fitness, 6))
    EVOLUTION_PROGRESS["message"] = "DEAP NSGA-III 遗传算法已完成"

    print(seat_order)
    return {
        "generation": generations,
        "best_fitness": float(round(best_fitness, 6)),
        "message": "DEAP NSGA-III 遗传算法已完成",
        "seat_order": seat_order,
    }
