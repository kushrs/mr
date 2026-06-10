const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testAPI() {
  try {
    // Test registration
    console.log('Testing registration...');
    const registerResponse = await axios.post(`${API_URL}/auth/register`, {
      email: 'test@example.com',
      password: 'password123',
      username: 'testuser',
      fullname: 'Test User'
    });
    console.log('Registration successful:', registerResponse.data);

    // Test login
    console.log('\nTesting login...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'test@example.com',
      password: 'password123'
    });
    console.log('Login successful:', loginResponse.data);

    const token = loginResponse.data.token;

    // Test getting profile
    console.log('\nTesting get profile...');
    const profileResponse = await axios.get(`${API_URL}/users/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Profile retrieved:', profileResponse.data);

    // Test adding movie to watchlist
    console.log('\nTesting add to watchlist...');
    const watchlistResponse = await axios.post(`${API_URL}/watchlist/add`, 
      { movieId: 'tt0111161' },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('Watchlist updated:', watchlistResponse.data);

  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testAPI(); 