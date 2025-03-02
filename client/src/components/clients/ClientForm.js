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
  FormHelperText,
  Alert,
  CircularProgress
} from '@mui/material';
import { Save as SaveIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { clientService } from '../../services/api';

const ClientForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    fiscalCode: '',
    type: 'Privato',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'Italia',
    notes: '',
    status: 'active'
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  
  useEffect(() => {
    if (isEditMode) {
      fetchClient();
    }
  }, [id]);
  
  const fetchClient = async () => {
    setLoading(true);
    
    try {
      // In un'app reale, fetcha i dati dal backend
      // const response = await clientService.getClient(id);
      // setFormData(response.data);
      
      // Per questo esempio, utilizziamo dati demo
      setFormData({
        name: 'Cliente di Esempio',
        email: 'esempio@cliente.it',
        fiscalCode: 'ABCDEF00G00H000I',
        type: 'Privato',
        phone: '3491234567',
        address: 'Via Roma 123',
        city: 'Milano',
        postalCode: '20100',
        country: 'Italia',
        notes: 'Note di esempio',
        status: 'active'
      });
    } catch (err) {
      console.error('Errore nel caricamento dei dati cliente:', err);
      setSubmitError('Si è verificato un errore nel caricamento del cliente');
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
  
  const validate = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Il nome è obbligatorio';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'L\'email è obbligatoria';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email non valida';
    }
    
    if (!formData.fiscalCode.trim()) {
      newErrors.fiscalCode = 'Il codice fiscale/P.IVA è obbligatorio';
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
      //   await clientService.updateClient(id, formData);
      // } else {
      //   await clientService.createClient(formData);
      // }
      
      // Simuliamo il completamento con un ritardo
      setTimeout(() => {
        navigate('/clients');
      }, 1000);
    } catch (err) {
      console.error('Errore nel salvataggio del cliente:', err);
      setSubmitError('Si è verificato un errore nel salvataggio del cliente');
      setLoading(false);
    }
  };
  
  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/clients')}
        sx={{ mb: 3 }}
      >
        Torna alla lista clienti
      </Button>
      
      <Typography variant="h5" component="h1" gutterBottom>
        {isEditMode ? 'Modifica Cliente' : 'Nuovo Cliente'}
      </Typography>
      
      {submitError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {submitError}
        </Alert>
      )}
      
      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nome/Ragione Sociale"
                name="name"
                value={formData.name}
                onChange={handleChange}
                error={!!errors.name}
                helperText={errors.name}
                required
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required error={!!errors.type}>
                <InputLabel>Tipologia</InputLabel>
                <Select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  label="Tipologia"
                >
                  <MenuItem value="Privato">Privato</MenuItem>
                  <MenuItem value="Azienda">Azienda</MenuItem>
                  <MenuItem value="Libero Professionista">Libero Professionista</MenuItem>
                </Select>
                {errors.type && <FormHelperText>{errors.type}</FormHelperText>}
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                error={!!errors.email}
                helperText={errors.email}
                required
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Telefono"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                error={!!errors.phone}
                helperText={errors.phone}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Codice Fiscale/P.IVA"
                name="fiscalCode"
                value={formData.fiscalCode}
                onChange={handleChange}
                error={!!errors.fiscalCode}
                helperText={errors.fiscalCode}
                required
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Indirizzo"
                name="address"
                value={formData.address}
                onChange={handleChange}
                error={!!errors.address}
                helperText={errors.address}
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Città"
                name="city"
                value={formData.city}
                onChange={handleChange}
                error={!!errors.city}
                helperText={errors.city}
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="CAP"
                name="postalCode"
                value={formData.postalCode}
                onChange={handleChange}
                error={!!errors.postalCode}
                helperText={errors.postalCode}
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Paese"
                name="country"
                value={formData.country}
                onChange={handleChange}
                error={!!errors.country}
                helperText={errors.country}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Note"
                name="notes"
                value={formData.notes}
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
                    <MenuItem value="active">Attivo</MenuItem>
                    <MenuItem value="inactive">Inattivo</MenuItem>
                    <MenuItem value="pending">In attesa</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
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

export default ClientForm;