import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  TextField, 
  Button, 
  CircularProgress,
  IconButton,
  Divider,
  Card,
  CardContent,
  Grid,
  Chip
} from '@mui/material';
import { 
  Send as SendIcon,
  SmartToy as AssistantIcon,
  PersonOutline as UserIcon,
  DescriptionOutlined as DocumentIcon,
  ContentCopy as CopyIcon,
  RestartAlt as RestartIcon
} from '@mui/icons-material';
import { assistantService } from '../../services/api';

const AssistantChat = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: 'Ciao! Sono il tuo assistente virtuale per lo Studio Assistant Pro. Come posso aiutarti oggi?',
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([
    'Come posso compilare un modello F24?',
    'Quali sono le scadenze fiscali di questo mese?',
    'Genera una lettera di accoglienza per un nuovo cliente',
    'Spiega le novità sulla fatturazione elettronica'
  ]);
  
  const chatContainerRef = useRef(null);

  // Scroll automatico alla fine della chat quando vengono aggiunti nuovi messaggi
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Funzione per gestire l'invio di un messaggio
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    
    if (!input.trim()) return;
    
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);
    
    try {
      // In un'app reale, qui chiameresti il servizio API
      // const response = await assistantService.sendMessage(userMessage.content);
      // Simulazione risposta AI con ritardo
      setTimeout(() => {
        const assistantResponse = {
          id: Date.now() + 1,
          role: 'assistant',
          content: simulateAIResponse(userMessage.content),
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantResponse]);
        setLoading(false);
      }, 1500);
    } catch (err) {
      console.error('Errore nell\'invio del messaggio:', err);
      setError('Si è verificato un errore nella comunicazione con l\'assistente. Riprova.');
      setLoading(false);
    }
  };
  
  // Funzione per simulare una risposta dall'AI
  const simulateAIResponse = (userMessage) => {
    const message = userMessage.toLowerCase();
    
    if (message.includes('f24') || message.includes('compilare')) {
      return 'Per compilare un modello F24, devi seguire questi passaggi:\n\n1. Identifica i tributi da versare e i relativi codici tributo\n2. Compila la sezione Contribuente con i dati anagrafici\n3. Compila la sezione Erario indicando i codici tributo, periodi di riferimento e importi\n4. Calcola il totale a debito e il saldo finale\n\nVuoi che ti mostri un esempio pratico?';
    } else if (message.includes('scadenz')) {
      return 'Le principali scadenze fiscali di questo mese sono:\n\n- 16 Marzo: Versamento IVA mensile\n- 20 Marzo: Presentazione dichiarazioni Intrastat\n- 31 Marzo: Invio Certificazioni Uniche\n- 31 Marzo: Termine richiesta fornitore per spese detraibili\n\nVuoi che controlli altre scadenze specifiche?';
    } else if (message.includes('lettera') || message.includes('accoglienza')) {
      return 'Posso aiutarti a generare una lettera di accoglienza personalizzata. Per procedere avrei bisogno delle seguenti informazioni:\n\n1. Nome completo del cliente\n2. Tipologia di cliente (privato o azienda)\n3. Servizi sottoscritti\n4. Data di inizio collaborazione\n\nVuoi procedere con la compilazione?';
    } else if (message.includes('fatturazione') || message.includes('elettronica')) {
      return 'Le principali novità sulla fatturazione elettronica riguardano:\n\n- Estensione dell\'obbligo ai forfettari con ricavi oltre 25.000€\n- Nuovi controlli automatici sul contenuto delle fatture\n- Semplificazioni per l\'archiviazione digitale\n- Riduzione dei termini per la trasmissione delle fatture immediate\n\nDesideri approfondire uno di questi aspetti?';
    } else {
      return 'Grazie per la tua domanda. Come assistente specializzato in ambito fiscale e contabile, posso aiutarti con:\n\n- Informazioni su adempimenti fiscali\n- Supporto per la compilazione di moduli\n- Generazione di documenti personalizzati\n- Richiami di scadenze importanti\n\nPuoi formulare la tua domanda in modo più specifico così posso fornirti informazioni più precise?';
    }
  };

  // Funzione per selezionare un suggerimento
  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion);
  };
  
  // Funzione per pulire la chat
  const handleClearChat = () => {
    setMessages([
      {
        id: Date.now(),
        role: 'assistant',
        content: 'Ciao! Sono il tuo assistente virtuale per lo Studio Assistant Pro. Come posso aiutarti oggi?',
        timestamp: new Date().toISOString()
      }
    ]);
  };

  return (
    <Box sx={{ height: "calc(100vh - 120px)", display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" component="h1">
          Assistente AI
        </Typography>
        <IconButton color="primary" onClick={handleClearChat} title="Riavvia conversazione">
          <RestartIcon />
        </IconButton>
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      {/* Contenitore dei messaggi */}
      <Paper 
        ref={chatContainerRef}
        elevation={3} 
        className="chat-container"
        sx={{ 
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          p: 2,
          mb: 2,
          overflow: 'auto',
          backgroundColor: '#f9f9f9'
        }}
      >
        {messages.map((message) => (
          <Box
            key={message.id}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              mb: 2,
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%'
            }}
          >
            <Box
              sx={{
                display: 'flex',
                backgroundColor: message.role === 'user' ? '#e3f2fd' : 'white',
                borderRadius: 2,
                p: 2,
                boxShadow: 1
              }}
            >
              <Box sx={{ mr: 1 }}>
                {message.role === 'user' ? 
                  <UserIcon color="primary" /> : 
                  <AssistantIcon color="secondary" />}
              </Box>
              <Box>
                <Typography 
                  variant="body1" 
                  sx={{ whiteSpace: 'pre-wrap' }}
                >
                  {message.content}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </Typography>
              </Box>
            </Box>
          </Box>
        ))}
        
        {loading && (
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              alignSelf: 'flex-start',
              mb: 2,
              p: 2,
              borderRadius: 2,
              backgroundColor: 'white',
              boxShadow: 1
            }}
          >
            <AssistantIcon color="secondary" sx={{ mr: 1 }} />
            <CircularProgress size={20} sx={{ mr: 1 }} />
            <Typography>Elaborazione risposta...</Typography>
          </Box>
        )}
        
        {error && (
          <Typography 
            color="error" 
            sx={{ 
              p: 2, 
              borderRadius: 2, 
              backgroundColor: '#ffebee', 
              alignSelf: 'center',
              mb: 2
            }}
          >
            {error}
          </Typography>
        )}
      </Paper>
      
      {/* Suggerimenti */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Suggerimenti:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {suggestions.map((suggestion, index) => (
            <Chip 
              key={index}
              label={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              variant="outlined"
              color="primary"
              sx={{ mb: 1 }}
            />
          ))}
        </Box>
      </Box>
      
      {/* Input del messaggio */}
      <Paper 
        component="form" 
        onSubmit={handleSendMessage}
        className="message-input"
        sx={{
          p: '2px 4px',
          display: 'flex',
          alignItems: 'center'
        }}
        elevation={3}
      >
        <TextField
          fullWidth
          placeholder="Scrivi un messaggio..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          variant="outlined"
          disabled={loading}
          multiline
          maxRows={4}
          sx={{ ml: 1, flex: 1 }}
        />
        <IconButton 
          color="primary" 
          type="submit" 
          disabled={!input.trim() || loading}
          sx={{ p: '10px' }}
        >
          <SendIcon />
        </IconButton>
      </Paper>
    </Box>
  );
};

export default AssistantChat;