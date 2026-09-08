# TPS 开发计划 v2 — 对标 Eclipse 17.0 功能体系

依据：Varian《Eclipse 17.0 Basic Planning Operations》+ 附加手册合集（逆向优化、
Smart Segmentation、VMAT-RapidArc、形变配准、4D、RTM、Halcyon），对照本 TPS
当前实现（M0-M5 六模块）重新校准优先级。

原则：**按临床工作流排序，按数据依赖排序**——优先做"数据链路已就绪、
纯计算/展示"的功能，把需要新引擎的功能独立成里程碑。

---

## 现状盘点（对照 Eclipse 章节）

| Eclipse 章节 | 功能 | 本 TPS 现状 |
|---|---|---|
| Ch1 导航/登录/安全 | UserHome、Enhanced Security | 患者列表 ✓；**auth 已禁用待产品化** |
| Ch2 DICOM Import | 导入/导出 | 导入 ✓（CT/RTSTRUCT/RTDOSE/RTPLAN 解析） |
| Ch3 Contouring | 画笔/智能勾画/布尔运算/CTV→PTV/体部自动勾画/结构审批 | 画笔/橡皮/矩形/椭圆填充、分段 CRUD、持久化、撤销 |
| Ch4 External Beam Planning | 计划/射野/DRR/楔形板/MLC/AAA+Acuros/处方点/审批/模板/计划和 | 计划+射野 CRUD、几何可视化、RTPLAN 导入、审批字段 |
| Ch5 RT Peer Review | 书签/评审会话 | 无 |
| Ch6 Plan Evaluation | 等剂量线/缩放/点剂量/DVH/计划对比 | 等剂量线（含 %Rx）✓；DVH 无 |
| Ch7 Image Registration | 刚性/自动匹配/形变 | 占位 |
| 附加：逆向优化/VMAT/SmartSeg/4D/Halcyon | 优化器与高级流程 | 无 |

---

## Phase 2 里程碑（数据链路已就绪，性价比排序）

### M5 计划评估（最高优先——纯计算展示，输入全部现成）
- **DVH**：基于 RTDOSE 网格 + 结构轮廓（勾画/RTSTRUCT 均可）计算每结构
  累积/微分 DVH；Eclipse Ch6.9-6.12 对齐。数据链路：剂量 SVG/网格端点
  与轮廓（患者坐标）均已就绪，仅缺计算与图表（recharts/自绘 canvas）。
- **点剂量工具**：点击 CT 任意点显示该点剂量（网格三线性插值）——Eclipse
  Ch6.7。实现成本极低（插值 + worldToCanvas 已验证）。
- **Global Max 定位**：已有网格 maxDose 体素索引 → 换算患者坐标 →
  "跳到全局最大剂量层"按钮（Eclipse Ch6.6）。
- **Scale Dose / 处方归一化显示**：Ch6.3，配合现有 %Rx 标注。

### M2 勾画增强（对齐 Eclipse Ch3 工具箱；全部基于自有掩模管线）
- **Flood Fill**（Ch3 洪泛填充）：掩模 BFS/扫描线，纯函数易测。
- **Boolean 运算**（Ch3 布尔）：分段间并/交/减——掩模位运算。
- **Crop / Extract Wall（体部自动勾画）**（Ch3）：CT HU 阈值 + 最大连通域，
  无需 AI 即可实现 Eclipse 的 Manually Contour Body 自动化主体。
- **Expand CTV into PTV**（Ch3 边界扩展）：距离变换实现三维外扩（mm 参数）。
- **结构审批**（Ch3.7 Approve Structure）：分段级 approved 标记。
- Segmentation Wizard / Smart Segmentation：Phase 3（需模型或交互式分割）。

### M4 EBRT 工作区补全（对齐 Ch4；低成本项先行）
- **处方体/参考点**（Ch4.8）：数据模型已支持（DoseReference），补 UI 与
  点剂量联动。
- **计划审批流**（Ch4.9）：UNAPPROVED→REVIEWED→APPROVED 已有字段，
  补审批 UI 与 delta couch shift 记录。
- **计划模板**（Ch4.10 Create Templates）：从既有计划生成模板/复制。
- **计划和（Plan Sums）**（Ch4.16）：多疗程剂量叠加——依赖 RTDOSE 网格
  配准，先支持同几何直接相加。
- 楔形板/Bolus 字段属性（Ch4 射野参数）：字段扩展。
- DRR / MLC 叶位编辑 / Field Alignment / Field-in-Field：Phase 3。
- **AAA/Acuros 剂量计算引擎**：独立大里程碑（需要束流数据与开放源引擎
  选型，如 matRad 集成评估），不在 Phase 2。

### M1 影像与显示补全
- 剂量显示默认项（Ch6.8）：颜色表/阈值持久化。
- 多平面视角（MPR）：VolumeViewport GPU 问题解决后启用（WISSEN §9）。

### M0 产品化前置
- **恢复用户认证**（开发期禁用中）——任何多用户/审批流上线前必须完成。
- 患者删除/编辑接口补全。

---

## Phase 3（独立大里程碑，按依赖启动）
1. **DICOM RT 导出**（RTSTRUCT/RTPLAN/RTDOSE write）——勾画数据已是
   RTSTRUCT 同构几何，是打通外部互操作的关键；建议 DVH 后启动。
2. **图像配准**（Ch7 刚性 Auto/Manual Match → 形变，参考附加手册）。
3. **逆向优化引擎 + MLC**（附加手册 Inverse Planning / VMAT-RapidArc）——
   需要fluence/叶位序贯模型，规模数月。
4. **RT Peer Review / 书签**（Ch5，依赖多用户与审批流）。
5. 4D 计划、RTM Workspaces、Halcyon 工作流——研究型 TPS 暂不排期。

---

## 与旧计划（PLAN-PHASE1）的差异
- 旧计划把 RTPLAN/剂量计算整体列为 Phase 2 Non-Goal——本计划把
  **RTPLAN 导入/计划管理提前完成**（已交付），**DVH 提前**（数据现成），
  剂量引擎仍保持独立里程碑不变。
- 新增 Eclipse 对齐的勾画工具箱（布尔/洪泛/边界扩展/体部勾画）——
  旧计划完全未覆盖，且全部可基于自有掩模管线低成本实现。
- 新增审批流与计划模板——TPS 与普通查看器的核心分界。

---

## 交付状态（2026-09）

Phase 2 已全部交付（含 MPR/剂量显示持久化等遗留小项延后，见 PLAN-PHASE3）：
M5 计划评估（DVH/点剂量/Global Max）✓ · M2 勾画工具箱（洪泛/布尔/CTV→PTV/
体部/审批锁定）✓ · M4 EBRT 补全（参考点/审批流/模板/楔形板 Bolus）✓ ·
M0 产品化（AUTH_DISABLED 开关/患者与研究删除）✓。
后续路线见 **PLAN-PHASE3.md**。
