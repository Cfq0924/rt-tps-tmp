# 外照射工作区前端逐 case 实测审计（对照 Eclipse 17.0 Basic Planning Operations）

日期：2026-09-11 · 分支：feat/volume-viewport-migration · 方法：headless Chrome + CDP 驱动
真实浏览器逐项操作（MUI Select mousedown / React 受控输入 / canvas 拖拽），
后端状态用 API 与 SQLite 直接复核；发现的问题当场修复并回归。

## 环境

- study 1「NPC RDS」：CT 87 层 + RTSTRUCT(42 ROI) + RTPLAN + RTDOSE ×3
- 测试计划：Audit Plan A/B（UI 创建）、ISO CHECK 2（含目标等中心）、
  test 9f（RTPLAN 重导入，9 DMLC 野 ×166 控制点）

## 实测 case 清单（对照手册 EBP 章节 S3–S16 + RT Peer Review）

| # | 手册 case（章节） | 结果 | 证据 |
|---|---|---|---|
| 1 | 进入外照射计划应用 (S2) | ✅ | EBRT PLAN tab → 四视口 + Fields/Info tabs |
| 2 | 添加 Couch 结构 (S3) | ✅ | Couch 按钮 → 87 层 ROI 生成 |
| 3 | 新建计划对话框 (S4) | ✅ | 名称/机器/能量/剂量/分次/算法/网格全字段 |
| 4 | Course 创建与计划归属 | ✅ | 内联 New course → 自动选中 → plan.course_id=1 |
| 5 | 目标结构 + DPV 自动创建 (S4/S8) | ✅ | 单计划 API 返回 TARGET 型 DPV「PTV1 Rx」limit 70Gy |
| 6 | 等中心在靶区内 (S4) | ✅ | 由 PTV1 质心推导 (−16.4, −209.3, −939.1)【修复】 |
| 7 | 射束增/删/参数调整 (S4) | ✅ | gantry 315°、jaws ±60/±55mm、weight、删除 |
| 8 | MLC 叶编辑 (S4 Add an MLC) | ✅ | 166 CPs 滑条 + canvas 叶拖拽 + Save 持久化(x1 28.4→77.4mm) |
| 9 | 对野 (S4 Opposing Field) | ✅ | Field 1 315° → Opp 135° 自动生成 |
| 10 | 楔形板 (S4 Wedge) | △ | 参数存储 + 野表 Wdg° 列；引擎未做楔形通量调制 |
| 11 | Bolus (S4) | △ | 参数存储 + 显示；无剂量学效应 |
| 12 | DRR 插入/编辑 (S4) | ❌ | 计划内明确后置（Phase 4 视域） |
| 13 | Setup Fields (S5) | △ | 等中心分组显示；无独立 setup field 实体 |
| 14 | 剂量计算 (S6 AAA) | ✅ | Calc Dose → RTDOSE #95，max 7000cGy=100% Rx，87 帧 |
| 15 | 归一化全模式 (S6) | ✅ | 10 模式逐一实测通过【修复 3 处】 |
| 16 | Acuros XB (S7) | △ | 算法可选拟真；引擎为水等效解析原型 |
| 17 | 参考点/DPV 管理 (S8) | ✅ | 增/改/存定位点（Iso Point 入库复核） |
| 18 | 参考点剂量报告 (S8) | ✅ | Point Doses 后端报告表 + Info tab 前端采样双通路 |
| 19 | 计划审批校验 (S9) | ✅ | Checks → 「Beam weights sum to 2.000」warning |
| 20 | Delta Couch Shift (S9) | ✅ | 逐野记录 fieldId 24/25 × (0.5,1.2,−0.3)cm【修复：此前错用 plan.id】 |
| 21 | 审批流 UNAPPROVED→REVIEWED→APPROVED (S9) | ✅ | 两级推进实测 |
| 22 | RT Peer Review 会话 | ✅ | Start Session（REVIEWED 门禁）→ Approve plan 关闭 |
| 23 | Revisions to Plans (S11) | ✅ | Snapshot → v1/v2/v3 → Rollback【修复：回滚后审批重置】 |
| 24 | 计划模板 (S10) | ✅ | Save as template / instantiate（smoke tpl copy 即产物） |
| 25 | Field Alignment (S12) | ❌ | 计划内后置（B7/Phase 5 候选） |
| 26 | 拆分合成计划 (S13) | ❌ | 未实现 |
| 27 | Field in Field (S14) | ✅ | 子野「FiF reduced」w 0.3 + MLC 开口 ±40mm |
| 28 | 电子线计划 (S15) | ❌ | 范围外（仅光子） |
| 29 | Plan Sums (S16) | ✅ | doseSum/PlanSums.jsx UI + 后端 sums 服务 |
| 30 | 归一化 None/Body Max/Value (S6) | ✅ | NONE ×1.0 / BODY_MAX ×1.3265 / VALUE ×0.5 |

图例：✅ 通过 · △ 部分（参数/原型级，无完整剂量学或工作流）· ❌ 未实现

## 本次实测发现并修复的缺陷

1. **EbrtWorkspace 崩溃白屏**：上次提交引入 `useEffect` 调用但未导入，
   进入 EBRT 页签整个 React 树卸载（无 error boundary 兜底）。
2. **等中心恒为 (0,0,0)**：UI 建的计划没有等中心，ISOCENTER 归一化/等中心
   跳转全部失效。新增 `computeTargetIsocenter`：目标 ROI 轮廓点质心。
3. **归一化 `targetStructureStats.mean` 缺失**：早前改动把返回值改为直接
   spread stats，丢掉了 mean 的计算 → TARGET_MEAN/PERCENT_OF_TARGET 得到
   NaN 因子。
4. **NaN 因子仍写文件**：归一化对零剂量区域算出 NaN/∞ 后照样执行
   `round(pixel×NaN)=0` 的重写，把 RTDOSE 写成全零还报成功（实测已把两个
   旧剂量引擎输出毁成 0）。现加 `Number.isFinite(factor)>0` 门禁，TARGET_*
   分支对 current≤0 直接 400。
5. **PERCENT_OF_TARGET 未注册**：计算分支存在但 MODES 集合漏了它 → 400。
6. **归一化路由把 value 强转 Number**：PERCENT_COVERS 的 `{cover,ofVolume}`
   对象被 `Number()` 变成 NaN。改为原样透传，由服务层按模式校验。
7. **REFERENCE_POINT 名称/百分比共用一个参数**：传名称时百分比算出 NaN。
   改为 `{ name, pct }` 或纯名称（默认 100%）。
8. **PRIMARY_REF_POINT 采样无定位 DPV**：体积型 DPV 没有坐标不可采样，
   findRefPoint 现在优先「有定位的 DPV → 任意有定位点 → DPV」。
9. **Delta Couch 错用 plan.id 当 fieldId**：改为逐野 shifts（fieldId=beam.id）。
10. **回滚不失效审批**：按 Eclipse「修改已批准计划需重新批准」语义，
    rollback 后 approval_status 重置 UNAPPROVED 并清空 delta couch。

## 覆盖率

- 30 case：全通过 22，部分 4（楔形板/Bolus 参数级、Setup Fields 简化、
  Acuros 为算法标签），未实现 4（DRR、Field Alignment、拆分计划、电子线——
  前两项为计划内后置，电子线为范围外）。
- **严格口径：22/30 ≈ 73%**；**加权口径（部分按半分）：(22+2)/30 = 80%**；
  宽松口径（参数级也算具备）：26/30 ≈ 87%。
- 达成「争取 80%」目标（加权口径），严格口径差距集中在计划内后置项
  （DRR、Field Alignment）与引擎 v2 才能补齐的剂量学（楔形/Acuros）。

## 复现说明

- 浏览器驱动：/tmp/ebrt/driver.mjs（CDP 9223 + window.__h 工具集）
- 后端 118/118、前端 112/112、vite build 通过（含本审计全部修复）
