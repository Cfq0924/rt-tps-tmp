# TPS 开发计划 v4 — 精度与互操作

依据：PLAN-PHASE3.md 的 Phase 4 章节（配准重采样 / 剂量引擎 v2 / 逆向优化 /
互操作），结合 Phase 3 交付后的实际状态校准。原则延续：按临床工作流与数据
依赖排序，大里程碑守 MVP 边界。

---

## 现状盘点（Phase 3 交付后）

| 能力 | 现状 |
|---|---|
| DICOM 导入/导出 | ✓ RTSTRUCT/RTPLAN 最小/RTDOSE 导出；C-STORE 网络推送 ✗ |
| 勾画 | ✓ 轴位全套工具 + 审批锁定；矢/冠状面勾画 ✗ |
| 外照射计划 | ✓ 计划/射野/模板/审批/Peer Review/参考点/楔形板 |
| 剂量计算 | △ 水等效解析原型（M5a，无异质修正/发散/MLC 调制）|
| 逆向优化 | ✗ |
| 配准 | △ 刚性匹配 + 矩阵持久化（重采样 ✗、形变 ✗）|
| 计划 sums | △ 同几何相加 ✓；跨几何（需重采样）✗ |
| MPR | ✓ CPU 重采样三断面 + 四视口；MPR 面轮廓交线/勾画 ✗ |
| 多用户/审批/审计 | ✓ |

已核实的约束：
- `parseRTPlan` 有意未提取 MLC 叶位——剂量引擎 v2 与逆向优化的前置缺口。
- test_data 仅有 CT 单序列（无 MR/第二序列）——配准重采样验证用 CT↔CT +
  合成体积；外部多序列病例待补充。
- Phase 3 遗留小项：MPR GPU spike（§9/§11.9）、MPR 面轮廓交线、患者编辑、
  剂量显示持久化、delta couch shift、结构 InterpretedType 手动覆盖。

---

## Phase 4 里程碑

### P4-M1 配准重采样 + 跨几何 Plan Sums（约 1 周）

- **刚性重采样**：moving 体数据按已保存的 4×4 矩阵三线性重采样到 fixed
  网格 → 生成派生序列（新 Series UID，modality 不变 + SeriesDescription
  "Registered"）→ 入库 `dicom_files`，可在 MPR/四视口显示
- 重采样纯函数放 `lib/resampleVolume.js`（前端）或后端服务——体数据已在前端
  缓存（mprVolume），v1 前端实现 + 派生序列元数据入库（像素级文件写出后置）
- **跨几何剂量和**：剂量网格 A 重采样到 B 几何（三线性）→ 相加 → 派生
  RTDOSE（复用 doseSumService 写出路径），解除"同几何"限制
- 验收：合成平移体积重采样误差 < 0.5 体素；注册后序列与 fixed 解剖对齐
  （目视 + 截面采样数值断言）

### P4-M2 剂量引擎 v2 — 向临床级靠拢（2-3 周）

- **parseRTPlan 扩展**：提取逐控制点 MLC 叶位
  （BeamLimitingDevicePositionSequence，MLCW/MLCX 叶对）+ 分辨射野发散几何
- **引擎升级**（doseEngineService v2）：
  - 射线发散：精确平方反比（源到体素距离）
  - HU→ρ 校准曲线（可配置查表：如 −1000→0, 0→1, 100→1.1, ≥2000→2.0 线性段）
  - MLC 通量调制：控制点 MLC 投影为 BEV 通量图 → 代替开放野 profile
  - TPR 参数表：6MV / 10MV 两档（µ、dmax 可配置）
- **基准报告（REPORT-DOSE-ENGINE-5A.md 增补）**：TEST849 逐野
  - 中心轴 PDD 对比（计算 vs 外部剂量网格采样）
  - 等中心层面侧向剖面对比
  - 2D gamma（3%/3mm）通过率
- 验收：中心轴 PDD 形状一致；gamma 通过率报告如实记录（不声明临床精度）

### P4-M3 逆向优化器 M5b MVP（数月级；守 MVP 边界）

- 前置：P4-M2（优化器每次迭代调用正向引擎）
- MVP 范围：**静态野 IMRT 通量图优化**——
  - 每野通量图离散为 beamlet 网格（如 5×5mm）
  - 剂量影响近似：每 beamlet 的剂量贡献 = 引擎以单 beamlet 通量计算
    （或 kernels 插值，评估后定）
  - 目标函数：PTV 处方均匀项（二次）+ OAR 上限惩罚 + 正则项
  - 求解：梯度投影 / 阻尼最小二乘（Node 实现，Web Worker/分块计算）
  - 输出：通量图 → 引擎重算 → DVH 迭代展示（EvaluationPanel 复用）
- 明确排除：VMAT 直接孔径优化、鲁棒性优化、电子束
- 验收：合成病例优化后 PTV D95 ≥ 95% 处方、OAR 超量体素减少；迭代收敛曲线

### P4-M4 MPR / 四视口增强（约 1 周）

- **RTSTRUCT 轮廓断面交线**：3D 多边形与矢/冠状平面求交 → 折线绘制
  （几何纯函数 + 单测：三角形/多边形与轴对齐平面求交）
- **多平面勾画**：冠状/矢状画笔写同一 3D 掩模（体素坐标换算已有
  patientToImagePixel 管线）；勾画工具状态扩展 orientation
- 小项打包：剂量显示状态持久化（localStorage per study）、结构
  InterpretedType 手动覆盖（RTSTRUCT 导出用）

### P4-M5 互操作与产品化（约 1 周）

- **DICOM 网络 spike**：`dcmjs-dimse` 评估 → C-STORE SCU：把 M1 导出的
  RTSTRUCT/RTPLAN/RTDOSE 推送到 PACS/TPS（AE title/host/port 配置化）
  → UI：患者详情"发送到 PACS"入口 + 进度/结果
- **患者编辑**：PATCH /api/patients/:id（name/birthDate/gender）+ UI 表单
- **delta couch shift 记录**：审批通过时记录 couch shift 数值
  （peer_review_sessions 元数据扩展）
- 视需求小项：peer review 评论编辑、计划树展示增强

---

## 依赖与推荐顺序

```
M1 重采样 ──（独立）
M4 MPR增强 ──（独立）
M5 互操作 ──（独立，穿插）
M2 引擎v2 ──→ M3 逆向优化
```

推荐执行序：**M1 → M4 → M5 → M2 → M3**（M3 规模数月，前期穿插调研）。

---

## 明确不做（Phase 5+）

形变配准、Smart Segmentation、VMAT 直接孔径优化、4D 计划、RTM Workspaces、
Halcyon 工作流、PACS Query/Retrieve SCP（服务端）、电子束计划

---

## 风险

- **剂量精度基准**：外部参考仅 TEST849 一例——继续以相对校验定位，
  明确不声明临床精度；争取补充 1-2 个开放数据病例
- **M3 规模**：优化器是数月级工程——MVP（静态野 fluence）之外的一切
  （VMAT、鲁棒性、多等中心）进 Phase 5
- **dcmjs-dimse 成熟度**：先 1-2 天 spike 验证 C-STORE 可用性再排 UI
- **重采样质量**：三线性在骨/气界面会平滑——记录为已知限制，
  窗口/层面采样证据截图留档
