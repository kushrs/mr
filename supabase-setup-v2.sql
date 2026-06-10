-- CinePrime - Supabase Feature Suite Setup (Version 2)
-- Execute this SQL in your Supabase SQL Editor to enable Quiz Leaderboards and Social Collaborative Watchlists!

-- 1. CLEANUP (Drop tables if they exist)
DROP TABLE IF EXISTS shared_watchlist_items CASCADE;
DROP TABLE IF EXISTS shared_rooms CASCADE;
DROP TABLE IF EXISTS quiz_leaderboard CASCADE;

-- 2. CREATE QUIZ LEADERBOARD
CREATE TABLE quiz_leaderboard (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CREATE COLLABORATIVE WATCHLIST ROOMS
CREATE TABLE shared_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CREATE SHARED WATCHLIST ITEMS (WITH VOTING)
CREATE TABLE shared_watchlist_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES shared_rooms(id) ON DELETE CASCADE,
  movie_id TEXT NOT NULL,
  votes INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_room_movie UNIQUE (room_id, movie_id)
);

-- 5. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE quiz_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_watchlist_items ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES FOR QUIZ LEADERBOARD
CREATE POLICY "Allow public read access to leaderboard" ON quiz_leaderboard
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to leaderboard" ON quiz_leaderboard
  FOR INSERT WITH CHECK (true);

-- 7. RLS POLICIES FOR COLLABORATIVE WATCHLIST ROOMS
CREATE POLICY "Allow public access to read rooms" ON shared_rooms
  FOR SELECT USING (true);

CREATE POLICY "Allow public access to create rooms" ON shared_rooms
  FOR INSERT WITH CHECK (true);

-- 8. RLS POLICIES FOR SHARED WATCHLIST ITEMS
CREATE POLICY "Allow public access to read room items" ON shared_watchlist_items
  FOR SELECT USING (true);

CREATE POLICY "Allow public access to add room items" ON shared_watchlist_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public access to update room item votes" ON shared_watchlist_items
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public access to delete room items" ON shared_watchlist_items
  FOR DELETE USING (true);

-- 9. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX idx_quiz_leaderboard_score ON quiz_leaderboard(score DESC);
CREATE INDEX idx_shared_watchlist_items_room_id ON shared_watchlist_items(room_id);
