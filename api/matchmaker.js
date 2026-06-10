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

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    let contents = [];
    const isPost = req.method === 'POST';
    const body = isPost ? req.body : {};
    const params = isPost ? body : req.query;

    if (body.history && Array.isArray(body.history)) {
      contents = body.history;
    } else {
      // Build standard prompt from query parameters/body for backwards compatibility
      const { mood = '', genre = '', era = '', prompt = '' } = params;
      let userInstructions = '';
      if (prompt) {
        userInstructions = `The user has a custom request: "${prompt}".`;
      } else {
        userInstructions = `Recommend movies matching these criteria:
- Mood/Vibe: ${mood}
- Genre: ${genre}
- Era/Year range: ${era}`;
      }
      contents = [{ role: 'user', parts: [{ text: userInstructions }] }];
    }

    const systemInstruction = `
You are the "CinePrime AI Movie Curator", a friendly, witty, and highly knowledgeable movie expert AI.
Your goal is to have a one-to-one interactive chat with the user about movies, TV shows, suggestions, and recommendations.

When the user asks for movie or show recommendations, you must recommend a few titles (usually 3 to 6) and present them alongside your conversational response.
To do this, you must always format your response as a valid JSON object. Do not include markdown code block markers like \`\`\`json. The JSON object must contain:
1. "reply": A natural, engaging conversational response to the user. Explain why you chose these recommendations in 2-3 sentences.
2. "movies": An array of objects, each representing a recommended movie or TV show, with fields "title", "year", and "curator_insight". Set "curator_insight" to a short 1-sentence description explaining why this specific movie fits the requested mood/prompt. If you are just chatting or answering a general question without recommending specific movies, set "movies" to an empty array [].

Example format:
{
  "reply": "I've picked out three incredible mind-bending thrillers with massive twists that will keep you on the edge of your seat!",
  "movies": [
    { "title": "Shutter Island", "year": "2010", "curator_insight": "Nested dream worlds and psychological puzzles make this an absolute thriller masterpiece." },
    { "title": "The Prestige", "year": "2006", "curator_insight": "A brilliant rivalry of magicians that delivers a jaw-dropping final twist." }
  ]
}
`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: contents,
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

    // Clean up codeblock markers if model wrapped it in markdown
    responseText = responseText.trim();
    if (responseText.startsWith("```")) {
      responseText = responseText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    const parsed = JSON.parse(responseText);
    res.status(200).json(parsed);

  } catch (error) {
    console.error('Matchmaker API error:', error);
    // Fallback recommendation list in case of network/key failures
    const fallbackList = {
      reply: "I've scanned our movie database catalog. Here are some outstanding recommendations for you:",
      movies: [
        { title: "The Dark Knight", year: "2008", curator_insight: "A masterpiece of suspense and action that perfectly matches your thrill-seeking mood." },
        { title: "Inception", year: "2010", curator_insight: "A mind-bending journey through dreams that will leave you questioning reality." },
        { title: "Pulp Fiction", year: "1994", curator_insight: "Witty dialogue and non-linear storytelling that guarantees an entertaining night." },
        { title: "Interstellar", year: "2014", curator_insight: "A visually stunning cosmic odyssey packed with deep emotional weight." }
      ]
    };
    res.status(200).json(fallbackList);
  }
}
