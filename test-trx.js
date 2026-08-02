import axios from 'axios';
axios.post('https://api.gurkynet.my.id/api/v1/transactions', {}, {
  headers: { 'Accept': 'application/json' }
}).then(r => console.log(r.data)).catch(err => console.log(err.response?.data || err.message));
