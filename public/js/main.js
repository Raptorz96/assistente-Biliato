document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const chatMessages = document.getElementById('chat-messages');
  const userMessageInput = document.getElementById('user-message');
  const sendMessageBtn = document.getElementById('send-message');
  const addClientBtn = document.getElementById('add-client');
  const viewClientsBtn = document.getElementById('view-clients');
  const clientList = document.getElementById('client-list');
  const clientModal = document.getElementById('client-modal');
  const clientForm = document.getElementById('client-form');
  const closeModalBtns = document.querySelectorAll('.close-modal, .cancel-modal');
  
  // Chat functionality
  sendMessageBtn.addEventListener('click', sendMessage);
  userMessageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
  
  function sendMessage() {
    const message = userMessageInput.value.trim();
    if (message === '') return;
    
    // Add user message to chat
    addMessageToChat('user', message);
    
    // Clear input
    userMessageInput.value = '';
    
    // Simulate AI response (in a real app, this would call the API)
    setTimeout(() => {
      processUserMessage(message);
    }, 1000);
  }
  
  function addMessageToChat(sender, text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);
    
    const messagePara = document.createElement('p');
    messagePara.textContent = text;
    
    messageDiv.appendChild(messagePara);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  function processUserMessage(message) {
    // Simple keyword-based response system
    // In a real implementation, this would call the AI service
    let response;
    
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('ciao') || lowerMessage.includes('buongiorno') || lowerMessage.includes('salve')) {
      response = 'Buongiorno! Come posso aiutarti oggi?';
    } else if (lowerMessage.includes('onboarding') || lowerMessage.includes('nuovo cliente')) {
      response = 'Per iniziare l\'onboarding di un nuovo cliente, puoi utilizzare il pulsante "Aggiungi Cliente" sulla pagina principale. Ti guiderò attraverso il processo.';
    } else if (lowerMessage.includes('documenti') || lowerMessage.includes('generare')) {
      response = 'Posso aiutarti a generare diversi tipi di documenti per i tuoi clienti, come contratti di servizio, lettere di benvenuto, e moduli fiscali. Quale documento ti serve?';
    } else if (lowerMessage.includes('iva') || lowerMessage.includes('fiscale') || lowerMessage.includes('tasse')) {
      response = 'Per le questioni fiscali, ti consiglio di verificare le ultime normative. Posso fornirti informazioni generali, ma ricorda che ogni caso può avere delle specificità.';
    } else {
      response = 'Mi dispiace, non ho compreso completamente la tua richiesta. Puoi ripetere o formulare la domanda in modo diverso?';
    }
    
    addMessageToChat('assistant', response);
  }
  
  // Client modal functionality
  addClientBtn.addEventListener('click', () => {
    clientModal.style.display = 'block';
  });
  
  closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      clientModal.style.display = 'none';
    });
  });
  
  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === clientModal) {
      clientModal.style.display = 'none';
    }
  });
  
  // Client form submission
  clientForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form data
    const formData = new FormData(clientForm);
    const clientData = {};
    
    formData.forEach((value, key) => {
      clientData[key] = value;
    });
    
    try {
      // In a real app, this would send data to the server
      console.log('Submitting client data:', clientData);
      
      // Simulate API call
      await simulateApiCall(clientData);
      
      // Add success message to chat
      addMessageToChat('assistant', `Ho registrato il nuovo cliente "${clientData.name}". Vuoi che generi il pacchetto di onboarding?`);
      
      // Reset form and close modal
      clientForm.reset();
      clientModal.style.display = 'none';
      
    } catch (error) {
      console.error('Error creating client:', error);
      alert('Si è verificato un errore durante la creazione del cliente.');
    }
  });
  
  // View clients button functionality
  viewClientsBtn.addEventListener('click', async () => {
    try {
      // Toggle client list visibility
      if (clientList.classList.contains('hidden')) {
        clientList.classList.remove('hidden');
        
        // In a real app, this would fetch data from the server
        const clients = await simulateFetchClients();
        
        // Display clients
        renderClientList(clients);
      } else {
        clientList.classList.add('hidden');
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
      alert('Si è verificato un errore durante il recupero dei clienti.');
    }
  });
  
  function renderClientList(clients) {
    // Clear previous content
    clientList.innerHTML = '';
    
    if (clients.length === 0) {
      clientList.innerHTML = '<p>Nessun cliente trovato.</p>';
      return;
    }
    
    // Create table
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Nome</th>
          <th>Codice Fiscale</th>
          <th>Email</th>
          <th>Stato</th>
          <th>Azioni</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    
    const tbody = table.querySelector('tbody');
    
    // Add rows
    clients.forEach(client => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${client.name}</td>
        <td>${client.fiscalCode}</td>
        <td>${client.email}</td>
        <td>${client.onboardingStatus}</td>
        <td>
          <button class="btn-small view-client" data-id="${client._id}">Visualizza</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    clientList.appendChild(table);
    
    // Add event listeners to view buttons
    const viewButtons = document.querySelectorAll('.view-client');
    viewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const clientId = btn.getAttribute('data-id');
        alert(`Visualizzazione cliente con ID: ${clientId} (funzionalità da implementare)`);
      });
    });
  }
  
  // Simulated API functions (in a real app, these would be actual API calls)
  async function simulateApiCall(data) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ success: true, data });
      }, 800);
    });
  }
  
  async function simulateFetchClients() {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve([
          {
            _id: '1',
            name: 'Mario Rossi',
            fiscalCode: 'RSSMRA80A01H501U',
            email: 'mario.rossi@example.com',
            onboardingStatus: 'Completed'
          },
          {
            _id: '2',
            name: 'Acme SRL',
            fiscalCode: '12345678901',
            email: 'info@acme.example',
            onboardingStatus: 'In Progress'
          },
          {
            _id: '3',
            name: 'Giulia Bianchi',
            fiscalCode: 'BNCGLI75B45H501Y',
            email: 'giulia.bianchi@example.com',
            onboardingStatus: 'New'
          }
        ]);
      }, 800);
    });
  }
});