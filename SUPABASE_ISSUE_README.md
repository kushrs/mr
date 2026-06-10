# CinePrime - Supabase Connection Issue

## Current Issue

The application is experiencing **403 Forbidden** errors when trying to connect to Supabase:

```
GET https://ouadjfsxbydricflrdnv.supabase.co/auth/v1/user 403 (Forbidden)
```

This typically means:
1. **Supabase project is suspended/paused** due to inactivity (free tier)
2. **API key is invalid or expired**
3. **Project has been deleted**
4. **Billing/quota issues**

## What I've Done

I've updated the application to handle Supabase being unavailable gracefully:

### Changes Made:
1. **Enhanced Error Detection**: Now detects 403 Forbidden errors specifically
2. **User-Friendly Messages**: Shows clear messages when service is unavailable
3. **Offline Mode**: App works without authentication when Supabase is down
4. **Connection Test Page**: Added `supabase-test.html` to diagnose issues
5. **Automatic Fallback**: Switches to offline mode when 403 errors occur

### Files Updated:
- `supabase-config.js` - Added 403 error detection and mock client
- `auth.js` - Enhanced error handling for login/register/checkUser
- `supabase-test.html` - Better error reporting
- `SUPABASE_ISSUE_README.md` - Updated troubleshooting guide

## How to Test

1. **Open the app**: Visit `http://localhost:8000`
2. **Check Connection**: Click "Connection Test" in the navigation
3. **Test Auth**: Try logging in/registering - you'll see appropriate error messages if Supabase is down

## Solutions

### Option 1: Reactivate Your Supabase Project (RECOMMENDED)
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Find your project `ouadjfsxbydricflrdnv`
3. If it shows "Paused", click **"Resume"** or **"Activate"**
4. Wait a few minutes for the service to fully activate
5. Test the connection again

### Option 2: Check Project Status
- **Free tier projects** get paused after 7 days of inactivity
- **Paid projects** shouldn't be paused unless there's a billing issue
- Check your Supabase dashboard for any billing or quota warnings

### Option 3: Create New Supabase Project
If the project is permanently deleted:

1. **Create new project** at https://supabase.com/dashboard
2. **Update credentials** in `supabase-config.js`:
   ```javascript
   const SUPABASE_URL = "https://your-new-project.supabase.co";
   const SUPABASE_ANON_KEY = "your-new-anon-key";
   ```
3. **Set up database tables** (see SQL below)
4. **Update authentication settings** if needed

### Option 4: Use Offline Mode
The app now works without Supabase for:
- ✅ Movie browsing
- ✅ Movie details
- ❌ User authentication
- ❌ Watchlist (requires login)
- ❌ User profiles

## Database Setup (if creating new Supabase project)

Run these SQL commands in your Supabase SQL editor:

```sql
-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create watchlist table
CREATE TABLE watchlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own watchlist" ON watchlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own watchlist" ON watchlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own watchlist" ON watchlist FOR DELETE USING (auth.uid() = user_id);
```

## Testing the Fix

1. **Start server**: `python -m http.server 8000`
2. **Visit test page**: `http://localhost:8000/supabase-test.html`
3. **Check results**: Should show "403 Forbidden" error clearly
4. **Try login**: Should show "service unavailable" message
5. **Browse movies**: Should work normally

## What Happens Now

- **403 errors detected**: App automatically switches to offline mode
- **User-friendly messages**: Clear explanations instead of technical errors
- **Graceful degradation**: Core movie browsing functionality preserved
- **Easy reactivation**: Just resume your Supabase project to restore full functionality

The app will continue working for movie browsing even when Supabase is unavailable!