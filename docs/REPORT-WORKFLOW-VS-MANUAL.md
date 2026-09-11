# 外照射工作流截图 vs Eclipse 手册插图 比对报告（2026-09-12）

方法：用 e2e harness 驱动浏览器逐步执行计划工作流并截图（`frontend/e2e/shots/cmp-*.png`、
`m-workflow-*.png`），与手册《Eclipse 17.0 Basic Planning Operations》对应插图
（`docs/test01-extract/pages*/`，按需从 test01.pdf 补提取 pages-extra/）逐一比对。

| # | 步骤 | 手册插图 | 我们的截图 | 比对结论 |
|---|---|---|---|---|
| 1 | 选择/新建 Course | p194 Select Course 对话框（列表+Course details ID/Intent/Status+New Course…）；p196 新 Course 入列 | cmp-1-new-plan.png：New Plan 表单内 Course 下拉 + "New course" 行内新建，创建后自动选中 | ✅ 等价（Course 列表/新建/选中一致）。差异：Course 属性 Intent/Status/Start/Completed 未做（p195） |
| 2 | New Plan / 处方剂量 | 手册 S4：Plan Details 向导（Rx 在后续页）；Eclipse 处方=剂量+分次 | cmp-1-new-plan.png：Plan name/Course/Machine/Energy/Target structure/Dose (Gy)/Fractions/Normalization/算法/网格 全字段表单 | ✅ 处方=剂量+分次+每分次自动计算，字段覆盖 |
| 3 | 设置治疗中心 | p210-211：Eclipse 自动将等中心置于靶区体积中心；可在任意视口拖动移动；等中心以 X/Y/Z 坐标显示 | cmp-3-isocenter.png：设置治疗中心对话框（X/Y/Z 坐标 + "使用靶区质心(PTV1)" 一键），计划创建时已自动置于质心 | ⚠️ 部分——自动置于靶区中心 ✅、坐标显示/编辑 ✅、**视口内拖动等中心 ✗**（坐标对话框替代） |
| 4 | 添加射野/调整野参数 | 手册 S4 "Adjusting field parameters manually"（Beams 文件夹、野参数表） | cmp-2-mlc-editor.png 上部：BEAMS(1) 表（#/Type/Gantry°/Wdg°/W）+ ADD BEAM 表单（Type/Gantry°/Collimator°/Couch°/Field X,Y/Wedge°/Bolus） | ✅ 参数集覆盖（机架/准直器/床/野界/楔形/Bolus/权重） |
| 5 | Add an MLC to Field | p233：右键野 → New MLC…；后续页叶位编辑 | cmp-2-mlc-editor.png：手动野 "初始化 MLC（从射野边界）" → 2 CPs chip → CP 滑条 + BEV 叶编辑器（60 对叶片，可拖拽、Save CP MLC） | ✅ 能力等价（交互形态不同：Eclipse 网格对话框 vs 我们 BEV 画布+滑条）；导入野 166 CPs 亦可用 |
| 6 | 处方快编 | （手册内为 Plan Details 属性） | 截图流程内：处方行 62 Gy / 30 fx + 编辑/存 | ✅ |
| 7 | 优化目标值 / 优化过程 / 实时 DVH | **本卷手册无 IMRT/VMAT 优化章节（无插图可对照）**——该内容在 Eclipse IMRT/VMAT 分册 | cmp-4-optimization.png / m-workflow-optimization.png：OPTIMIZATION 区（目标值表：结构/类型/剂量%/体积%，可增删存）、开始优化（原型）→ 迭代计数 30/30、MU 读数、DVO 逐目标收敛读数（95%→94.5%、107%→106.5%）、参考剂量 DVH 图 | ⚠️ 结构覆盖；**原型模拟（未接逆向优化器，已明示）**；优化窗口细节（DVO 分辨率、多目标权重/优先级）需 IMRT 分册对照 |
| 8 | 剂量计算界面 | p271：Calculation Models/Options（算法、网格 0.1–0.5cm、异质修正、组织材料） | m-workflow-complete.png：Engine 选择（v2 发散+ρ+MLC / v1）+ Calc Dose（busy+耗时）+ 网格尺寸在建计划表单 + Calculation Models tab（Info 窗口可编辑） | ✅ 要素齐（算法/网格/异质/计算进度与结果 RTDOSE #96） |
| 9 | Normalization | p282-284 Plan Normalization 对话框 | PLAN OPS Normalize（10 模式）+ Apply（busy 态） | ✅（前一审计已全模式实测） |

## 与手册流程的真实差距（按影响排序）

1. **优化器本体缺失**（M3）：优化运行为原型模拟，DVO 读数是演示性收敛——界面骨架已按
   Eclipse Objectives+DVH+迭代布局，接 M3 时替换循环即可。
2. **等中心视口拖拽**：手册支持在任意视口拖动等中心；我们目前是对话框坐标输入 +
   靶区质心一键。可在 MPR/四视口 marker 上补拖拽。
3. **Course 属性**（Intent/Status/Start/Completed）：后端有 intent 字段，UI 未展示。
4. **DRR / Setup Fields / Field Alignment**：计划内后置项，本轮范围外。

## 证据文件

- 我们的截图：`frontend/e2e/shots/cmp-1-new-plan.png`、`cmp-2-mlc-editor.png`、
  `cmp-3-isocenter.png`、`cmp-4-optimization.png`、`m-workflow-optimization.png`、
  `m-workflow-complete.png`
- 手册插图：`docs/test01-extract/pages/`（原 18 张）、`pages-extra/`（本轮补提取
  p209–214、p232–234、p269–272）

结论：六步工作流全部可走通且与手册流程逻辑一致；两处交互形态差异（等中心拖拽、
Course 属性）与优化器本体（M3）为已知差距。
