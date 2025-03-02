import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Chip,
  Divider,
  Tab,
  Tabs
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { clientService } from '../../services/api';

const ClientDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    // In un'app reale, carica i dati dal backend
    // Qui usiamo solo un placeholder per la struttura
    setClient({
      id: parseInt(id),
      name: 'Cliente di Esempio',
      email: 'esempio@cliente.it',
      fiscalCode: 'ABCDEF00G00H000I',
      type: 'Privato',
      status: 'active'
    });
    setLoading(false);
  }, [id]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  if (loading) return <Typography>Caricamento dati cliente...</Typography>;
  if (error) return <Typography>Si è verificato un errore: {error}</Typography>;
  if (!client) return <Typography>Cliente non trovato</Typography>;

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/clients')}
        sx={{ mb: 3 }}
      >
        Torna alla lista clienti
      </Button>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="h5" component="h1" gutterBottom>
              {client.name}
            </Typography>
            <Chip
              label={client.status === 'active' ? 'Attivo' : 'Inattivo'}
              color={client.status === 'active' ? 'success' : 'error'}
              size="small"
              sx={{ mb: 2 }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Email:
            </Typography>
            <Typography variant="body1" paragraph>
              {client.email}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Codice Fiscale/P.IVA:
            </Typography>
            <Typography variant="body1" paragraph>
              {client.fiscalCode}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Tipologia:
            </Typography>
            <Typography variant="body1" paragraph>
              {client.type}
            </Typography>
          </Grid>
        </Grid>
        
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`/clients/${id}/edit`)}
            sx={{ mr: 1 }}
          >
            Modifica
          </Button>
        </Box>
      </Paper>
      
      <Paper sx={{ p: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Documenti" />
            <Tab label="Procedure" />
            <Tab label="Note" />
          </Tabs>
        </Box>
        
        {tabValue === 0 && (
          <Box>
            <Typography variant="body1">
              Qui saranno visualizzati i documenti del cliente.
            </Typography>
          </Box>
        )}
        
        {tabValue === 1 && (
          <Box>
            <Typography variant="body1">
              Qui saranno visualizzate le procedure del cliente.
            </Typography>
          </Box>
        )}
        
        {tabValue === 2 && (
          <Box>
            <Typography variant="body1">
              Qui saranno visualizzate le note relative al cliente.
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default ClientDetails;