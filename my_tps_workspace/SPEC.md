# Milestone 3: RT Structure and RT Dose Parsing/Visualization

## Overview
Implement RT Structure (RTSTRUCT) and RT Dose (RTDOSE) parsing and visualization for the Treatment Planning System.

## Backend

### 1. RT Structure Parsing Service (`backend/src/services/rtStructService.js`)

#### Function: `parseRTStruct(filePath)`
- **Input**: Path to RTSTRUCT DICOM file
- **Output**: Object containing:
  ```javascript
  {
    roiSequence: [
      {
        roiNumber: Number,
        roiName: String,
        displayColor: { r: Number, g: Number, b: Number }
      }
    ],
    contourSequence: [
      {
        referencedSOPInstanceUID: String,
        referencedROINumber: Number,
        contourData: [Number], // x,y,z triplets flattened
        displayColor: { r: Number, g: Number, b: Number }
      }
    ]
  }
  ```
- **DICOM Tags**:
  - `3006,0020` (Structure Set ROI Sequence)
  - `3006,0022` (ROI Number)
  - `3006,0026` (ROI Name)
  - `3006,002A` (ROI Display Color)
  - `3006,0039` (ROI Contour Sequence)
  - `3006,0040` (Contour Sequence)
  - `3006,0050` (Contour Data)
  - `3006,0016` (Contour Image Sequence)
  - `3006,0084` (Referenced ROI Number)
  - `0008,1155` (Referenced SOP Instance UID)

#### Function: `getContoursForSlice(contourSequence, sopInstanceUID)`
- **Input**: contourSequence array, SOP Instance UID of CT slice
- **Output**: Array of contours for that slice

### 2. RT Dose Parsing Service (`backend/src/services/rtDoseService.js`)

#### Function: `parseRTDose(filePath)`
- **Input**: Path to RTDOSE DICOM file
- **Output**: Object containing:
  ```javascript
  {
    doseGridScaling: Number,
    doseType: String,
    doseUnits: String,
    rows: Number,
    columns: Number,
    numberOfFrames: Number,
    pixelData: Float32Array,
    imagePosition: { x: Number, y: Number, z: Number },
    imageOrientation: { x: [Number], y: [Number], z: [Number] },
    pixelSpacing: { i: Number, j: Number }
  }
  ```
- **DICOM Tags**:
  - `7fe0,0010` (Pixel Data)
  - `3004,000e` (Dose Grid Scaling)
  - `3004,0004` (Dose Type)
  - `3004,0008` (Dose Units)
  - `0028,0010` (Rows)
  - `0028,0011` (Columns)
  - `0028,0008` (Number of Frames)
  - `0020,0032` (Image Position Patient)
  - `0020,0037` (Image Orientation Patient)
  - `0028,0030` (Pixel Spacing)

#### Function: `calculateDoseValue(pixelData, doseGridScaling)`
- **Input**: Raw pixel data, dose grid scaling factor
- **Output**: Array of calculated dose values in cGy

### 3. API Routes

#### `backend/src/routes/rtStruct.js`
- `GET /api/rtstruct/:fileId` - Parse RTSTRUCT and return ROI/contour data

#### `backend/src/routes/rtDose.js`
- `GET /api/rtstruct/:fileId` - Parse RTDOSE and return dose data

## Frontend

### 1. RT Structure Hook (`frontend/src/hooks/useRTStructures.js`)

```javascript
// State shape
{
  structures: [
    {
      roiNumber: Number,
      roiName: String,
      color: { r: Number, g: Number, b: Number },
      visible: Boolean,
      contours: [
        {
          sopInstanceUID: String,
          points: [{ x: Number, y: Number, z: Number }]
        }
      ]
    }
  ],
  selectedStructureId: Number | null,
  isLoading: Boolean,
  error: String | null
}

// Hook API
{
  loadStructures: (rtStructFileId) => Promise<void>,
  toggleStructureVisibility: (roiNumber) => void,
  selectStructure: (roiNumber) => void,
  getStructuresForSlice: (sopInstanceUID) => Array
}
```

### 2. RT Dose Hook (`frontend/src/hooks/useRTDose.js`)

```javascript
// State shape
{
  doseData: {
    grid: Float32Array, // 3D dose grid [z][y][x]
    maxDose: Number,
    doseGridScaling: Number,
    doseType: String,
    doseUnits: String
  } | null,
  visible: Boolean,
  opacity: Number, // 0-1
  threshold: Number, // percentage for isodose lines
  isLoading: Boolean,
  error: String | null
}

// Hook API
{
  loadDose: (rtDoseFileId) => Promise<void>,
  setVisible: (visible) => void,
  setOpacity: (opacity) => void,
  setThreshold: (threshold) => void
}
```

### 3. StructurePanel Component (`frontend/src/components/StructurePanel.jsx`)

- **Props**: `structures`, `onToggle`, `onSelect`
- **Features**:
  - List all ROIs with color indicators
  - Checkbox to toggle visibility
  - Click to select/highlight structure
  - Shows ROI name and number

### 4. DosePanel Component (`frontend/src/components/DosePanel.jsx`)

- **Props**: `doseData`, `visible`, `opacity`, `threshold`, `onVisibleChange`, `onOpacityChange`, `onThresholdChange`
- **Features**:
  - Toggle dose overlay visibility
  - Opacity slider (0-100%)
  - Threshold slider for isodose display
  - Display max dose value

### 5. RT Structure Overlay (`frontend/src/components/RTStructureOverlay.jsx`)

- **Props**: `contours`, `visibleStructures`, `element`
- **Renders**: SVG overlay on Cornerstone viewport with ROI contours
- **Features**:
  - Converts contour data to canvas coordinates
  - Draws semi-transparent fills with colored strokes
  - Only renders visible structures

### 6. RT Dose Overlay (`frontend/src/components/RTDoseOverlay.jsx`)

- **Props**: `doseData`, `ctImage`, `visible`, `opacity`, `threshold`
- **Renders**: Dose heatmap on Cornerstone viewport
- **Features**:
  - Transforms dose coordinates to CT space
  - Applies color map (amber gradient)
  - Respects opacity setting

## Coordinate Transformation

### Structure Contour Coordinate Transform
```
Voxel (mm) → Pixel Index → Canvas Coordinates
```

### Dose Coordinate Transform Chain
```
Dose Grid (i,j,k) → Patient (via Dose→Patient matrix)
                  → CT (via inverse CT→Patient matrix)
                  → Pixel (via CT image position/orientation)
```

## Edge Cases

1. **Empty RTSTRUCT**: No ROIs defined - return empty arrays
2. **Missing Display Color**: Default to white `{ r: 255, g: 255, b: 255 }`
3. **Empty Contour Data**: Skip contours with no points
4. **Dose Grid Mismatch**: Dose and CT must overlap for display
5. **Invalid Pixel Data**: Handle 16-bit and 32-bit dose data
6. **Z-slice Not in Dose**: Return empty array for slices outside dose grid

## Test Data

Location: `/home/cfq/AI/vibe-coding/rt-tps-tmp/test_data/patient1/`
- `RS.*.dcm` - RT Structure file
- `RD.*.dcm` - RT Dose file
- `CT.*.dcm` - CT image files (multiple slices)

## Acceptance Criteria

1. Backend can parse RTSTRUCT files and extract ROI/contour data
2. Backend can parse RTDOSE files and extract dose grid
3. Frontend can load and display structure overlay on CT slices
4. Frontend can load and display dose heatmap overlay on CT slices
5. Structure visibility can be toggled per-ROI
6. Dose overlay opacity and threshold are adjustable
7. All error paths are handled gracefully
8. 80%+ test coverage on parsing logic
