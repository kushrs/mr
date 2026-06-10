// Vercel API function for OMDB movie search
const fetch = require('node-fetch');

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { s, type = 'movie', page = 1 } = req.query;

    if (!s) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const apiKey = process.env.OMDB_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const response = await fetch(
      `https://www.omdbapi.com/?s=${encodeURIComponent(s)}&type=${type}&page=${page}&apikey=${apiKey}`
    );

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('OMDB API error:', error);
    res.status(500).json({ error: 'Failed to fetch movie data' });
  }
}