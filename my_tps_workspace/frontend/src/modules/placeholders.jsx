import { Box, Typography, Button, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import { Brush, Flip, Compare, Calculate } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

/**
 * Placeholder modules for future TPS functional zones. Each explains its
 * scope and links back to the available modules.
 */
function Placeholder({ icon, title, phase, items, onBack }) {
  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'mono' }}>
        {title}
      </Typography>
      <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>
        Planned for {phase}. Scope:
      </Typography>
      <List dense disablePadding sx={{ pl: 1 }}>
        {items.map(item => (
          <ListItem key={item} disablePadding>
            <ListItemIcon sx={{ minWidth: 20 }}>
              <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'text.disabled' }} />
            </ListItemIcon>
            <ListItemText
              primary={item}
              primaryTypographyProps={{ variant: 'caption', sx: { fontSize: '0.65rem', color: 'text.secondary' } }}
            />
          </ListItem>
        ))}
      </List>
      <Button size="small" variant="outlined" onClick={onBack} sx={{ fontSize: '0.65rem', mt: 1 }}>
        Back to Images
      </Button>
    </Box>
  );
}

export function RegistrationModule() {
  const navigate = useNavigate();
  return (
    <Placeholder
      icon={<Compare />}
      title="REGISTRATION (图像匹配)"
      phase="Phase 2"
      items={[
        'Multi-series support (MR/PET with CT)',
        'Rigid & deformable registration',
        'Fused overlay display',
      ]}
      onBack={() => navigate(`/viewer/${window.location.pathname.split('/').pop()}`)}
    />
  );
}

export function EbrtModule() {
  const navigate = useNavigate();
  return (
    <Placeholder
      icon={<Flip />}
      title="EXTERNAL BEAM PLANNING (外照射)"
      phase="Phase 2+"
      items={[
        'Beam arrangement & geometry',
        'MLC / fluence editing',
        'Dose calculation integration',
      ]}
      onBack={() => navigate(`/viewer/${window.location.pathname.split('/').pop()}`)}
    />
  );
}

export function EvaluationModule() {
  const navigate = useNavigate();
  return (
    <Placeholder
      icon={<Calculate />}
      title="PLAN EVALUATION (计划评估)"
      phase="Phase 2"
      items={[
        'DVH computation & display',
        'Plan review & approval flow',
        'Dose statistics per structure',
      ]}
      onBack={() => navigate(`/viewer/${window.location.pathname.split('/').pop()}`)}
    />
  );
}

export function ContouringComingSoon() {
  return (
    <Placeholder
      icon={<Brush />}
      title="CONTOURING"
      phase="in development"
      items={['Loading contouring workspace…']}
      onBack={() => {}}
    />
  );
}
