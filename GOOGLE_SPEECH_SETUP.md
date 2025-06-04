# Google Speech API Integration Setup Guide

This guide will help you set up Google Cloud Speech-to-Text and Text-to-Speech APIs for the Triage application.

## Prerequisites

1. Google Cloud Platform account
2. A project created in Google Cloud Console
3. Billing enabled on your GCP project

## Step 1: Enable Required APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to "APIs & Services" > "Library"
4. Search and enable the following APIs:
   - **Cloud Speech-to-Text API**
   - **Cloud Text-to-Speech API**

## Step 2: Create API Credentials

### Option A: API Key (Simpler, less secure)

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API Key"
3. Copy the generated API key
4. (Optional) Restrict the API key:
   - Click on the API key name
   - Under "API restrictions", select "Restrict key"
   - Select only Speech-to-Text and Text-to-Speech APIs
   - Under "Application restrictions", add your domains/IPs

### Option B: Service Account (More secure, recommended for production)

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the service account details
4. Grant the following roles:
   - Cloud Speech Client
   - Cloud Text-to-Speech Client
5. Create and download the JSON key file
6. Store the JSON file securely

## Step 3: Configure the Application

### Backend Configuration

1. Copy the `.env.example` file to `.env`:

   ```bash
   cd backend
   cp .env.example .env
   ```

2. Edit the `.env` file and add your Google Cloud API key:

   ```
   GOOGLE_CLOUD_API_KEY=your-api-key-here
   ```

   OR if using service account:

   ```
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
   ```

### Frontend Configuration

1. Copy the `.env.example` file to `.env`:

   ```bash
   cd frontend
   cp .env.example .env
   ```

2. Edit the `.env` file and configure the endpoints:
   ```
   REACT_APP_GOOGLE_API_KEY=your-api-key-here
   REACT_APP_GOOGLE_STT_API=http://localhost:8080/api/speech-to-text
   REACT_APP_GOOGLE_TTS_API=http://localhost:8080/api/text-to-speech
   ```

## Step 4: Update the Application Code

### To use the Google Speech version of the app:

1. In `frontend/src/index.js`, import the Google Speech version:

   ```javascript
   // Change this:
   import App from "./app";

   // To this:
   import App from "./app-google-speech";
   ```

2. Restart the frontend application

## Step 5: Test the Integration

1. Start the backend:

   ```bash
   cd backend
   go run cmd/app/main.go
   ```

2. Start the frontend:

   ```bash
   cd frontend
   npm start
   ```

3. Test the voice features:
   - Click "Start Assessment"
   - Allow microphone access when prompted
   - The AI should speak using Google TTS
   - Your speech should be converted using Google STT

## Pricing Information

Google Cloud Speech APIs have the following pricing (as of 2024):

### Speech-to-Text

- First 60 minutes per month: Free
- Standard models: $0.006 per 15 seconds
- Medical models: $0.039 per 15 seconds

### Text-to-Speech

- First 1 million characters per month: Free for Standard voices
- Standard voices: $4 per 1 million characters
- Neural2 voices: $16 per 1 million characters

## Troubleshooting

### Common Issues:

1. **"API key not valid" error**

   - Ensure the API key is correct
   - Check if the required APIs are enabled
   - Verify billing is enabled on your GCP project

2. **CORS errors**

   - Make sure you're calling the backend endpoints, not Google APIs directly
   - Check CORS configuration in the backend

3. **Audio format issues**

   - The current implementation uses WEBM_OPUS format
   - If you have issues, try changing to FLAC or LINEAR16 in `serviceGoogleSpeech.js`

4. **Quota exceeded**
   - Check your API quotas in Google Cloud Console
   - Consider implementing rate limiting

## Security Best Practices

1. **Never expose API keys in frontend code**

   - Always proxy through your backend
   - Use environment variables

2. **Restrict API keys**

   - Limit to specific APIs
   - Restrict by IP/domain
   - Use service accounts for production

3. **Monitor usage**
   - Set up billing alerts
   - Monitor API usage in GCP Console
   - Implement logging

## Alternative: Direct Browser API Fallback

The application includes fallback to browser's Web Speech API if Google APIs fail. This is implemented in the `app-google-speech.js` file in the catch blocks.

## Support

For issues specific to Google Cloud APIs:

- [Google Cloud Speech-to-Text Documentation](https://cloud.google.com/speech-to-text/docs)
- [Google Cloud Text-to-Speech Documentation](https://cloud.google.com/text-to-speech/docs)

For application-specific issues:

- Check the application logs
- Review the error messages in browser console
- Ensure all environment variables are set correctly

1. Created Frontend Service (frontend/src/core/services/serviceGoogleSpeech.js)

- Handles audio recording and conversion to/from base64
- Sends requests to backend proxy endpoints
- Includes error handling and audio playback

2. Created Backend Handlers

- backend/internal/api/handlers/speech.go - API endpoints for speech services
- backend/internal/clients/google_speech_client.go - Google API client
- Updated routes to include /api/speech-to-text and /api/text-to-speech

3. Created Alternative App Version (frontend/src/app-google-speech.js)

- Uses MediaRecorder API for capturing audio
- Integrates with Google Speech services
- Includes fallback to browser TTS if Google fails

4. Configuration Files

- frontend/.env.example - Frontend environment variables
- backend/.env.example - Backend environment variables with Google API key
- GOOGLE_SPEECH_SETUP.md - Complete setup guide

Where to Add Your API Key:

1. Backend (backend/.env):
   GOOGLE_CLOUD_API_KEY=YOUR_ACTUAL_API_KEY_HERE
2. Frontend (frontend/.env):
   REACT_APP_GOOGLE_API_KEY=YOUR_ACTUAL_API_KEY_HERE

To Switch to Google Speech:

In frontend/src/index.js, change:
import App from './app';
to:
import App from './app-google-speech';

The implementation provides a seamless voice experience using Google's advanced speech recognition and natural-sounding
voices, with proper error handling and fallbacks.
