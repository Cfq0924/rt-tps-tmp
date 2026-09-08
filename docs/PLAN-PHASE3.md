# TPS 开发计划 v3 — 互操作闭环与剂量引擎起步

依据：PLAN-PHASE2 路线图的 Phase 3 章节（DICOM RT 导出 / 图像配准 / 逆向优化 /
Peer Review），结合 Varian 手册资源（主手册 Ch2 导入导出、Ch5 RT Peer Review、
Ch7 配准；`17其他总和.md` 内嵌逆向优化、形变配准、VMAT、Smart Segmentation、
4D、RTM、Halcyon 手册）与 Phase 2 交付后的实际数据模型校准。

原则延续：**按临床工作流排序，按数据依赖排序**——先做数据链路已就绪的功能
（导出），把需要新引擎的功能（剂量计算/逆向优化）独立成长轨道。

---

## 现状盘点（Phase 2 交付后）

| 能力 | 现状 |
|---|---|
| DICOM 导入 | ✓ CT / RTSTRUCT / RTDOSE / RTPLAN |
| DICOM 导出 | ✗（互操作只有半条链路） |
| 勾画 | ✓ 画笔/洪泛/布尔/CTV→PTV/体部自动/审批锁定；几何为 RTSTRUCT 同构 |
| 外照射计划 | ✓ 计划+射野 CRUD、模板、参考点、审批流、楔形板/Bolus 字段 |
| 计划评估 | ✓ DVH（累积/微分/D95/D50/D2/体积）、点剂量、Global Max、等剂量线 |
| 多用户/审批 | ✓ JWT auth 开关（AUTH_DISABLED）、审批流、audit log |
| 剂量计算 | ✗ 只有导入剂量网格的解析与采样 |
| 配准 | ✗ 占位模块 |
| 计划 sums | ✗ |
| Peer Review | ✗ |

技术可行性已核实：
- **dcmjs 0.49.4 具备 DICOM 写出能力**（`datasetToDict()` + `write()`），RTSTRUCT
  导出无新依赖。
- 勾画持久化（`segmentation_slices.points_json`）为患者坐标 mm 的平面多边形，
  与 RTSTRUCT ROIContourSequence 结构同构，转换是纯映射。
- EBRT 计划几何（isocenter/角度/jaw/weight/楔形板）齐全，可写最小 RTPLAN；
  缺 MLC 叶位与 meterset（无优化器），导出时诚实标注。

---

## Phase 3 里程碑

### P3-M1: DICOM RT 导出（首选起点，约 2-4 天）— 互操作闭环

数据链路里只有"导入"没有"导出"，是当前最短的闭环。按价值排序：

**1a. RTSTRUCT 写出（核心）**
- 后端 `exportService.rtStructFromSegmentation(segmentationId)`：
  `segmentations` + `segmentation_slices` → DICOM RT Structure Set Storage
  (300A, StructureSetROISequence / ROIContourSequence / RTROIObservationsSequence)
- 需新增：DICOM UID 生成器（`2.25.{uuid整型化}`，无 MINT 依赖）；
  Patient/Study 元数据从 `patients`/`studies` 继承；Series UID 新生成
- InterpretedType 推断：按分段命名约定（PTV*/GTV*→PTV/GTV，其余 ORGAN），
  允许后续手动覆盖（Phase 4）
- 字符集：显式 ISO_IR 100 起步（ASCII 命名），文件级选项
- 单测：合成数据写出 → dcmjs 回读断言 ROI 数量/点坐标一致

**1b. RTPLAN 最小写出**
- `ebrt_plans` + `ebrt_beams` → RT Plan Storage：PatientSetup/Prescription/
  BeamSequence（gantry/collimator/couch/jaw/wedge/bolus/weight）
- 明确局限（写进导出说明与 DICOM 注释）：无 MLC 叶位、无 meterset 的字段
  以 STATIC + jaw 几何表示；VMAT 弧写 gantry start/stop
- 验收：Eclipse 手册结构对照 + 本系统重新导入一致

**1c. RTDOSE 原样导出**
- 当前无自产剂量网格：导入的 RTDOSE 文件原样（字节级）导出即可
- 派生 RTDOSE 写出（计划 sums 产物）延至 P3-M3

**1d. 前端入口 + 端点**
- 后端：`GET /api/export/study/:studyId/rtstruct`（可选拼多个分段）、
  `GET /api/export/ebrt/:planId/rtplan`、`GET /api/export/file/:fileId`（原样）
  ——鉴权同现有路由，`Content-Disposition` 附件下载
- 前端：患者详情页导出菜单 + 勾画/EBRT 面板"导出"按钮
- **验收标准（M1 整体）**：导出 → 重新导入本系统 round-trip 一致
  （ROI 几何逐点相等、计划字段相等）；结构对照 test_data 外部文件

### P3-M2: 图像配准（刚性）+ MPR spike（约 1-2 周）

- 手册工作流（Ch7 / 形变配准手册："刚性必须先于形变"）：
  双序列选择 → 叠加显示（opacity 融合或分屏联动）→
  Manual Match（平移/绕 z 旋转，键盘微调 ±0.1mm/±0.1°）→
  Auto Match（质心 / HU 阈值质心）→ 保存
- 数据模型：`series_registrations` 表（moving series → fixed series、
  4x4 矩阵 JSON、方法、作者、audit）
- 显示：注册矩阵作用于 moving viewport 的相机/或重采样副本（重采样另需
  出一张派生 series——先做矩阵显示，重采样在 M3 需要时实现）
- **MPR spike（时间盒 1-2 天）**：按 WISSEN §9 恢复清单再试 VolumeViewport
  （4.22 + preferSizeOverAccuracy + 软硬件 GL 对照）。成功则启用 MPR；
  失败则维持 StackViewport，本项关闭并不阻塞其他里程碑
- 验收：两序列（CT/MR，test_data 有 MR？没有则用两窗位 CT 模拟）配准后
  解剖对齐可目视判定；矩阵持久化往返

### P3-M3: 计划 sums（约 1 周，依赖 M1c 的写出路径）

- 同几何多 RTDOSE 直接体素相加（复用 doseSampling/doseTransform 工具）→
  派生剂量网格 → 写出 RTDOSE（GridFrameOffsetVector/DoseGridScaling/
  DoseSummationType=MULTI_PLAN）→ 叠加后 DVH（EvaluationPanel 选 sums）
- 配准后相加（不同几何）依赖 M2 的重采样，Phase 4
- 新表：`dose_sums`（组成 RTDOSE 文件 id 列表、产物文件 id）
- 验收：两个导入 RTDOSE 相加，采样点值 = 两者之和（±浮点容差）；
  产物可导出并被本系统重新导入

### P3-M4: RT Peer Review（约 1 周，可与 M1 并行）

- 手册对齐（Ch5）：计划 REVIEWED 后可发起评审会话；评审人批注（书签定位到
  切片/结构/射野 + 文字评论）；结论 通过（→APPROVED）/ 驳回（→UNAPPROVED），
  全程入 audit log
- 新表：`peer_review_sessions`（plan_id、发起人、状态 OPEN/CLOSED、结论）、
  `review_comments`（session_id、定位 JSON {sliceIdx?, structureId?, beamNumber?}、
  正文、作者、时间）
- UI：EBRT 计划卡"发起评审"（已有审批流按钮旁）；评审会话面板（批注列表、
  定位跳转复用参考点标记/切片跳转模式）
- 权限：AUTH_DISABLED 时单用户也能走通流程（评审人=发起人，标注为自审）
- 验收：发起→批注（定位跳转正确）→通过/驳回 → approval_status 与 audit 一致

### P3-M5: 剂量计算与逆向优化（独立长轨道；本 Phase 交付 5a）

**排序依据**：无正向剂量引擎就没有逆向优化（优化器以剂量 influence 为输入）。

**P3-M5a（本 Phase 交付）：正向剂量计算选型报告 + 可运行原型**
- 候选：自研 Pencil Beam（SAD 几何 + Tissue-Maximum-Ratio 深度剂量 +
  离轴比；异质修正后置）、COLLAPSED CONE 简化版、matRad 内核移植评估
- 验证基准：TEST849 已有外部 RTDOSE 作为参考网格，同几何重算后对比
  （点剂量/DVH 相对偏差；不声明临床级精度）
- 交付物：选型报告（含工程量/精度/依赖评估）+ 原型（单 STATIC 野、水等效）
- 5b（Phase 4）：逆向优化（fluence map 目标函数 + 序贯二次优化；
  MLC 叶位序贯 = VMAT 直接 aperture 优化，参考 Inverse Planning / VMAT
  手册；matRad 集成 vs 自研在 5a 报告中定夺）

---

## 依赖与推荐顺序

```
M1 RT导出 ──→ M3 计划sums（需RTDOSE写出）
M4 Peer Review（独立，可与M1并行）
M2 配准 ──→ M3 配准后sums（Phase 4）；M2 含 MPR spike
M5a 剂量引擎 ──→ M5b 逆向优化（Phase 4）
```

推荐执行序：**M1 → M4 → M2 → M3 → M5a**（M5a 穿插启动调研）。

---

## 明确不做（Phase 4+）

形变配准（依赖 M2 刚性 + 重采样）、Smart Segmentation（ML）、VMAT 逆向优化、
4D 计划、RTM Workspaces、Halcyon 工作流、DICOM Q/R 与 PACS Storage SCU

---

## 风险

- **DICOM 合规细节**：RTSTRUCT 的 ROI 观察类型/字符集/UID 层级约定多——
  以 round-trip 校验 + test_data 外部文件结构对照兜底；必要时用 dcmjs 官方
  conformance 样例对拍
- **剂量引擎精度**：外部参考仅 TEST849 一例——只做相对合理性校验，文档明确
  不做临床精度声明
- **MPR spike 可能再次确认 GPU 黑屏**：时间盒控制，失败即关闭该项，不阻塞
- **RTPLAN 最小导出的互操作性**：无 MLC 的 STATIC 计划可能被外部系统拒绝——
  导出说明中标注局限，真实互操作验收以 RTSTRUCT 为准
