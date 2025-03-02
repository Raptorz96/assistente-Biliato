import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormHelperText,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  CardMedia,
  Divider,
  IconButton,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Description as DescriptionIcon,
  CloudDownload as DownloadIcon,
  ArrowBack as BackIcon,
  Visibility as PreviewIcon
} from '@mui/icons-material';
import { documentService, clientService } from '../../services/api';

// Componente per il passo 1: selezione template
const TemplateSelection = ({ templates, selectedTemplate, onSelect }) => {
  return (
    <Grid container spacing={3}>
      {templates.map((template) => (
        <Grid item xs={12} sm={6} md={4} key={template.id}>
          <Card 
            sx={{ 
              height: '100%', 
              cursor: 'pointer',
              border: selectedTemplate?.id === template.id ? '2px solid #1976d2' : 'none',
              boxShadow: selectedTemplate?.id === template.id ? '0 0 8px rgba(25, 118, 210, 0.5)' : 'inherit',
              transition: 'all 0.3s'
            }} 
            onClick={() => onSelect(template)}
          >
            <CardMedia
              component="img"
              height="140"
              image={template.thumbnail || `https://via.placeholder.com/300x140?text=${template.name}`}
              alt={template.name}
            />
            <CardContent>
              <Typography gutterBottom variant="h6">
                {template.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {template.description}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

// Componente per il passo 2: compilazione dati
const DocumentForm = ({ template, clients, formData, onChange, formErrors }) => {
  if (!template) return null;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Compila i dati per: {template.name}
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <FormControl fullWidth error={!!formErrors.clientId}>
            <InputLabel>Cliente</InputLabel>
            <Select
              name="clientId"
              value={formData.clientId || ''}
              onChange={onChange}
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
            {formErrors.clientId && (
              <FormHelperText>{formErrors.clientId}</FormHelperText>
            )}
          </FormControl>
        </Grid>

        {template.fields.map((field) => (
          <Grid item xs={12} sm={field.fullWidth ? 12 : 6} key={field.id}>
            <TextField
              fullWidth
              label={field.label}
              name={field.name}
              value={formData[field.name] || ''}
              onChange={onChange}
              required={field.required}
              error={!!formErrors[field.name]}
              helperText={formErrors[field.name] || field.helperText}
              multiline={field.multiline}
              rows={field.multiline ? 4 : 1}
              type={field.type || 'text'}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

// Componente per il passo 3: anteprima e download
const DocumentPreview = ({ template, formData }) => {
  return (
    <Box>
      <Alert severity="info" sx={{ mb: 3 }}>
        In un'applicazione reale, qui verrebbe mostrata un'anteprima del documento generato.
      </Alert>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {template.name}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        <Grid container spacing={2}>
          {Object.entries(formData).map(([key, value]) => {
            // Ignora il clientId che è solo un riferimento
            if (key === 'clientId') return null;
            
            const field = template.fields.find(f => f.name === key);
            if (!field) return null;
            
            return (
              <Grid item xs={12} key={key}>
                <Typography variant="subtitle2" color="text.secondary">
                  {field.label}:
                </Typography>
                <Typography variant="body1" paragraph>
                  {value || '-'}
                </Typography>
              </Grid>
            );
          })}
        </Grid>
      </Paper>
    </Box>
  );
};

// Componente principale per la generazione dei documenti
const DocumentGenerator = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generatedDocumentId, setGeneratedDocumentId] = useState(null);
  const navigate = useNavigate();

  const steps = ['Seleziona template', 'Compila dati', 'Anteprima e download'];

  useEffect(() => {
    // In un'app reale, faresti chiamate API per caricare i template e i clienti
    // fetchTemplates();
    // fetchClients();
    
    // Per questo esempio, usiamo dati mock
    const mockTemplates = [
      {
        id: 1,
        name: 'Lettera di Benvenuto',
        description: 'Lettera standard di benvenuto per nuovi clienti',
        format: 'docx',
        thumbnail: 'https://via.placeholder.com/300x140?text=Lettera+Benvenuto',
        fields: [
          { id: 1, name: 'intestazione', label: 'Intestazione', required: true },
          { id: 2, name: 'data', label: 'Data', type: 'date', required: true },
          { id: 3, name: 'oggetto', label: 'Oggetto', required: true },
          { id: 4, name: 'contenuto', label: 'Contenuto', multiline: true, fullWidth: true, required: true },
          { id: 5, name: 'firma', label: 'Firma', required: true }
        ]
      },
      {
        id: 2,
        name: 'Preventivo Servizi',
        description: 'Preventivo dettagliato per servizi di consulenza',
        format: 'pdf',
        thumbnail: 'https://via.placeholder.com/300x140?text=Preventivo',
        fields: [
          { id: 1, name: 'intestazione', label: 'Intestazione', required: true },
          { id: 2, name: 'data', label: 'Data', type: 'date', required: true },
          { id: 3, name: 'numeroPreventivo', label: 'Numero Preventivo', required: true },
          { id: 4, name: 'descrizioneServizi', label: 'Descrizione Servizi', multiline: true, fullWidth: true, required: true },
          { id: 5, name: 'importo', label: 'Importo (€)', type: 'number', required: true },
          { id: 6, name: 'note', label: 'Note Aggiuntive', multiline: true, fullWidth: true },
          { id: 7, name: 'validita', label: 'Validità (giorni)', type: 'number', required: true }
        ]
      },
      {
        id: 3,
        name: 'Conferma PEC',
        description: 'Conferma di invio PEC per comunicazioni ufficiali',
        format: 'pdf',
        thumbnail: 'https://via.placeholder.com/300x140?text=Conferma+PEC',
        fields: [
          { id: 1, name: 'destinatario', label: 'Destinatario', required: true },
          { id: 2, name: 'oggettoPEC', label: 'Oggetto PEC', required: true },
          { id: 3, name: 'dataInvio', label: 'Data Invio', type: 'date', required: true },
          { id: 4, name: 'numeroProtocollo', label: 'Numero Protocollo', required: true },
          { id: 5, name: 'note', label: 'Note', multiline: true }
        ]
      }
    ];
    
    const mockClients = [
      { id: 1, name: 'Mario Rossi' },
      { id: 2, name: 'Laura Bianchi' },
      { id: 3, name: 'Tecnoservice SRL' },
      { id: 4, name: 'Giuseppe Verdi' },
      { id: 5, name: 'Alimentari Buongusto SNC' }
    ];
    
    setTemplates(mockTemplates);
    setClients(mockClients);
  }, []);

  const handleNext = () => {
    if (activeStep === 0 && !selectedTemplate) {
      setError('Seleziona un template per continuare');
      return;
    }
    
    if (activeStep === 1) {
      // Validazione form prima di procedere
      const errors = {};
      
      if (!formData.clientId) {
        errors.clientId = 'Seleziona un cliente';
      }
      
      selectedTemplate.fields.forEach((field) => {
        if (field.required && !formData[field.name]) {
          errors[field.name] = 'Campo obbligatorio';
        }
      });
      
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }
    }
    
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setError(null);
    
    // Reset del form quando si cambia template
    setFormData({});
    setFormErrors({});
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Pulisci l'errore per questo campo quando viene modificato
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleGenerateDocument = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // In un'app reale, faresti una chiamata API
      // const response = await documentService.generateDocument(selectedTemplate.id, formData);
      // setGeneratedDocumentId(response.data.id);
      
      // Simuliamo il processo con un ritardo
      setTimeout(() => {
        setGeneratedDocumentId('doc_' + Date.now());
        setLoading(false);
      }, 2000);
    } catch (err) {
      console.error('Errore nella generazione del documento:', err);
      setError('Si è verificato un errore durante la generazione del documento. Riprova.');
      setLoading(false);
    }
  };

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <TemplateSelection 
            templates={templates} 
            selectedTemplate={selectedTemplate} 
            onSelect={handleTemplateSelect} 
          />
        );
      case 1:
        return (
          <DocumentForm 
            template={selectedTemplate} 
            clients={clients} 
            formData={formData} 
            onChange={handleFormChange} 
            formErrors={formErrors}
          />
        );
      case 2:
        return (
          <DocumentPreview 
            template={selectedTemplate} 
            formData={formData} 
          />
        );
      default:
        return 'Passo sconosciuto';
    }
  };

  return (
    <Box>
      <Button
        startIcon={<BackIcon />}
        onClick={() => navigate('/documents')}
        sx={{ mb: 3 }}
      >
        Torna alla lista documenti
      </Button>
      
      <Typography variant="h5" component="h1" gutterBottom>
        Generazione Documento
      </Typography>
      
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Paper sx={{ p: 3, mb: 3 }}>
        {getStepContent(activeStep)}
      </Paper>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
        <Button
          disabled={activeStep === 0}
          onClick={handleBack}
        >
          Indietro
        </Button>
        
        <Box>
          {activeStep === steps.length - 1 ? (
            <Box>
              {generatedDocumentId ? (
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  color="primary"
                  onClick={() => {/* In un'app reale, scarica il documento */}}
                >
                  Scarica Documento
                </Button>
              ) : (
                <Button
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={20} /> : <DescriptionIcon />}
                  color="primary"
                  onClick={handleGenerateDocument}
                  disabled={loading}
                >
                  {loading ? 'Generazione...' : 'Genera Documento'}
                </Button>
              )}
            </Box>
          ) : (
            <Button
              variant="contained"
              color="primary"
              onClick={handleNext}
            >
              Avanti
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default DocumentGenerator;