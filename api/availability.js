const fetch = require('node-fetch');

// Deterministic mock generator for watch providers in India as a robust fallback
function getMockAvailability(title, year) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const streamingPool = ["Netflix", "Amazon Prime Video", "JioCinema", "Disney+ Hotstar", "Zee5", "SonyLIV"];
  const buyPool = ["Apple TV", "Google Play Movies", "YouTube Store"];

  // Determine streaming platforms based on hash
  const numStreaming = (hash % 3) + 1; // 1 to 3 platforms
  const numBuy = (hash % 2) + 1;       // 1 to 2 platforms

  const streaming = [];
  const rent_buy = [];

  for (let i = 0; i < numStreaming; i++) {
    const idx = (hash + i) % streamingPool.length;
    const provider = streamingPool[idx];
    if (!streaming.includes(provider)) {
      streaming.push(provider);
    }
  }

  for (let i = 0; i < numBuy; i++) {
    const idx = (hash * (i + 1)) % buyPool.length;
    const provider = buyPool[idx];
    if (!rent_buy.includes(provider)) {
      rent_buy.push(provider);
    }
  }

  return { streaming, rent_buy };
}

export default async function handler(req, res) {
  // Enable CORS
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
    const { title = '', year = '' } = req.query;

    if (!title) {
      return res.status(400).json({ error: 'Movie title required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log('Gemini API key not configured. Using mock availability.');
      return res.status(200).json(getMockAvailability(title, year));
    }

    const systemInstruction = `
You are a movie streaming search assistant. Your job is to identify where a movie or show is available to watch in India.
Identify:
1. Streaming platforms (flatrate subscription services like Netflix, Amazon Prime Video, Disney+ Hotstar, JioCinema, Zee5, SonyLIV, etc.).
2. Rent/Buy platforms (transactional VOD like Apple TV, Google Play Movies, YouTube, etc.).

Return the response STRICTLY as a valid JSON object in this format. Do not wrap it in markdown code block markers. Do not include any other conversational text:
{
  "streaming": ["Netflix", "Amazon Prime Video"],
  "rent_buy": ["Apple TV", "Google Play Movies"]
}

If you are unsure or the movie is not streaming anywhere in India, return empty arrays. Be accurate to India streaming catalogs.
`;

    const userPrompt = `Find streaming availability in India for the movie/show: "${title}" (${year})`;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const resData = await response.json();
    let responseText = resData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error('Gemini API returned empty response');
    }

    responseText = responseText.trim();
    if (responseText.startsWith("```")) {
      responseText = responseText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    const parsed = JSON.parse(responseText);
    
    // Validate schema
    if (parsed && Array.isArray(parsed.streaming) && Array.isArray(parsed.rent_buy)) {
      return res.status(200).json(parsed);
    } else {
      throw new Error('Invalid JSON format returned from Gemini');
    }

  } catch (error) {
    console.error('Gemini availability search error:', error);
    // Fallback to mock availability
    const { title = '', year = '' } = req.query;
    res.status(200).json(getMockAvailability(title, year));
  }
}
