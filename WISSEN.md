
### EBRT 模块（M4）与 RTPLAN 解析要点（2026-09）
- **Varian RTPLAN 标签互换**：(300A,011A)/(300A,011C) 相对标准互换（011A 应为
  LeafJawPositions DS、011C 应为 BLD Position SQ），且 dcmjs 字典恰好同错——
  naturalize 后按关键字取值对本类 Varian 文件正确；标准兼容文件会落在相反
  关键字上，取值代码需双形态兼容（getSequence 尝试多个关键字名）。
- **标签号易混**：NumberOfControlPoints 是 (300A,0110)；(300A,0080) 是
  NumberOfBeams。IsocenterPosition 是 (300A,012C)；(300A,0120) 是
  BeamLimitingDeviceAngle、(300A,0122) 是 PatientSupportAngle。
- **几何只在 CP0**：静态机架野的全部几何（gantry/jaw/iso/床角）在 CP0；
  末 CP 仅叶位与 meterset。末 CP gantry ≠ CP0 gantry 即弧治疗（gantryArc）。
- **IEC 61217 机架角→源位置**（共面床角 0）：
  `S = iso + SAD·[sin θ, −cos θ, 0]`（0°=前野从上方入射，90°=病人左侧）。
  共面 + 准直器 0° 时，光野矩形整体位于等中心层面（z=iso.z）内，
  轴位 CT 可直接描画矩形 + 中心轴。
- **本测试计划**：9 野 DMLC IMRT（滑窗），6MV，33fx，Rx 73.92Gy@PGTVnx，
  gantry 0..320 步进 40°，单等中心，MLCX 60 对叶位，166 CP/野。
