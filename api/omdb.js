const fetch = require('node-fetch');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.OMDB_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OMDB API key not configured' });
    }

    const query = new URLSearchParams(req.query).toString();
    const response = await fetch(`https://www.omdbapi.com/?${query}&apikey=${apiKey}`);
    const data = await response.json();

    res.status(200).json(data);
  } catch (error) {
    console.error('OMDB proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch OMDb data' });
  }
}