import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Divider,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { clientService } from '../../services/api';

const ClientsList = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const navigate = useNavigate();

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // In un'app reale, faresti una chiamata API
      // const response = await clientService.getClients();
      // setClients(response.data);
      
      // Per questo esempio, utilizziamo dati mock
      const mockClients = [
        { id: 1, name: 'Mario Rossi', email: 'mario.rossi@example.com', type: 'Privato', fiscalCode: 'RSSMRA80A01H501Z', status: 'active', createdAt: '2025-01-15' },
        { id: 2, name: 'Laura Bianchi', email: 'laura.bianchi@example.com', type: 'Privato', fiscalCode: 'BNCLRA75B02H501Y', status: 'active', createdAt: '2025-01-20' },
        { id: 3, name: 'Tecnoservice SRL', email: 'info@tecnoservice.it', type: 'Azienda', fiscalCode: '12345678901', status: 'active', createdAt: '2025-01-25' },
        { id: 4, name: 'Giuseppe Verdi', email: 'g.verdi@example.com', type: 'Privato', fiscalCode: 'VRDGPP82C03H501X', status: 'inactive', createdAt: '2025-02-01' },
        { id: 5, name: 'Alimentari Buongusto SNC', email: 'ordini@buongusto.it', type: 'Azienda', fiscalCode: '98765432101', status: 'active', createdAt: '2025-02-05' },
        { id: 6, name: 'Anna Neri', email: 'a.neri@example.com', type: 'Privato', fiscalCode: 'NRENNA79D04H501W', status: 'active', createdAt: '2025-02-10' },
        { id: 7, name: 'Studio Legale Bianchi', email: 'info@studiobianchi.it', type: 'Azienda', fiscalCode: '56789012345', status: 'active', createdAt: '2025-02-15' },
        { id: 8, name: 'Roberto Marrone', email: 'r.marrone@example.com', type: 'Privato', fiscalCode: 'MRRRBT77E05H501V', status: 'active', createdAt: '2025-02-20' },
        { id: 9, name: 'Immobiliare Casa Bella', email: 'contatti@casabella.it', type: 'Azienda', fiscalCode: '45678901234', status: 'active', createdAt: '2025-02-25' },
        { id: 10, name: 'Francesca Rossi', email: 'f.rossi@example.com', type: 'Privato', fiscalCode: 'RSSFNC81F06H501U', status: 'pending', createdAt: '2025-03-01' },
        { id: 11, name: 'Ristorante Il Gusto', email: 'prenotazioni@ilgusto.it', type: 'Azienda', fiscalCode: '34567890123', status: 'active', createdAt: '2025-03-01' },
        { id: 12, name: 'Marco Blu', email: 'm.blu@example.com', type: 'Privato', fiscalCode: 'BLUMRC76G07H501T', status: 'active', createdAt: '2025-03-01' }
      ];
      
      setClients(mockClients);
    } catch (err) {
      console.error('Errore nel caricamento dei clienti:', err);
      setError('Si è verificato un errore nel caricamento dei clienti. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setPage(0);
  };

  const handleViewClient = (id) => {
    navigate(`/clients/${id}`);
  };

  const handleEditClient = (id) => {
    navigate(`/clients/${id}/edit`);
  };

  const handleDeleteClient = async (id) => {
    // In un'app reale, faresti una chiamata API
    // await clientService.deleteClient(id);
    // Quindi ricaricheresti l'elenco
    // fetchClients();
    
    // Per questo esempio, rimuoviamo dall'array locale
    setClients(clients.filter(client => client.id !== id));
  };

  // Filtra i risultati in base al termine di ricerca
  const filteredClients = clients.filter(client => {
    const searchTermLower = searchTerm.toLowerCase();
    return (
      client.name.toLowerCase().includes(searchTermLower) ||
      client.email.toLowerCase().includes(searchTermLower) ||
      client.fiscalCode.toLowerCase().includes(searchTermLower)
    );
  });

  // Pagina i risultati
  const paginatedClients = filteredClients.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active':
        return 'Attivo';
      case 'inactive':
        return 'Inattivo';
      case 'pending':
        return 'In attesa';
      default:
        return status;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1">
          Clienti
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => navigate('/clients/new')}
        >
          Nuovo Cliente
        </Button>
      </Box>

      <Paper sx={{ mb: 3, p: 2 }}>
        <TextField
          fullWidth
          placeholder="Cerca per nome, email o codice fiscale..."
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

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Tipologia</TableCell>
              <TableCell>Codice Fiscale/P.IVA</TableCell>
              <TableCell>Stato</TableCell>
              <TableCell>Data Registrazione</TableCell>
              <TableCell align="center">Azioni</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  Caricamento...
                </TableCell>
              </TableRow>
            ) : paginatedClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  Nessun cliente trovato
                </TableCell>
              </TableRow>
            ) : (
              paginatedClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>{client.name}</TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>{client.type}</TableCell>
                  <TableCell>{client.fiscalCode}</TableCell>
                  <TableCell>
                    <Chip 
                      label={getStatusLabel(client.status)} 
                      color={getStatusColor(client.status)} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>{client.createdAt}</TableCell>
                  <TableCell align="center">
                    <IconButton 
                      size="small" 
                      color="primary" 
                      onClick={() => handleViewClient(client.id)}
                      title="Visualizza dettagli"
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      color="secondary" 
                      onClick={() => handleEditClient(client.id)}
                      title="Modifica"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      color="error" 
                      onClick={() => handleDeleteClient(client.id)}
                      title="Elimina"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredClients.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Righe per pagina:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} di ${count}`}
        />
      </TableContainer>
    </Box>
  );
};

export default ClientsList;