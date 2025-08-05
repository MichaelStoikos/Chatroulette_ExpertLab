# Agora Setup Guide

## Step 1: Get Agora App ID

1. Go to [Agora Console](https://console.agora.io/)
2. Sign up or log in
3. Create a new project
4. Copy your **App ID** from the project dashboard

## Step 2: Configure Environment Variables

Create a `.env` file in the `client/chatroulette` directory:

```env
REACT_APP_AGORA_APP_ID=your_actual_app_id_here
REACT_APP_AGORA_TOKEN=null
```

## Step 3: Restart Your Development Server

After adding the `.env` file, restart your React development server:

```bash
cd client/chatroulette
npm run dev
```

## Alternative: Quick Test Setup

If you want to test quickly, you can temporarily hardcode your App ID in `src/App.jsx`:

```javascript
const AGORA_APP_ID = 'your_actual_app_id_here';
```

## Notes

- For testing, you can use `null` as the token
- For production, you'll need to generate tokens on your server
- The App ID is safe to expose in the frontend (it's public)

## Troubleshooting

If you still get errors:
1. Make sure your App ID is correct
2. Check that the `.env` file is in the right location
3. Restart your development server after adding the `.env` file
4. Check the browser console for detailed error messages 