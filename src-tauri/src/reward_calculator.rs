use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ==================== 输入数据结构 ====================

/// 单个因子值区间奖励规则
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FactorRangeRule {
    pub min: f64,
    pub max: f64,
    pub label: String,
    pub reward: f64,
}

/// 自定义条件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomCondition {
    pub name: String,
    pub reward: f64,
}

/// 奖励配置（来自前端 ConditionSettingsModal）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RewardConfig {
    #[serde(rename = "position_rewards")]
    pub position_rewards: HashMap<String, f64>,

    #[serde(rename = "special_rewards")]
    pub special_rewards: HashMap<String, f64>,

    #[serde(rename = "factor_rewards")]
    pub factor_rewards: HashMap<String, Vec<FactorRangeRule>>,

    #[serde(rename = "adjacency_rewards")]
    pub adjacency_rewards: HashMap<String, f64>,

    #[serde(rename = "custom_conditions")]
    pub custom_conditions: Vec<CustomCondition>,

    /// 新增：单独为每个座位设置的权重
    #[serde(rename = "seat_rewards", default)]
    pub seat_rewards: HashMap<String, f64>,
}

/// 单个学生的个人属性因子
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentInfo {
    pub name: String,
    pub factors: HashMap<String, f64>,
}

/// 座位布局（简化版：仅行列数）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeatLayout {
    #[serde(default)]
    pub rows: Option<u32>,
    #[serde(default)]
    pub cols: Option<u32>,
    #[serde(rename = "total_seats", default)]
    pub total_seats: Option<u32>,
}

/// 可选的行/列位置描述
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeatPos {
    #[serde(default)]
    pub row: Option<u32>,
    #[serde(default)]
    pub col: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultimediaInfo {
    #[serde(default)]
    pub row: Option<u32>,
    #[serde(default)]
    pub col: Option<u32>,
    /// 设备朝向角度（度），可选
    #[serde(default)]
    pub angle: Option<f64>,
}

/// 前端传入的完整请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RewardCalcRequest {
    #[serde(rename = "reward_config")]
    pub reward_config: RewardConfig,

    pub students: Vec<StudentInfo>,

    #[serde(rename = "seat_layout")]
    pub seat_layout: SeatLayout,
    /// 可选：教室中门的位置列表（可部分指定 row/col）
    #[serde(default)]
    pub doors: Vec<SeatPos>,
    /// 可选：多媒体设备位置信息
    #[serde(default)]
    pub multimedia: Vec<MultimediaInfo>,
}

// (SeatPos and MultimediaInfo are defined earlier)

// ==================== 输出数据结构 ====================

/// 单个学生的奖励值详情
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentReward {
    pub name: String,
    #[serde(rename = "position_reward")]
    pub position_reward: f64,
    #[serde(rename = "factor_reward")]
    pub factor_reward: f64,
    #[serde(rename = "adjacency_reward")]
    pub adjacency_reward: f64,
    #[serde(rename = "total_reward")]
    pub total_reward: f64,
}

/// 分类统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryStats {
    #[serde(rename = "位置奖励均值")]
    pub position_avg: f64,
    #[serde(rename = "因子奖励均值")]
    pub factor_avg: f64,
    #[serde(rename = "相邻关系奖励均值")]
    pub adjacency_avg: f64,
}

/// 计算结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RewardCalcResult {
    #[serde(rename = "total_students")]
    pub total_students: usize,
    #[serde(rename = "avg_reward")]
    pub avg_reward: f64,
    #[serde(rename = "total_fitness")]
    pub total_fitness: f64,
    #[serde(rename = "student_rewards")]
    pub student_rewards: Vec<StudentReward>,
    #[serde(rename = "category_stats")]
    pub category_stats: CategoryStats,
}

// ==================== 核心算法 ====================

/// 计算单个学生的位置奖励值
///
/// 根据行列区域 + 特殊位置覆盖来计算。
/// 如果同一行同一列有特殊位置配置，取特殊位置与行列区域的最大值。
fn calc_position_reward(
    position_rewards: &HashMap<String, f64>,
    special_rewards: &HashMap<String, f64>,
    row_idx: u32,
    col_idx: u32,
    total_rows: u32,
    total_cols: u32,
) -> f64 {
    // 将索引映射到区域 key
    let row_key = match row_idx as f64 / total_rows as f64 {
        r if r < 0.2 => "front",
        r if r < 0.4 => "mid_front",
        r if r < 0.6 => "middle",
        r if r < 0.8 => "mid_back",
        _ => "back",
    };

    let col_key = match col_idx as f64 / total_cols as f64 {
        c if c < 0.33 => "left",
        c if c < 0.67 => "center",
        _ => "right",
    };

    let key = format!("{}_{}", row_key, col_key);
    let base_reward = position_rewards.get(&key).copied().unwrap_or(0.5);

    // 检查特殊位置
    let mut special_reward = 0.0_f64;

    // 靠近讲台：第一排
    if row_idx == 0 {
        special_reward = special_rewards
            .get("platform_near")
            .copied()
            .unwrap_or(0.0);
    }

    // 靠窗/靠门/角落：根据行列位置判断
    // 左侧列且第一行或最后一行 = 角落
    if col_idx == 0 && (row_idx == 0 || row_idx == total_rows - 1) {
        let corner = special_rewards.get("corner").copied().unwrap_or(0.0);
        special_reward = special_reward.max(corner);
    }
    // 右侧列且第一行或最后一行 = 角落
    if col_idx == total_cols - 1 && (row_idx == 0 || row_idx == total_rows - 1) {
        let corner = special_rewards.get("corner").copied().unwrap_or(0.0);
        special_reward = special_reward.max(corner);
    }
    // 左侧列 = 靠窗/走廊左侧
    if col_idx == 0 {
        let window = special_rewards.get("window_side").copied().unwrap_or(0.0);
        special_reward = special_reward.max(window);
    }
    // 右侧列 = 靠窗/走廊右侧
    if col_idx == total_cols - 1 {
        let door = special_rewards.get("door_side").copied().unwrap_or(0.0);
        special_reward = special_reward.max(door);
    }

    // 取基础奖励和特殊奖励的最大值
    if special_reward > 0.0 {
        base_reward.max(special_reward)
    } else {
        base_reward
    }
}

// 计算靠近门的额外奖励：距离越近，对行动不便（mobility 低）的学生越友好
fn calc_door_boost(doors: &[SeatPos], row_idx: u32, col_idx: u32, mobility: f64, special_rewards: &HashMap<String, f64>) -> f64 {
    if doors.is_empty() { return 0.0; }
    let mut boost = 0.0_f64;
    for d in doors.iter() {
        if let (Some(dr), Some(dc)) = (d.row, d.col) {
            let dist = ((dr as i32 - row_idx as i32).abs() + (dc as i32 - col_idx as i32).abs()) as f64;
            if dist <= 1.5 {
                let door_weight = special_rewards.get("door_near").copied().unwrap_or(0.6);
                // mobility 越低（靠近0）越需要靠近门 -> use (1 - mobility)
                let factor = (1.0 - mobility).max(0.0).min(1.0);
                boost = boost.max(door_weight * factor);
            }
        }
    }
    boost
}

// 计算多媒体附近奖励：对视听敏感度低的学生（sensitivity 更小）如果位于设备射程内，则提高奖励
fn calc_multimedia_boost(multis: &[MultimediaInfo], row_idx: u32, col_idx: u32, sensitivity: f64, special_rewards: &HashMap<String, f64>) -> f64 {
    if multis.is_empty() { return 0.0; }
    let mut boost = 0.0_f64;
    for m in multis.iter() {
        if let (Some(mr), Some(mc)) = (m.row, m.col) {
            let dr = (mr as i32 - row_idx as i32).abs() as u32;
            let dc = (mc as i32 - col_idx as i32).abs() as u32;
            // 简化：如果在同一行或相邻列，认为角度差小于阈值
            if dr <= 1 && dc <= 2 {
                let mw = special_rewards.get("multimedia_near").copied().unwrap_or(0.5);
                // sensitivity 越低（靠近0）越不敏感 -> 更能接受多媒体角度
                let factor = (1.0 - sensitivity).max(0.0).min(1.0);
                boost = boost.max(mw * factor);
            }
        }
    }
    boost
}

/// 计算单个学生的个人因子奖励值
///
/// 遍历该学生的每个因子，查找配置中对应的值区间，累加奖励。
fn calc_factor_reward(
    factors: &HashMap<String, f64>,
    factor_rules: &HashMap<String, Vec<FactorRangeRule>>,
) -> f64 {
    let mut total = 0.0_f64;
    let mut matched_count = 0_u32;

    for (factor_key, factor_value) in factors.iter() {
        if let Some(ranges) = factor_rules.get(factor_key) {
            for range in ranges.iter() {
                if *factor_value >= range.min && *factor_value <= range.max {
                    total += range.reward;
                    matched_count += 1;
                    break; // 每个因子只匹配第一个区间
                }
            }
        }
    }

    if matched_count > 0 {
        total / matched_count as f64 // 归一化到匹配的区间数
    } else {
        0.5 // 默认值
    }
}

/// 计算相邻关系奖励
///
/// 为简化，此处模拟学生被随机分配到座位上后，计算其与周围人的关系奖励。
/// 在实际遗传算法中，这应当基于实际的座位排列来计算。
///
/// 这里我们简化处理：假设学生被安排在一个网格中，计算每人与左右同桌、
/// 前后邻居的关系奖励。
fn calc_adjacency_reward(
    students: &[StudentInfo],
    adjacency_rewards: &HashMap<String, f64>,
) -> Vec<f64> {
    let n = students.len();
    if n <= 1 {
        return vec![0.0; n];
    }

    // 简化：假设学生按名单顺序排列在网格中（每行 cols 人）
    // 这只是一个展示算法能力的示例，实际遗传算法会传入真实座位排列
    let cols = (n as f64).sqrt().ceil() as usize;
    let rows = (n as f64 / cols as f64).ceil() as usize;

    let mut rewards = vec![0.0_f64; n];

    for i in 0..n {
        let row = i / cols;
        let col = i % cols;

        let mut adjacency_total = 0.0_f64;
        let mut count = 0_u32;

        // === 同桌关系（左右相邻） ===
        // 右侧同桌
        if col + 1 < cols {
            let right_idx = row * cols + (col + 1);
            if right_idx < n {
                adjacency_total += calc_pair_reward(&students[i], &students[right_idx], adjacency_rewards);
                count += 1;
            }
        }
        // 左侧同桌
        if col > 0 {
            let left_idx = row * cols + (col - 1);
            if left_idx < n {
                adjacency_total += calc_pair_reward(&students[i], &students[left_idx], adjacency_rewards);
                count += 1;
            }
        }

        // === 前后排关系（前后相邻） ===
        // 后排
        if row + 1 < rows {
            let back_idx = (row + 1) * cols + col;
            if back_idx < n {
                adjacency_total += calc_pair_reward(&students[i], &students[back_idx], adjacency_rewards);
                count += 1;
            }
        }
        // 前排
        if row > 0 {
            let front_idx = (row - 1) * cols + col;
            if front_idx < n {
                adjacency_total += calc_pair_reward(&students[i], &students[front_idx], adjacency_rewards);
                count += 1;
            }
        }

        rewards[i] = if count > 0 {
            adjacency_total / count as f64
        } else {
            0.0
        };
    }

    rewards
}

/// 计算一对相邻学生的关系奖励
fn calc_pair_reward(
    a: &StudentInfo,
    b: &StudentInfo,
    adjacency_rewards: &HashMap<String, f64>,
) -> f64 {
    let mut total = 0.0_f64;
    let mut count = 0_u32;

    // 获取两人性别（默认男=0）
    let gender_a = a.factors.get("gender").copied().unwrap_or(0.0);
    let gender_b = b.factors.get("gender").copied().unwrap_or(0.0);

    // 获取两人社交活跃度
    let social_a = a.factors.get("social").copied().unwrap_or(0.5);
    let social_b = b.factors.get("social").copied().unwrap_or(0.5);

    // 1. 同桌性别匹配
    if (gender_a - gender_b).abs() < 0.5 {
        // 同性别
        total += adjacency_rewards
            .get("same_gender")
            .copied()
            .unwrap_or(0.7);
    } else {
        // 不同性别
        total += adjacency_rewards
            .get("diff_gender")
            .copied()
            .unwrap_or(0.3);
    }
    count += 1;

    // 2. 同桌社交匹配
    let social_diff = (social_a - social_b).abs();
    if social_diff < 0.3 {
        total += adjacency_rewards
            .get("social_near")
            .copied()
            .unwrap_or(0.8);
    } else {
        total += adjacency_rewards
            .get("social_far")
            .copied()
            .unwrap_or(0.3);
    }
    count += 1;

    // 3. 前后排性别匹配（混合性别的前后排通常更好）
    // 这里复用 deskmate_gender 的判断逻辑
    if (gender_a - gender_b).abs() < 0.5 {
        total += adjacency_rewards
            .get("neighbor_same_gender")
            .copied()
            .unwrap_or(0.6);
    } else {
        total += adjacency_rewards
            .get("neighbor_diff_gender")
            .copied()
            .unwrap_or(0.4);
    }
    count += 1;

    // 4. 前后排社交匹配
    if social_diff < 0.3 {
        total += adjacency_rewards
            .get("neighbor_social_near")
            .copied()
            .unwrap_or(0.7);
    } else {
        total += adjacency_rewards
            .get("neighbor_social_far")
            .copied()
            .unwrap_or(0.3);
    }
    count += 1;

    if count > 0 {
        total / count as f64
    } else {
        0.0
    }
}

// ==================== 主入口 ====================

/// 计算所有学生的奖励值
///
/// 这是被 Tauri 命令调用的主函数。
/// 根据传入的奖励配置、学生信息、座位布局，计算每个学生的
/// 位置奖励、个人因子奖励、相邻关系奖励，并汇总。
pub fn calculate_rewards(request: &RewardCalcRequest) -> RewardCalcResult {
    let total_students = request.students.len();
    // 兼容前端可能只传入 total_seats 或部分字段的情况
    let mut total_rows: u32 = 0;
    let mut total_cols: u32 = 0;

    if let Some(r) = request.seat_layout.rows { total_rows = r; }
    if let Some(c) = request.seat_layout.cols { total_cols = c; }
    if total_rows == 0 || total_cols == 0 {
        if let Some(ts) = request.seat_layout.total_seats {
            // try to infer cols/rows if missing
            if total_cols == 0 && total_rows > 0 {
                total_cols = ((ts as f64) / (total_rows as f64)).ceil() as u32;
            } else if total_rows == 0 && total_cols > 0 {
                total_rows = ((ts as f64) / (total_cols as f64)).ceil() as u32;
            } else {
                // neither rows nor cols specified -> use square-ish layout based on total seats or students
                let n = if ts > 0 { ts as usize } else { total_students };
                let cols = (f64::from(n as u32).sqrt()).ceil() as u32;
                total_cols = cols.max(1);
                total_rows = ((n as f64) / (total_cols as f64)).ceil() as u32;
            }
        } else {
            // completely missing -> derive from students
            let n = total_students;
            let cols = (n as f64).sqrt().ceil() as u32;
            total_cols = cols.max(1);
            total_rows = ((n as f64) / (total_cols as f64)).ceil() as u32;
        }
    }

    // 计算相邻关系奖励
    let adjacency_rewards_list =
        calc_adjacency_reward(&request.students, &request.reward_config.adjacency_rewards);

    // 计算每个学生的详细奖励
    let student_rewards: Vec<StudentReward> = request
        .students
        .iter()
        .enumerate()
        .map(|(idx, student)| {
            // 位置奖励：根据座位索引计算行列位置
            let row_idx = (idx as u32 / total_cols) % total_rows;
            let col_idx = idx as u32 % total_cols;

            let position_reward = calc_position_reward(
                &request.reward_config.position_rewards,
                &request.reward_config.special_rewards,
                row_idx,
                col_idx,
                total_rows,
                total_cols,
            );

            // 门/多媒体额外调整
            let mobility = student.factors.get("mobility").copied().unwrap_or(0.5);
            let sensitivity = student.factors.get("sensitivity").copied().unwrap_or(0.5);
            let door_boost = calc_door_boost(&request.doors, row_idx, col_idx, mobility, &request.reward_config.special_rewards);
            let multimedia_boost = calc_multimedia_boost(&request.multimedia, row_idx, col_idx, sensitivity, &request.reward_config.special_rewards);

            // 将位置奖励与额外加成相加并限制在 [0,1]
            let mut position_reward = position_reward + door_boost + multimedia_boost;
            if position_reward > 1.0 { position_reward = 1.0; }
            if position_reward < 0.0 { position_reward = 0.0; }

            // 个人因子奖励
            let factor_reward = calc_factor_reward(
                &student.factors,
                &request.reward_config.factor_rewards,
            );

            // 相邻关系奖励
            let adjacency_reward = adjacency_rewards_list
                .get(idx)
                .copied()
                .unwrap_or(0.0);

            // 总奖励 = 加权和（各分类权重目前均等，后续可调整）
            let total_reward = position_reward * 0.4
                + factor_reward * 0.3
                + adjacency_reward * 0.3;

            StudentReward {
                name: student.name.clone(),
                position_reward,
                factor_reward,
                adjacency_reward,
                total_reward,
            }
        })
        .collect();

    // 计算统计指标
    let total_students_count = student_rewards.len();

    let position_avg = if total_students_count > 0 {
        student_rewards
            .iter()
            .map(|r| r.position_reward)
            .sum::<f64>()
            / total_students_count as f64
    } else {
        0.0
    };

    let factor_avg = if total_students_count > 0 {
        student_rewards
            .iter()
            .map(|r| r.factor_reward)
            .sum::<f64>()
            / total_students_count as f64
    } else {
        0.0
    };

    let adjacency_avg = if total_students_count > 0 {
        student_rewards
            .iter()
            .map(|r| r.adjacency_reward)
            .sum::<f64>()
            / total_students_count as f64
    } else {
        0.0
    };

    let total_fitness = student_rewards.iter().map(|r| r.total_reward).sum::<f64>();

    let avg_reward = if total_students_count > 0 {
        total_fitness / total_students_count as f64
    } else {
        0.0
    };

    RewardCalcResult {
        total_students,
        avg_reward,
        total_fitness,
        student_rewards,
        category_stats: CategoryStats {
            position_avg,
            factor_avg,
            adjacency_avg,
        },
    }
}
