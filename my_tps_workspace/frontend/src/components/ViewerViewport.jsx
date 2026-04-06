import { Box, Typography } from '@mui/material';

export default function ViewerViewport({ elementRef, imageId, activeTool }) {
  return (
    <Box
      ref={elementRef}
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: '#07111f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Typography variant="body2" color="text.secondary">
        DICOM viewer — imaging stack loads in Phase 2
      </Typography>
    </Box>
  );
}
