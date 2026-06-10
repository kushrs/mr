const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://ouadjfsxbydricflrdnv.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_NU3gk0zxH4vRcFhLy26IzA_AJcdqmyl';
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware to get user from auth header
const getUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized' });
  }
};

// Get user's watchlist
router.get('/', getUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('watchlist')
      .select('movie_id, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    res.status(500).json({ message: 'Error fetching watchlist' });
  }
});

// Add movie to watchlist
router.post('/add', getUser, async (req, res) => {
  try {
    const { movieId } = req.body;

    if (!movieId) {
      return res.status(400).json({ message: 'Movie ID is required' });
    }

    // Check if already in watchlist
    const { data: existing } = await supabase
      .from('watchlist')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('movie_id', movieId)
      .single();

    if (existing) {
      return res.status(400).json({ message: 'Movie already in watchlist' });
    }

    // Add to watchlist
    const { data, error } = await supabase
      .from('watchlist')
      .insert([{
        user_id: req.user.id,
        movie_id: movieId
      }]);

    if (error) throw error;

    res.json({ message: 'Movie added to watchlist', data });
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    res.status(500).json({ message: 'Error adding movie to watchlist' });
  }
});

// Remove movie from watchlist
router.delete('/remove/:movieId', getUser, async (req, res) => {
  try {
    const { movieId } = req.params;

    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('user_id', req.user.id)
      .eq('movie_id', movieId);

    if (error) throw error;

    res.json({ message: 'Movie removed from watchlist' });
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    res.status(500).json({ message: 'Error removing movie from watchlist' });
  }
});

// Check if movie is in watchlist
router.get('/check/:movieId', getUser, async (req, res) => {
  try {
    const { movieId } = req.params;

    const { data, error } = await supabase
      .from('watchlist')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('movie_id', movieId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json({ isInWatchlist: !!data });
  } catch (error) {
    console.error('Error checking watchlist:', error);
    res.status(500).json({ message: 'Error checking watchlist' });
  }
});

module.exports = router; 