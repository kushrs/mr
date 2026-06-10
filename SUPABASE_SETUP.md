# CinePrime - Supabase Integration Setup Guide

## Your Supabase Credentials
- **Project URL**: https://ouadjfsxbydricflrdnv.supabase.co
- **Anon Key**: sb_publishable_NU3gk0zxH4vRcFhLy26IzA_AJcdqmyl

## Step 1: Set Up Supabase Tables

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste the contents of `supabase-setup.sql`
6. Click **Run** to execute the SQL

This will create:
- `watchlist` table - stores user's movie watchlist
- `profiles` table - stores user profile information
- Row Level Security policies

## Step 2: Configure Backend

1. Copy `.env.example` to `.env` in the `backend/` folder:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Update `backend/.env` with your credentials (already filled in)

3. Install Supabase dependency:
   ```bash
   cd backend
   npm install @supabase/supabase-js
   ```

4. Start the backend server:
   ```bash
   npm start
   ```

## Step 3: Frontend is Already Configured

The `script.js` file is already updated with:
- Supabase initialization
- Supabase-based watchlist management
- Authentication integration

## Features Now Available

### ✅ Authentication
- User registration with email/password
- User login/logout
- Profile creation
- Sessions managed by Supabase

### ✅ Watchlist Management
- Add/remove movies from watchlist (requires login)
- Watchlist stored in Supabase database
- User-specific watchlist (Row Level Security)
- Real-time sync across devices

### ✅ Security
- Row Level Security (RLS) enabled
- Users can only access their own data
- Profiles are public (viewable by all)
- Passwords hashed by Supabase Auth

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Watchlist
- `GET /api/watchlist` - Get user's watchlist
- `POST /api/watchlist/add` - Add movie to watchlist
- `DELETE /api/watchlist/remove/:movieId` - Remove movie
- `GET /api/watchlist/check/:movieId` - Check if movie in watchlist

## Frontend Authentication Example

```javascript
// Sign up
const { data, error } = await supabaseClient.auth.signUp({
  email: 'user@example.com',
  password: 'password123'
});

// Sign in
const { data, error } = await supabaseClient.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});

// Get current user
const { data: { user } } = await supabaseClient.auth.getUser();

// Sign out
await supabaseClient.auth.signOut();
```

## Troubleshooting

### Movies not showing
- Check browser console (F12) for errors
- Verify OMDB API key is valid
- Check network tab to see if API calls are being made

### Watchlist not working
- Make sure user is logged in
- Check that Supabase tables exist (run SQL setup)
- Check browser console for Supabase errors

### Backend connection issues
- Verify `.env` file has correct Supabase credentials
- Make sure backend is running on port 5000
- Check if `@supabase/supabase-js` is installed

## Next Steps

1. Test registration/login at `/login.html`
2. Test watchlist functionality
3. Deploy to production with secured environment variables
4. Enable email verification (Supabase Dashboard > Authentication > Settings)
5. Set up OAuth providers (Google, GitHub, etc.)

## Files Changed

- ✅ `script.js` - Supabase integration for frontend
- ✅ `backend/routes/auth.js` - Supabase authentication
- ✅ `backend/routes/watchlist.js` - Supabase watchlist management
- ✅ `backend/.env.example` - Environment variables template
- ✅ `supabase-setup.sql` - Database schema setup
