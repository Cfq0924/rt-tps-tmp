# PLAN — 外照射计划（EBPT）后端补全计划

依据：Eclipse 17.0 Basic Planning Operations 手册 External Beam Planning 章节
（docs/test01.pdf，文字版 `docs/Eclipse 17.0 Basic Planning Operations.md`）
+ UI 截图。范围：**后端数据模型与服务**；前端仅在信息已有处最小接线
（Info tabs 已有 Fields/Dose Statistics/Reference Points/Calculation Models 骨架）。

关联：PLAN-PHASE4.md（M2 引擎 v2 消费 B2 的 MLC/B4 的计算模型；M3 优化器
消费 B4；B6 供给 Peer Review 增强）。

---

## 1. 手册 → 现状差距映射

| Eclipse EBPT 概念（手册章节） | 后端现状 |
|---|---|
| Course → Plan 层级（Select Course / New Course） | ✗ 计划直接挂 study |
| Plan Details：Plan ID、Dose per Fraction、Plan Target Structure | △ fraction 数有；目标结构/每分次处方未建模 |
| Primary Reference Point / DPV（Type=Target、Total Dose Limit、Daily-Session Doses、无位置） | ✗ reference_points 只有位置型点 |
| MLC 叶位 / Control Points（BeamLimitingDevicePositionSequence） | ✗ parseRTPlan 有意跳过 |
| Meterset / Beam MU / 权重和=1 → 等中心 100% | ✗ 仅 weight |
| Plan Normalization（Target Max/Mean/Min、% of Target、% at Isocenter、用户值） | ✗ 仅 normalization 字符串 |
| Calculation Models（逐计算类型算法、Grid 0.1–0.5 cm、Calculation Volume、GPU） | △ 松散字符串字段 |
| Couch Structures（床结构入数据集，参与异质修正） | ✗ |
| Opposing Field / Field in Field（子野） | ✗ |
| Plan Approval Warnings & Errors + Delta Couch Shift Editor | △ 三态审批 ✓；校验清单/位移 ✗ |
| Revisions to Plans | ✗ |
| DRR（Insert/Edit DRR） | ✗（Phase 4 视域） |

---

## 2. Schema 变更总览

```sql
-- B1
CREATE TABLE courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  name TEXT NOT NULL, intent TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE ebrt_plans ADD COLUMN course_id INTEGER REFERENCES courses(id);
ALTER TABLE ebrt_plans ADD COLUMN target_structure_name TEXT;      -- Plan Target Structure
ALTER TABLE ebrt_plans ADD COLUMN dose_per_fraction_gy REAL;
ALTER TABLE ebrt_plans ADD COLUMN primary_point_id INTEGER REFERENCES reference_points(id);
ALTER TABLE reference_points ADD COLUMN type TEXT DEFAULT 'POINT'; -- POINT | TARGET(DPV)
ALTER TABLE reference_points ADD COLUMN total_dose_limit_gy REAL;
ALTER TABLE reference_points ADD COLUMN daily_dose_gy REAL;
-- B2
CREATE TABLE beam_control_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  beam_id INTEGER NOT NULL REFERENCES ebrt_beams(id) ON DELETE CASCADE,
  cp_index INTEGER NOT NULL,
  gantry_angle REAL, collimator_angle REAL, couch_angle REAL,
  cumulative_meterset_weight REAL,
  mlc_json TEXT,                      -- [{leafPair, x1, x2, y1, y2}] 或按机型叶位数组
  UNIQUE(beam_id, cp_index)
);
ALTER TABLE ebrt_beams ADD COLUMN meterset REAL;
ALTER TABLE ebrt_beams ADD COLUMN leaf_pair_count INTEGER;  -- 机型：如 Millennium 120
CREATE TABLE beam_subfields (        -- Field in Field
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  beam_id INTEGER NOT NULL REFERENCES ebrt_beams(id) ON DELETE CASCADE,
  name TEXT NOT NULL, weight REAL DEFAULT 1,
  mlc_json TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
-- B4
ALTER TABLE ebrt_plans ADD COLUMN calc_models_json TEXT;
-- B6
ALTER TABLE ebrt_plans ADD COLUMN delta_couch_json TEXT;  -- {x,y,z,rot}
CREATE TABLE plan_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES ebrt_plans(id) ON DELETE CASCADE,
  revision_no INTEGER NOT NULL, snapshot_json TEXT NOT NULL,
  created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plan_id, revision_no)
);
```

老库迁移沿用 `addColumnIfMissing` + `CREATE TABLE IF NOT EXISTS` 模式；
MLC JSON 体积评估后决定是否换 BLOB+压缩（先 JSON，必要时再迁）。

---

## 3. 工作包明细

### B1 Course/Plan 处方模型 + DPV（3-4 天）

- `courses` CRUD（list/create/patch/delete；删除级联至计划——计划可选迁移）
- ebrt_plans 补丁：course_id / target_structure_name / dose_per_fraction_gy /
  primary_point_id（校验：引用点必须属于本计划且 type=TARGET）
- reference_points 扩展：POST/PATCH 支持 type / total_dose_limit_gy /
  daily_dose_gy / is_dpv；DPV 允许无位置（位置可空）
- 计划树（EbrtLeftTree）与 Info tabs 的 Reference Points 表按 DPV 语义展示
- 验收：创建带 DPV 的课程→计划链路；处方 limit/每日剂量随审批校验（B6 联动）

### B2 射束模型深化：MLC / Control Points / 子野 / 对野（1-1.5 周）

- parseRTPlan v2：逐控制点提取 BeamLimitingDevicePositionSequence 中的
  MLCX/MLCY（叶对数、位置对）+ Gantry/Coll/Couch/CumulativeMetersetWeight
- `beam_control_points` 写入（导入 RTPLAN 时自动生成）；导出器写回 MLC
  （RTPLAN 导出升级为含 CP 的完整结构，MU/meterset 若无则按 CP 线性插值标注）
- 子野（FiF）：POST /beams/:id/subfields、PATCH/DELETE；剂量引擎 v2 将子野
  视为独立形状权重叠加
- 对野助手：POST /plans/:id/opposing-field `{sourceBeamNumber, name?}` →
  复制几何、gantry += 180（>180 取 −180 规范化）、couch 同步镜像、新编号
- 校验：叶对数 ∈ {40(MLCi2), 60, 80(Millennium 120), 100...} 按机型表；
  叶位物理边界（x1 ≤ x2、行程 ±200mm、叶片碰撞最小间距）
- 验收：TEST849 RTPLAN 导入 → 控制点/MLC 与 dcmjs 原始解析逐点一致

### B3 归一化服务（2-3 天）

- POST /ebrt/plans/:id/normalize
  `{mode: 'TARGET_MAX'|'TARGET_MEAN'|'TARGET_MIN'|'PERCENT_OF_TARGET'|'ISOCENTER'|'VALUE', value?, beamNumber?}`
- 依赖：计划已有关联剂量网格（source_rtplan_file_id 的 RTDOSE 或 M5a 计算
  网格或 sums 产物——任一存在即可）
- 实现：按 mode 从剂量网格采样目标统计 → 缩放因子 = 目标值/当前值 →
  重写派生 RTDOSE（复制 dose sums 的写出路径，参数化）→ 记录
  normalization 历史（plans.normalization 字段 + audit + plan_revisions 快照）
- 验收：PERCENT_OF_TARGET 95 → 目标结构 D50 缩放至 95% 处方；ISOCENTER 模式
  与 M5a 计算端点的等中心归一数值一致

### B4 计算模型与计算体积（2 天）

- calc_models_json：`{ volumeDose: { algorithm, gridSizeMm (0.1–0.5),
  calcVolume: {x1,x2,y1,y2,z1,z2} | 'FULL', gpu: false }, ... }` 按 Eclipse
  计算类型分键（Volume Dose / DVH Estimation / ...），PATCH 端点 + 校验
- M5a 引擎读取 gridSizeMm 与 calcVolume（当前全网格计算升级为按体积裁剪）
- Info tabs Calculation Models 标签页升级为可编辑表单

### B5 Couch 结构 + DPV 剂量报告（3-4 天）

- 床结构生成器：`POST /studies/:id/couch-structure`
  `{profile: 'rectangle'|'rails', topOffsetMm, widthMm, huOverride?}` →
  按当前 CT 范围生成床面+导轨多边形 ROI → 追加进 segmentation_slices
  （或独立 couch 结构集），HU 语义标注（引擎 v2 异质修正消费）
- DPV/参考点剂量报告：`GET /ebrt/plans/:id/point-doses` →
  每点 { location?, totalDoseCgy, perFractionCgy, pctOfRx, inGrid }
  （三线性采样 doseGrid；多计划 sums 聚合口径对齐 Reference Points 截图）
- 验收：TEST849 计划在等中心参考点采样值 ≈ 外部参考网格同位置剂量（同网格
  精确一致；与 v1 引擎计算的对比为相对量）

### B6 审批强化：校验清单 + Delta Couch + Revisions（2-3 天）

- `GET /ebrt/plans/:id/approval-checks` →
  `{ errors: [...], warnings: [...] }`：
  - errors：无射束 / 无等中心 / 权重和为 0 / 处方缺失 / 射野 jaw 反向
  - warnings：权重和 ≠ 1（Eclipse 约定：等中心 100% 需权重和 = 1）、
    无 DPV、VMAT 无 stop 角、wedge+bolus 同时存在提示
- 审批动作（REVIEWED→APPROVED）前置调用校验；errors 非空拒绝
- delta couch：`{x, y, z, rotation}` 记录于审批（approval 元数据），
  RTPLAN 导出与 Info tabs 展示
- `plan_revisions`：审批时自动快照（计划+射野+参考点 JSON），GET 历史列表 /
  单个快照 / 回滚（生成新版本，不覆盖历史）

### B7 Field Alignment 规则（后置，Phase 5 候选）

对齐规则表 + 3D 视图联动（手册 Section 12），待 EBRT 主流程稳定后评估。

---

## 4. 端点清单汇总

| 方法 | 路径 | 工作包 |
|---|---|---|
| GET/POST/PATCH/DELETE | `/courses...` | B1 |
| PATCH | `/ebrt/plans/:id`（扩展字段） | B1/B4 |
| POST/PATCH/DELETE | `/reference-points`（DPV 语义扩展） | B1 |
| POST | `/ebrt/plans/:id/opposing-field` | B2 |
| POST/PATCH/DELETE | `/ebrt/beams/:id/subfields...` | B2 |
| POST | `/ebrt/plans/:id/normalize` | B3 |
| PATCH | `/ebrt/plans/:id/calc-models` | B4 |
| POST | `/studies/:id/couch-structure` | B5 |
| GET | `/ebrt/plans/:id/point-doses` | B5 |
| GET/POST | `/ebrt/plans/:id/approval-checks|approve` | B6 |
| GET/POST | `/ebrt/plans/:id/revisions...` | B6 |

---

## 5. 测试计划（逐包）

- 每包：service 层 node:test（隔离 DB + schema.sql），RTPLAN 往返回归
  （TEST849 9 野：控制点/MLC 逐点一致）
- B2：合成两野对穿 + MLC 缺口用例；叶位越界/碰撞 400
- B3：合成网格各 mode 的缩放数值断言（±0.1%）
- B6：审批校验矩阵（error/warning 组合）全覆盖

## 6. 风险与边界

- MLC 体量：96 CP × 60 叶对 × 2 值 ≈ 11KB JSON/野——可控；必要时 BLOB+zlib
- Course 层级引起前端计划列表分组——渐进（先后端支持，UI 后续跟進）
- RTPLAN 导入/导出往返：以 dcmjs 原始解析为基准逐字段回归
