import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  Chip,
  TextField,
  InputAdornment,
  TablePagination,
  Stack,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  FileDownload as DownloadIcon,
  Visibility as ViewIcon,
  Description as DescriptionIcon,
  PictureAsPdf as PdfIcon,
  TextSnippet as DocxIcon,
  InsertDriveFile as FileIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { documentService } from '../../services/api';

const DocumentsList = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // In un'app reale, faresti una chiamata API
      // const response = await documentService.getDocuments();
      // setDocuments(response.data);
      
      // Per questo esempio, utilizziamo dati mock
      const mockDocuments = [
        { id: 1, name: 'Lettera di Benvenuto - Mario Rossi', client: 'Mario Rossi', clientId: 1, type: 'Lettera', format: 'pdf', size: '124 KB', createdAt: '2025-02-02' },
        { id: 2, name: 'Preventivo Servizi - Tecnoservice SRL', client: 'Tecnoservice SRL', clientId: 3, type: 'Preventivo', format: 'docx', size: '78 KB', createdAt: '2025-02-05' },
        { id: 3, name: 'Dichiarazione IVA - Alimentari Buongusto', client: 'Alimentari Buongusto SNC', clientId: 5, type: 'Dichiarazione', format: 'pdf', size: '256 KB', createdAt: '2025-02-10' },
        { id: 4, name: 'Contratto Consulenza - Laura Bianchi', client: 'Laura Bianchi', clientId: 2, type: 'Contratto', format: 'pdf', size: '198 KB', createdAt: '2025-02-15' },
        { id: 5, name: 'Comunicazione Scadenze - Giuseppe Verdi', client: 'Giuseppe Verdi', clientId: 4, type: 'Comunicazione', format: 'docx', size: '45 KB', createdAt: '2025-02-20' },
        { id: 6, name: 'Procedura Contabilità - Tecnoservice SRL', client: 'Tecnoservice SRL', clientId: 3, type: 'Procedura', format: 'pdf', size: '320 KB', createdAt: '2025-02-25' },
        { id: 7, name: 'Analisi Bilancio - Alimentari Buongusto', client: 'Alimentari Buongusto SNC', clientId: 5, type: 'Analisi', format: 'docx', size: '175 KB', createdAt: '2025-03-01' }
      ];
      
      setDocuments(mockDocuments);
    } catch (err) {
      console.error('Errore nel caricamento dei documenti:', err);
      setError('Si è verificato un errore nel caricamento dei documenti. Riprova.');
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

  const handleDeleteDocument = async (id) => {
    // In un'app reale, faresti una chiamata API
    // await documentService.deleteDocument(id);
    // Quindi ricaricheresti l'elenco
    // fetchDocuments();
    
    // Per questo esempio, rimuoviamo dall'array locale
    setDocuments(documents.filter(doc => doc.id !== id));
  };

  // Filtra i risultati in base al termine di ricerca
  const filteredDocuments = documents.filter(doc => {
    const searchTermLower = searchTerm.toLowerCase();
    return (
      doc.name.toLowerCase().includes(searchTermLower) ||
      doc.client.toLowerCase().includes(searchTermLower) ||
      doc.type.toLowerCase().includes(searchTermLower)
    );
  });

  // Pagina i risultati
  const paginatedDocuments = filteredDocuments.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const getFormatIcon = (format) => {
    switch (format.toLowerCase()) {
      case 'pdf':
        return <PdfIcon color="error" />;
      case 'docx':
        return <DocxIcon color="primary" />;
      default:
        return <FileIcon />;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1">
          Documenti
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => navigate('/documents/generate')}
        >
          Genera Nuovo Documento
        </Button>
      </Box>

      <Paper sx={{ mb: 3, p: 2 }}>
        <TextField
          fullWidth
          placeholder="Cerca per nome, cliente o tipo..."
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
              <TableCell>Nome Documento</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Formato</TableCell>
              <TableCell>Dimensione</TableCell>
              <TableCell>Data Creazione</TableCell>
              <TableCell align="center">Azioni</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress size={40} sx={{ my: 2 }} />
                </TableCell>
              </TableRow>
            ) : paginatedDocuments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  Nessun documento trovato
                </TableCell>
              </TableRow>
            ) : (
              paginatedDocuments.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {getFormatIcon(doc.format)}
                      <Typography sx={{ ml: 1 }}>{doc.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{doc.client}</TableCell>
                  <TableCell>{doc.type}</TableCell>
                  <TableCell>
                    <Chip 
                      label={doc.format.toUpperCase()} 
                      color={doc.format.toLowerCase() === 'pdf' ? 'error' : 'primary'} 
                      size="small" 
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{doc.size}</TableCell>
                  <TableCell>{doc.createdAt}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <IconButton 
                        size="small" 
                        color="primary" 
                        title="Visualizza"
                      >
                        <ViewIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="success" 
                        title="Scarica"
                      >
                        <DownloadIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="error" 
                        title="Elimina" 
                        onClick={() => handleDeleteDocument(doc.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredDocuments.length}
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

export default DocumentsList;