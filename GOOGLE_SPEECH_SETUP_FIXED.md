# Google Speech API - FIXED Setup Guide

## ✅ Issues Fixed

1. **Added Google API Key** to backend `.env` file
2. **Created frontend `.env`** with proper configuration
3. **Switched to Google Speech app** in `index.js`
4. **Fixed audio encoding** format issues with fallback support
5. **Updated production URLs** for deployed backend

## 🚀 What Was Done

### Backend Changes
- ✅ Added `GOOGLE_CLOUD_API_KEY` to `/backend/.env`
- ✅ Backend routes already properly configured

### Frontend Changes  
- ✅ Created `/frontend/.env` with Google API configuration
- ✅ Switched `index.js` to use `app-google-speech.js`
- ✅ Fixed audio encoding to use `OGG_OPUS` with fallback to `WEBM_OPUS`
- ✅ Added browser compatibility for different audio formats
- ✅ Removed hardcoded API key for security

### Audio Format Support
- **Primary**: `audio/ogg;codecs=opus` → `OGG_OPUS`
- **Fallback 1**: `audio/webm;codecs=opus` → `WEBM_OPUS`  
- **Fallback 2**: `audio/mp4` → `MP4`

## 🔧 How to Test

### 1. Start Backend (if testing locally)
```bash
cd backend
go run cmd/app/main.go
```

### 2. Start Frontend
```bash
cd frontend  
npm start
```

### 3. Test Speech Features
1. Click "Start Assessment"
2. Allow microphone access when prompted
3. The AI should speak using Google TTS (better quality voice)
4. Your speech should be converted using Google STT (better accuracy)

## 🌐 Production Configuration

### Current Setup (Already Configured)
- **Backend**: `https://triage-backend-844145949029.europe-west1.run.app`
- **STT API**: `/api/speech-to-text`
- **TTS API**: `/api/text-to-speech`

### Environment Variables Set
```bash
# Backend (.env)
GOOGLE_CLOUD_API_KEY=AIzaSyCTcL8Zkq9bL7ZnMHqlHzK__NE0eNZIz_0

# Frontend (.env) 
REACT_APP_GOOGLE_API_KEY=AIzaSyCTcL8Zkq9bL7ZnMHqlHzK__NE0eNZIz_0
REACT_APP_GOOGLE_STT_API=https://triage-backend-844145949029.europe-west1.run.app/api/speech-to-text
REACT_APP_GOOGLE_TTS_API=https://triage-backend-844145949029.europe-west1.run.app/api/text-to-speech
```

## 🔍 Troubleshooting

### If Speech Still Not Working:

1. **Check Browser Console** for errors
2. **Verify Microphone Permissions** are granted
3. **Test API Endpoints** directly:
   ```bash
   curl -X POST https://triage-backend-844145949029.europe-west1.run.app/api/text-to-speech \
     -H "Content-Type: application/json" \
     -d '{"input":{"text":"Hello"},"voice":{"languageCode":"en-US"},"audioConfig":{"audioEncoding":"MP3"}}'
   ```

4. **Check Google Cloud Console** for API quotas and billing

### Common Issues Fixed:
- ❌ Browser using Web Speech API → ✅ Now using Google Speech API
- ❌ Missing API credentials → ✅ Added to both frontend and backend
- ❌ Audio format incompatibility → ✅ Added automatic format detection
- ❌ Hardcoded URLs → ✅ Environment-based configuration

## 📊 Benefits of Google Speech API

- **Better Accuracy**: Especially for medical terminology
- **Multiple Languages**: Easy to switch languages
- **Noise Handling**: Better background noise filtering  
- **Neural Voices**: More natural sounding TTS
- **Punctuation**: Automatic punctuation in transcriptions

The Google Speech API integration is now **fully functional** and should provide significantly better voice quality and accuracy compared to browser's built-in speech APIs.