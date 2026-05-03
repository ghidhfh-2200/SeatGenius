# SeatGenius 🧬🪑 — 使你的的课堂不再喧嚣

**SeatGenius** 是一款基于 **遗传算法** 的智能教室排座桌面应用，使用 [Tauri v2](https://v2.tauri.app/) 构建，前端采用 React 19 + Ant Design 6，后端使用 Rust + Python (DEAP) 实现遗传算法引擎。

> 告别手动排座，让算法为你找到最优的座位分配方案。

## 重要提醒：本项目还在开发中，大量BUG和不完善请理解

---

## ✨ 功能概览

### 🏫 教室编辑器
- 通过 SVG 画布可视化创建和编辑教室布局
- 支持多种组件类型：**讲台、课桌、座位、窗户、门、多媒体、走廊、大组/小组**
- 组件层级管理（大组 → 小组 → 座位），支持树形视图操作
- 拖拽式调整、批量删除、ID 日志追踪
- 导出教室数据并保存预览图

### 📋 排座方案编辑器
- **名单管理**：上传 `.txt` / `.csv` 文件，解析学生姓名；支持另存为和从已保存名单导入
- **个人属性配置**：为每位学生配置多维因子（身高、性别、社交活跃度、行动能力、视听敏感度等）
- **标签系统**：自定义标签（如"近视""需照顾"），每个标签关联因子类型和权重
- **奖励条件设置**：配置位置奖励（前/中/后排、左/中/右列）、特殊位置（靠窗、靠门、角落、讲台附近）、因子区间奖励、相邻关系奖励（同桌/前后排的性别与社交匹配）
- **奖励值计算**：实时预览每位学生的位置奖励、因子奖励、相邻关系奖励和总奖励
- **档案管理**：保存和加载完整的排座配置（名单、属性、标签、条件）

### 🧬 遗传算法引擎
- 基于 **DEAP** 库实现 **NSGA-III** 多目标优化算法
- 三个优化目标：**效用分数**（学生与座位的匹配度）、**分布均匀度**（座位分散程度）、**行列平衡度**（各行列人数方差）
- **硬约束**：身高排序（高个子在后排，矮个子在前排）
- 支持自定义种群大小、交叉概率、变异概率、迭代代数
- 演化进度实时显示，完成后自动跳转结果页

### 📊 演化结果可视化
- SVG 渲染教室座位表，学生姓名直接标注在座位上
- 鼠标悬停学生列表时高亮对应座位
- 支持导出座位表（保存为 JSON + SVG 预览）
- 从仪表盘直接查看已保存的座位表

### 📈 仪表盘
- 统计概览：教室数量和座位表数量
- 双标签页管理："我的座位表"和"我的教室"
- 预览图、名称、创建时间、文件状态（正常/异常）
- 一键删除、刷新、快速导航

---

## 🏗️ 技术架构

```
seatgenius/
├── src/                          # 前端 (React 19)
│   ├── main.jsx                  # 入口，路由配置
│   ├── pages/                    # 页面组件
│   │   ├── Dashboard.jsx         # 仪表盘
│   │   ├── NewClassroom.jsx      # 教室编辑器
│   │   ├── SeatPlanEditor.jsx    # 排座方案编辑器
│   │   ├── EvolutionStatus.jsx   # 演化状态监控
│   │   ├── EvolutionResult.jsx   # 演化结果可视化
│   │   ├── UploadStudentName.jsx # 上传学生名单
│   │   └── EditLabelsClean.jsx   # 标签管理
│   ├── components/               # 可复用组件
│   │   ├── MakeSeatList/         # 排座相关组件
│   │   ├── EditSeatTable/        # 教室编辑相关组件
│   │   ├── SeatPlanEditor/       # 方案编辑器模态框
│   │   ├── EvolutionResult/      # 结果导出组件
│   │   ├── ShapeEditor/          # SVG 形状编辑器
│   │   └── SplitPane.jsx         # 可拖拽分割面板
│   └── api/                      # 业务逻辑与工具函数
│       ├── newclassroom/         # 教室渲染、ID生成、数据加载
│       ├── makeSeatList/         # 因子工具、条件工具、排座动作
│       ├── evolution/            # 演化结果处理
│       ├── dashboard/            # 仪表盘工具
│       └── shared/               # 文件解析等通用工具
├── src-tauri/                    # 后端 (Rust + Python)
│   ├── src/
│   │   ├── lib.rs                # Tauri 命令注册
│   │   ├── main.rs               # 入口
│   │   ├── initDB.rs             # SQLite 数据库初始化
│   │   ├── database.rs           # 标签、名单、教室 CRUD
│   │   ├── classroom_loader.rs   # 教室数据加载
│   │   ├── ClassroomExport.rs    # 教室导出
│   │   ├── dashboard_records.rs  # 仪表盘记录查询
│   │   ├── evolution_bridge.rs   # 遗传算法调度（Rust 线程 + Python 调用）
│   │   ├── reward_calculator.rs  # 奖励值计算引擎
│   │   ├── seat_table_export.rs  # 座位表导出/加载/删除
│   │   ├── profile_manager.rs    # 档案管理
│   │   ├── HashWithSalt.rs       # SGID 哈希生成
│   │   └── ReadEnvConfig.rs      # 环境配置读取
│   └── python/
│       └── evolution_engine.py   # DEAP NSGA-III 遗传算法实现
└── data/                         # 运行时数据目录
    ├── classrooms/               # 教室数据文件
    ├── previews/                 # 教室预览 SVG
    ├── seattable/                # 座位表数据文件
    ├── seattable-preview/        # 座位表预览 SVG
    ├── namelist/                 # 学生名单文件
    ├── profile/                  # 排座档案文件
    ├── defaultLabels.cfg         # 默认标签配置
    └── default_config.env        # 默认环境配置
```

### 技术栈

| 层级 | 技术 |
|------|------|
| **桌面框架** | [Tauri v2](https://v2.tauri.app/) |
| **前端框架** | React 19 + React Router 7 |
| **UI 组件库** | Ant Design 6 + Font Awesome |
| **SVG 渲染** | Fabric.js 5 (ShapeEditor) + 原生 SVG |
| **后端语言** | Rust (稳定版 2021 edition) |
| **数据库** | SQLite (rusqlite) |
| **遗传算法** | Python 3 + DEAP (NSGA-III) |
| **Rust-Python 桥接** | PyO3 0.22 |
| **构建工具** | Vite 7 |

---

## 🚀 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/) 工具链
- [Python](https://www.python.org/) 3.x（遗传算法引擎需要）
- Python 依赖：`pip install deap`

### 安装与运行

```bash
# 1. 安装前端依赖
cd seatgenius
npm install

# 2. 安装 Python 依赖
pip install deap

# 3. 开发模式运行
npm run tauri dev
```

### 构建

```bash
npm run tauri build
```

---

## 🧠 核心算法

### 奖励值计算 ([`reward_calculator.rs`](seatgenius/src-tauri/src/reward_calculator.rs))

每个学生的总奖励由三部分组成：

```
总奖励 = 位置奖励 × 0.4 + 因子奖励 × 0.3 + 相邻关系奖励 × 0.3
```

- **位置奖励**：根据座位所在行列区域（前/中/后排 × 左/中/右列）和特殊位置（靠窗、靠门、角落、讲台附近、多媒体附近）计算
- **因子奖励**：根据学生的个人因子值匹配预设的区间规则，累加归一化
- **相邻关系奖励**：评估同桌和前后排之间的性别匹配度、社交活跃度匹配度

### 遗传算法 ([`evolution_engine.py`](seatgenius/src-tauri/python/evolution_engine.py))

- **算法**：NSGA-III（基于参考点的非支配排序遗传算法）
- **编码**：排列编码，每个位置对应一个座位，值为学生索引或 -1（空位）
- **交叉**：部分匹配交叉 (PMX)
- **变异**：洗牌变异
- **选择**：NSGA-III 选择算子
- **硬约束**：身高排序约束（高个在后排，矮个在前排），违反则给予强惩罚

---

## 📄 许可证

本项目仅供学习和个人使用。

---

## 🙏 致谢

- [Tauri](https://tauri.app/) - 轻量级桌面应用框架
- [DEAP](https://deap.readthedocs.io/) - 分布式进化算法框架
- [Ant Design](https://ant.design/) - 企业级 UI 设计语言
- [React](https://react.dev/) - 前端 UI 库
