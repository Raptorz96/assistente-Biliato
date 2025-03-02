import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Box, 
  Grid, 
  Card, 
  CardContent, 
  CardActions, 
  Typography, 
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip
} from '@mui/material';
import { 
  People as PeopleIcon, 
  Description as DocumentIcon, 
  Assignment as TaskIcon,
  SmartToy as AssistantIcon,
  Notifications as NotificationIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { clientService, procedureService, documentService } from '../services/api';

const Dashboard = () => {
  const [stats, setStats] = useState({
    clients: 0,
    procedures: 0,
    documents: 0
  });
  const [recentClients, setRecentClients] = useState([]);
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // In un'applicazione reale, questi dati verrebbero caricati dal backend
    // Per ora, popoliamo con dati demo
    setStats({
      clients: 42,
      procedures: 18,
      documents: 76
    });

    setRecentClients([
      { id: 1, name: 'Mario Rossi', type: 'Privato', date: '2025-02-28' },
      { id: 2, name: 'Tecnoservice SRL', type: 'Azienda', date: '2025-02-26' },
      { id: 3, name: 'Laura Bianchi', type: 'Privato', date: '2025-02-25' }
    ]);

    setRecentDocuments([
      { id: 1, name: 'Dichiarazione IVA Gennaio', client: 'Tecnoservice SRL', date: '2025-02-28' },
      { id: 2, name: 'Lettera Accoglienza', client: 'Laura Bianchi', date: '2025-02-26' },
      { id: 3, name: 'Preventivo Consulenza', client: 'Mario Rossi', date: '2025-02-24' }
    ]);

    setUpcomingTasks([
      { id: 1, title: 'Invio F24', deadline: '2025-03-15', priority: 'alta' },
      { id: 2, title: 'Verifica Fatture', deadline: '2025-03-10', priority: 'media' },
      { id: 3, title: 'Aggiornamento Registri', deadline: '2025-03-05', priority: 'bassa' }
    ]);

    // In un'app reale, faresti chiamate API, ad esempio:
    // async function fetchData() {
    //   try {
    //     const clientsRes = await clientService.getClients();
    //     const proceduresRes = await procedureService.getProcedures();
    //     const documentsRes = await documentService.getDocuments();
    //     // Aggiorna lo stato con i dati dal backend
    //   } catch (error) {
    //     console.error('Errore nel caricamento dei dati dashboard:', error);
    //   }
    // }
    // fetchData();
  }, []);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Benvenuto, {currentUser?.name || 'Utente'}
      </Typography>

      {/* Statistiche principali */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <PeopleIcon color="primary" sx={{ fontSize: 40 }} />
              <Typography variant="h5" component="div">
                {stats.clients}
              </Typography>
              <Typography color="text.secondary">
                Clienti totali
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={() => navigate('/clients')}>Visualizza tutti</Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <DocumentIcon color="primary" sx={{ fontSize: 40 }} />
              <Typography variant="h5" component="div">
                {stats.documents}
              </Typography>
              <Typography color="text.secondary">
                Documenti generati
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={() => navigate('/documents')}>Visualizza tutti</Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <TaskIcon color="primary" sx={{ fontSize: 40 }} />
              <Typography variant="h5" component="div">
                {stats.procedures}
              </Typography>
              <Typography color="text.secondary">
                Procedure attive
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={() => navigate('/procedures')}>Visualizza tutte</Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>

      {/* Contenuto principale */}
      <Grid container spacing={4}>
        {/* Clienti recenti */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Clienti recenti
              </Typography>
              <Button 
                variant="outlined" 
                startIcon={<AddIcon />}
                onClick={() => navigate('/clients/new')}
              >
                Nuovo
              </Button>
            </Box>
            <List>
              {recentClients.map((client) => (
                <React.Fragment key={client.id}>
                  <ListItem button onClick={() => navigate(`/clients/${client.id}`)}>
                    <ListItemIcon>
                      <PeopleIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary={client.name} 
                      secondary={`${client.type} - Aggiunto: ${client.date}`}
                    />
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Documenti recenti */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Documenti recenti
              </Typography>
              <Button 
                variant="outlined" 
                startIcon={<AddIcon />}
                onClick={() => navigate('/documents/generate')}
              >
                Nuovo
              </Button>
            </Box>
            <List>
              {recentDocuments.map((doc) => (
                <React.Fragment key={doc.id}>
                  <ListItem button onClick={() => navigate(`/documents/${doc.id}`)}>
                    <ListItemIcon>
                      <DocumentIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary={doc.name} 
                      secondary={`Cliente: ${doc.client} - Generato: ${doc.date}`}
                    />
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Attività in scadenza */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Attività in scadenza
            </Typography>
            <List>
              {upcomingTasks.map((task) => (
                <React.Fragment key={task.id}>
                  <ListItem>
                    <ListItemIcon>
                      <NotificationIcon color={
                        task.priority === 'alta' ? 'error' : 
                        task.priority === 'media' ? 'warning' : 'info'
                      } />
                    </ListItemIcon>
                    <ListItemText 
                      primary={task.title} 
                      secondary={`Scadenza: ${task.deadline}`}
                    />
                    <Chip 
                      label={task.priority} 
                      color={
                        task.priority === 'alta' ? 'error' : 
                        task.priority === 'media' ? 'warning' : 'info'
                      } 
                      size="small"
                    />
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Assistente AI */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Assistente AI
              </Typography>
              <Button 
                variant="contained" 
                color="primary"
                startIcon={<AssistantIcon />}
                onClick={() => navigate('/assistant')}
              >
                Consulta assistente
              </Button>
            </Box>
            <Typography paragraph>
              Il tuo assistente AI è pronto ad aiutarti con:
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon>
                  <AssistantIcon />
                </ListItemIcon>
                <ListItemText primary="Ricerca informazioni fiscali" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <AssistantIcon />
                </ListItemIcon>
                <ListItemText primary="Generazione documenti personalizzati" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <AssistantIcon />
                </ListItemIcon>
                <ListItemText primary="Analisi documenti contabili" />
              </ListItem>
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;