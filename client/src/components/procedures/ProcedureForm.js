import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  IconButton,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon
} from '@mui/icons-material';
import { procedureService, clientService } from '../../services/api';

const ProcedureForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;
  
  const [formData, setFormData] = useState({
    title: '',
    clientId: '',
    deadline: '',
    description: '',
    status: 'pending',
    steps: []
  });
  
  const [newStep, setNewStep] = useState('');
  const [clients, setClients] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  
  useEffect(() => {
    fetchClients();
    
    if (isEditMode) {
      fetchProcedure();
    }
  }, [id]);
  
  const fetchClients = async () => {
    try {
      // In un'app reale, faresti una chiamata API
      // const response = await clientService.getClients();
      // setClients(response.data);
      
      // Per questo esempio, utilizziamo dati mock
      const mockClients = [
        { id: 1, name: 'Mario Rossi' },
        { id: 2, name: 'Laura Bianchi' },
        { id: 3, name: 'Tecnoservice SRL' },
        { id: 4, name: 'Giuseppe Verdi' },
        { id: 5, name: 'Alimentari Buongusto SNC' }
      ];
      
      setClients(mockClients);
    } catch (err) {
      console.error('Errore nel caricamento dei clienti:', err);
    }
  };
  
  const fetchProcedure = async () => {
    setLoading(true);
    
    try {
      // In un'app reale, faresti una chiamata API
      // const response = await procedureService.getProcedure(id);
      // setFormData(response.data);
      
      // Per questo esempio, utilizziamo dati mock
      setFormData({
        title: 'Procedura di Esempio',
        clientId: 3,
        deadline: '2025-03-15',
        description: 'Descrizione della procedura di esempio',
        status: 'in_progress',
        steps: [
          { id: 1, title: 'Raccolta documentazione', completed: true },
          { id: 2, title: 'Analisi preliminare', completed: true },
          { id: 3, title: 'Compilazione moduli', completed: false },
          { id: 4, title: 'Invio pratica', completed: false }
        ]
      });
    } catch (err) {
      console.error('Errore nel caricamento della procedura:', err);
      setSubmitError('Si è verificato un errore nel caricamento della procedura');
    } finally {
      setLoading(false);
    }
  };
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Pulisci l'errore per questo campo quando viene modificato
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };
  
  const handleStepChange = (stepId) => (e) => {
    const { checked } = e.target;
    setFormData(prev => {
      const updatedSteps = prev.steps.map(step => 
        step.id === stepId ? { ...step, completed: checked } : step
      );
      return { ...prev, steps: updatedSteps };
    });
  };
  
  const handleAddStep = () => {
    if (!newStep.trim()) return;
    
    const newStepObj = {
      id: Date.now(), // Usiamo timestamp come ID temporaneo
      title: newStep.trim(),
      completed: false
    };
    
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, newStepObj]
    }));
    
    setNewStep('');
  };
  
  const handleDeleteStep = (stepId) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter(step => step.id !== stepId)
    }));
  };
  
  const validate = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Il titolo è obbligatorio';
    }
    
    if (!formData.clientId) {
      newErrors.clientId = 'Il cliente è obbligatorio';
    }
    
    if (!formData.deadline) {
      newErrors.deadline = 'La scadenza è obbligatoria';
    }
    
    return newErrors;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validazione
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setLoading(true);
    setSubmitError(null);
    
    try {
      // In un'app reale, invia i dati al backend
      // if (isEditMode) {
      //   await procedureService.updateProcedure(id, formData);
      // } else {
      //   await procedureService.createProcedure(formData);
      // }
      
      // Simuliamo il completamento con un ritardo
      setTimeout(() => {
        navigate('/procedures');
      }, 1000);
    } catch (err) {
      console.error('Errore nel salvataggio della procedura:', err);
      setSubmitError('Si è verificato un errore nel salvataggio della procedura');
      setLoading(false);
    }
  };
  
  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/procedures')}
        sx={{ mb: 3 }}
      >
        Torna alla lista procedure
      </Button>
      
      <Typography variant="h5" component="h1" gutterBottom>
        {isEditMode ? 'Modifica Procedura' : 'Nuova Procedura'}
      </Typography>
      
      {submitError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {submitError}
        </Alert>
      )}
      
      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Titolo Procedura"
                name="title"
                value={formData.title}
                onChange={handleChange}
                error={!!errors.title}
                helperText={errors.title}
                required
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required error={!!errors.clientId}>
                <InputLabel>Cliente</InputLabel>
                <Select
                  name="clientId"
                  value={formData.clientId}
                  onChange={handleChange}
                  label="Cliente"
                >
                  <MenuItem value="">
                    <em>Seleziona un cliente</em>
                  </MenuItem>
                  {clients.map((client) => (
                    <MenuItem key={client.id} value={client.id}>
                      {client.name}
                    </MenuItem>
                  ))}
                </Select>
                {errors.clientId && <Typography variant="caption" color="error">{errors.clientId}</Typography>}
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Scadenza"
                name="deadline"
                type="date"
                value={formData.deadline}
                onChange={handleChange}
                error={!!errors.deadline}
                helperText={errors.deadline}
                required
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Descrizione"
                name="description"
                value={formData.description}
                onChange={handleChange}
                multiline
                rows={4}
              />
            </Grid>
            
            {isEditMode && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Stato</InputLabel>
                  <Select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    label="Stato"
                  >
                    <MenuItem value="pending">In attesa</MenuItem>
                    <MenuItem value="in_progress">In corso</MenuItem>
                    <MenuItem value="completed">Completata</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
            
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Step della procedura
              </Typography>
              
              <List>
                {formData.steps.map((step, index) => (
                  <React.Fragment key={step.id}>
                    <ListItem>
                      <ListItemIcon>
                        <DragIcon />
                      </ListItemIcon>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={step.completed}
                            onChange={handleStepChange(step.id)}
                            color="primary"
                          />
                        }
                        label=""
                        sx={{ mr: 0 }}
                      />
                      <ListItemText
                        primary={step.title}
                        sx={{
                          textDecoration: step.completed ? 'line-through' : 'none',
                          color: step.completed ? 'text.secondary' : 'text.primary'
                        }}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleDeleteStep(step.id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < formData.steps.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
              
              <Box sx={{ display: 'flex', mt: 2 }}>
                <TextField
                  fullWidth
                  label="Nuovo step"
                  value={newStep}
                  onChange={(e) => setNewStep(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddStep();
                    }
                  }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleAddStep}
                  disabled={!newStep.trim()}
                  startIcon={<AddIcon />}
                  sx={{ ml: 1 }}
                >
                  Aggiungi
                </Button>
              </Box>
            </Grid>
          </Grid>
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
            <Button
              variant="contained"
              color="primary"
              type="submit"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
              disabled={loading}
            >
              {loading ? 'Salvataggio...' : 'Salva'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default ProcedureForm;