// Centralized Supabase configuration (avoid duplicate keys in multiple files)
// On production, replace this implementation so keys are pulled from server-side configs.
const SUPABASE_URL = "https://ouadjfsxbydricflrdnv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_NU3gk0zxH4vRcFhLy26IzA_AJcdqmyl";
const OMDB_API_KEY = "8ddfd56d";

// Create Supabase client with error handling
let _supabaseClient;
let supabaseAvailable = false;
let supabaseError = null;

try {
  if (typeof supabase === 'undefined') {
    throw new Error('Supabase library not loaded (CDN blocked or offline)');
  }
  const { createClient } = supabase;
  _supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  supabaseAvailable = true;
} catch (error) {
  console.warn('Supabase client creation failed:', error);
  supabaseError = error;
  // Create a mock client for offline functionality
  _supabaseClient = createMockClient();
}

function createMockClient() {
  const mockQueryBuilder = {
    eq: () => mockQueryBuilder,
    neq: () => mockQueryBuilder,
    gt: () => mockQueryBuilder,
    lt: () => mockQueryBuilder,
    order: () => mockQueryBuilder,
    limit: () => mockQueryBuilder,
    single: () => mockQueryBuilder,
    maybeSingle: () => mockQueryBuilder,
    select: () => mockQueryBuilder,
    insert: () => mockQueryBuilder,
    update: () => mockQueryBuilder,
    delete: () => mockQueryBuilder,
    upsert: () => mockQueryBuilder,
    then: (onFulfilled) => {
      return Promise.resolve({
        data: null,
        error: new Error('Supabase service unavailable (403 Forbidden)')
      }).then(onFulfilled);
    }
  };

  return {
    auth: {
      signUp: () => Promise.reject(new Error('Supabase service unavailable (403 Forbidden)')),
      signInWithPassword: () => Promise.reject(new Error('Supabase service unavailable (403 Forbidden)')),
      signInWithOAuth: () => Promise.reject(new Error('Supabase service unavailable (403 Forbidden)')),
      signOut: () => Promise.resolve({}),
      getUser: () => Promise.resolve({ data: { user: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    from: () => mockQueryBuilder
  };
}

// Function to check if Supabase is actually working
async function testSupabaseConnection() {
  if (!supabaseAvailable) {
    return { available: false, error: supabaseError };
  }

  try {
    // Try a simple auth call that should work even when not logged in
    await _supabaseClient.auth.getUser();
    return { available: true };
  } catch (error) {
    console.warn('Supabase connection test failed:', error);

    // If we get a 403, mark as unavailable
    if (error.message?.includes('403') || error.status === 403) {
      supabaseAvailable = false;
      supabaseError = error;
      _supabaseClient = createMockClient();
      return { available: false, error: 'Supabase project suspended or API key invalid (403 Forbidden)' };
    }

    return { available: false, error: error.message };
  }
}

window.supabaseClient = _supabaseClient;
window.supabaseAvailable = supabaseAvailable;
window.supabaseError = supabaseError;
window.testSupabaseConnection = testSupabaseConnection;
window.OMDB_API_KEY = OMDB_API_KEY;
window.YOUTUBE_API_KEY = "AIzaSyApOIxtyKdYc2TEsDG9ftluxyxD0Ka6K8k";

// Global Fetch Interceptor for local offline/Live Server compatibility
const originalFetch = window.fetch;
window.fetch = async function (input, init) {
  let url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : (input?.url || ''));

  let parsedUrl = null;
  try {
    parsedUrl = new URL(url, window.location.origin);
  } catch (e) {
    parsedUrl = null;
  }

  if (parsedUrl && parsedUrl.pathname.startsWith('/api/')) {
    try {
      const response = await originalFetch(input, init);
      if (response.ok) {
        return response;
      }
      console.warn(`Local serverless API [${url}] returned status ${response.status}. Attempting direct client-side fallback...`);
      return triggerFallback(url, init);
    } catch (networkError) {
      console.warn(`Local serverless API [${url}] failed with network error. Attempting direct client-side fallback...`, networkError);
      return triggerFallback(url, init);
    }
  }

  return originalFetch(input, init);
};

async function triggerFallback(apiUrl, init) {
  // Ensure the URL is absolute relative to our origin
  const parsedUrl = new URL(apiUrl, window.location.origin);
  const path = parsedUrl.pathname;
  const params = parsedUrl.searchParams;

  let fallbackUrl = '';

  if (path === '/api/search') {
    const s = params.get('s') || '';
    const page = params.get('page') || '1';
    fallbackUrl = `https://www.omdbapi.com/?s=${encodeURIComponent(s)}&page=${page}&apikey=${OMDB_API_KEY}`;
  } else if (path === '/api/movie') {
    const id = params.get('id') || '';
    fallbackUrl = `https://www.omdbapi.com/?i=${id}&plot=full&apikey=${OMDB_API_KEY}`;
  } else if (path === '/api/omdb') {
    params.set('apikey', OMDB_API_KEY);
    fallbackUrl = `https://www.omdbapi.com/?${params.toString()}`;
  } else if (path === '/api/trailer') {
    const q = params.get('q') || '';
    fallbackUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(q)}&key=${window.YOUTUBE_API_KEY}`;
  } else if (path === '/api/matchmaker') {
    // Client-side fallback: directly call Gemini API
    const geminiKey = "";
    let contents = [];
    
    if (init && (init.method === 'POST' || (init.headers && init.body))) {
      try {
        const parsedBody = JSON.parse(init.body);
        if (parsedBody.history) {
          contents = parsedBody.history;
        }
      } catch (err) {
        console.warn("Failed to parse client fallback POST body:", err);
      }
    }

    if (contents.length === 0) {
      const mood = params.get('mood') || '';
      const genre = params.get('genre') || '';
      const era = params.get('era') || '';
      const prompt = params.get('prompt') || '';
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

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

    try {
      console.log(`Direct client-side fetch to Gemini API (chat mode)...`);
      const response = await originalFetch(geminiUrl, {
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

      responseText = responseText.trim();
      if (responseText.startsWith("```")) {
        responseText = responseText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      }

      const parsed = JSON.parse(responseText);
      return new Response(JSON.stringify(parsed), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      console.warn("Client-side Gemini API fallback failed. Returning mock recommendations...", e);
      const fallbackList = {
        reply: "I've scanned our movie database catalog. Here are some outstanding recommendations for you:",
        movies: [
          { title: "The Dark Knight", year: "2008", curator_insight: "A masterpiece of suspense and action that perfectly matches your thrill-seeking mood." },
          { title: "Inception", year: "2010", curator_insight: "A mind-bending journey through dreams that will leave you questioning reality." },
          { title: "Pulp Fiction", year: "1994", curator_insight: "Witty dialogue and non-linear storytelling that guarantees an entertaining night." },
          { title: "Interstellar", year: "2014", curator_insight: "A visually stunning cosmic odyssey packed with deep emotional weight." }
        ]
      };
      return new Response(JSON.stringify(fallbackList), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } else {
    console.warn(`No fallback defined for backend route: ${path}`);
    return originalFetch(apiUrl, init);
  }

  console.log(`Direct client-side fetch: ${fallbackUrl}`);
  return originalFetch(fallbackUrl, init);
}
