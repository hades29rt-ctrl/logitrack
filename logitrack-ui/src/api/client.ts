import axios from 'axios';

// L'URL de votre API FastAPI que nous avons lancée tout à l'heure
const client = axios.create({
  baseURL: 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default client;