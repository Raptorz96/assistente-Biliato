import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  Chip,
  TextField,
  InputAdornment,
  Grid,
  Card,
  CardContent,
  CardActions,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { procedureService } from '../../services/api';

const ProceduresList = () => {
  const [procedures, setProcedures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchProcedures();
  }, []);

  const fetchProcedures = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // In un'app reale, faresti una chiamata API
      // const response = await procedureService.getProcedures();
      // setProcedures(response.data);
      
      // Per questo esempio, utilizziamo dati mock
      const mockProcedures = [
        { 
          id: 1, 
          title: 'Chiusura Bilancio Annuale', 
          client: 'Tecnoservice SRL', 
          clientId: 3,
          status: 'completed',
          deadline: '2025-02-15',
          steps: [
            { id: 1, title: 'Raccolta documentazione', completed: true },
            { id: 2, title: 'Analisi preliminare', completed: true },
            { id: 3, title: 'Redazione bilancio', completed: true },
            { id: 4, title: 'Approvazione', completed: true }
          ]
        },
        { 
          id: 2, 
          title: 'Dichiarazione dei Redditi', 
          client: 'Mario Rossi', 
          clientId: 1,
          status: 'in_progress',
          deadline: '2025-04-30',
          steps: [
            { id: 1, title: 'Raccolta documentazione', completed: true },
            { id: 2, title: 'Verifica detrazioni', completed: true },
            { id: 3, title: 'Compilazione modello', completed: false },
            { id: 4, title: 'Invio telematico', completed: false }
          ]
        },
        { 
          id: 3, 
          title: 'Apertura Partita IVA', 
          client: 'Laura Bianchi', 
          clientId: 2,
          status: 'pending',
          deadline: '2025-03-15',
          steps: [
            { id: 1, title: 'Raccolta informazioni', completed: false },
            { id: 2, title: 'Scelta regime fiscale', completed: false },
            { id: 3, title: 'Richiesta apertura', completed: false },
            { id: 4, title: 'Registrazione', completed: false }
          ]
        },
        { 
          id: 4, 
          title: 'Verifica Trimestrale IVA', 
          client: 'Alimentari Buongusto SNC', 
          clientId: 5,
          status: 'in_progress',
          deadline: '2025-03-10',
          steps: [
            { id: 1, title: 'Raccolta fatture', completed: true },
            { id: 2, title: 'Registrazione documenti', completed: true },
            { id: 3, title: 'Calcolo IVA', completed: false },
            { id: 4, title: 'Predisposizione versamento', completed: false }
          ]
        }
      ];
      
      setProcedures(mockProcedures);
    } catch (err) {
      console.error('Errore nel caricamento delle procedure:', err);
      setError('Si è verificato un errore nel caricamento delle procedure. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleDeleteProcedure = async (id) => {
    // In un'app reale, faresti una chiamata API
    // await procedureService.deleteProcedure(id);
    // Quindi ricaricheresti l'elenco
    // fetchProcedures();
    
    // Per questo esempio, rimuoviamo dall'array locale
    setProcedures(procedures.filter(procedure => procedure.id !== id));
  };

  // Filtra i risultati in base al termine di ricerca
  const filteredProcedures = procedures.filter(procedure => {
    const searchTermLower = searchTerm.toLowerCase();
    return (
      procedure.title.toLowerCase().includes(searchTermLower) ||
      procedure.client.toLowerCase().includes(searchTermLower)
    );
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'in_progress':
        return <ScheduleIcon color="primary" />;
      case 'pending':
        return <WarningIcon color="warning" />;
      default:
        return <AssignmentIcon />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed':
        return 'Completata';
      case 'in_progress':
        return 'In corso';
      case 'pending':
        return 'In attesa';
      default:
        return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'primary';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getCompletedSteps = (procedure) => {
    return procedure.steps.filter(step => step.completed).length;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1">
          Procedure
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => navigate('/procedures/new')}
        >
          Nuova Procedura
        </Button>
      </Box>

      <Paper sx={{ mb: 3, p: 2 }}>
        <TextField
          fullWidth
          placeholder="Cerca procedure per titolo o cliente..."
          variant="outlined"
          value={searchTerm}
          onChange={handleSearch}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : filteredProcedures.length === 0 ? (
        <Alert severity="info">
          Nessuna procedura trovata
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {filteredProcedures.map((procedure) => (
            <Grid item xs={12} md={6} key={procedure.id}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" component="div">
                      {procedure.title}
                    </Typography>
                    <Chip
                      label={getStatusLabel(procedure.status)}
                      color={getStatusColor(procedure.status)}
                      size="small"
                      icon={getStatusIcon(procedure.status)}
                    />
                  </Box>
                  
                  <Typography color="text.secondary" gutterBottom>
                    Cliente: {procedure.client}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Scadenza: {procedure.deadline}
                  </Typography>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      Avanzamento: {getCompletedSteps(procedure)}/{procedure.steps.length} step completati
                    </Typography>
                    <List dense>
                      {procedure.steps.map((step) => (
                        <ListItem key={step.id}>
                          <ListItemIcon>
                            {step.completed ? 
                              <CheckCircleIcon color="success" /> : 
                              <ScheduleIcon color="action" />}
                          </ListItemIcon>
                          <ListItemText 
                            primary={step.title}
                            sx={{
                              textDecoration: step.completed ? 'line-through' : 'none',
                              color: step.completed ? 'text.secondary' : 'text.primary'
                            }}  
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </CardContent>
                <CardActions>
                  <Button 
                    size="small" 
                    onClick={() => navigate(`/procedures/${procedure.id}/edit`)}
                  >
                    Modifica
                  </Button>
                  <Button 
                    size="small" 
                    color="error"
                    onClick={() => handleDeleteProcedure(procedure.id)}
                  >
                    Elimina
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default ProceduresList;