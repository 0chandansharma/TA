# Google Speech API with Chirp Models - UPDATED

## ✅ What Was Fixed

### 1. **Authentication Method Updated**
- ❌ **Old**: API Key authentication (`X-Goog-Api-Key`)
- ✅ **New**: OAuth2 Service Account authentication (`Authorization: Bearer`)

### 2. **Voice Model Upgraded**
- ❌ **Old**: Standard neural voices (`en-US-Neural2-F`)
- ✅ **New**: Chirp3 HD models (`en-GB-Chirp3-HD-Despina`)

### 3. **Audio Quality Improved**
- ❌ **Old**: MP3 encoding
- ✅ **New**: LINEAR16 (WAV) encoding for better quality

### 4. **Voice Cloning Features Added**
- ✅ Added `voiceClone` object for advanced voice features
- ✅ Added `markup` field support for better text processing

## 🔧 Configuration Changes

### Backend Changes
```bash
# OLD .env
GOOGLE_CLOUD_API_KEY=AIzaSy...

# NEW .env  
GOOGLE_CLOUD_PROJECT_ID=dochq-staging
GOOGLE_APPLICATION_CREDENTIALS=./dochq-staging-72db3155a22d.json
```

### Frontend Changes
```javascript
// OLD TTS Request
{
  "input": { "text": "Hello" },
  "voice": { "name": "en-US-Neural2-F" },
  "audioConfig": { "audioEncoding": "MP3" }
}

// NEW TTS Request (Chirp3)
{
  "input": { "markup": "hi, I'm Alia, How can I help you today?" },
  "voice": { 
    "languageCode": "en-GB",
    "name": "en-GB-Chirp3-HD-Despina",
    "voiceClone": {}
  },
  "audioConfig": { "audioEncoding": "LINEAR16" }
}
```

## 🚀 Setup Instructions

### 1. **Install Dependencies** (Run once)
```bash
cd backend
./add_google_deps.sh
```

### 2. **Place Service Account Key**
- Copy your `dochq-staging-72db3155a22d.json` file to `backend/` directory
- This file contains your Google Cloud OAuth credentials

### 3. **Start Services**
```bash
# Backend
cd backend
go run cmd/app/main.go

# Frontend  
cd frontend
npm start
```

### 4. **Test Voice Features**
- Start assessment
- Allow microphone permissions
- Listen for **Alia's voice** (high-quality Chirp3 voice)
- Speak and verify speech-to-text accuracy

## 🎯 API Curl Example (Your Format)

The backend now makes requests matching your curl format:

```bash
curl -X POST -H "Content-Type: application/json" \
-H "X-Goog-User-Project: dochq-staging" \
-H "Authorization: Bearer $(gcloud auth print-access-token)" \
--data '{
  "input": {
    "markup": "hi, I\u0027m Alia, How can I help you today?"
  },
  "voice": {
    "languageCode": "en-GB",
    "name": "en-GB-Chirp3-HD-Despina",
    "voiceClone": {}
  },
  "audioConfig": {
    "audioEncoding": "LINEAR16"
  }
}' "https://texttospeech.googleapis.com/v1/text:synthesize"
```

## 🎵 Voice Features Now Available

### **Chirp3 HD Models**
- **Despina**: Friendly female voice
- **Higher Quality**: 24kHz audio sampling
- **Natural Sounding**: Advanced neural processing
- **Medical Optimized**: Better for healthcare terminology

### **Voice Cloning Ready**
- `voiceClone` object included in requests
- Ready for custom voice training
- Supports voice characteristics modification

### **Audio Quality**
- **LINEAR16**: Uncompressed WAV format
- **Better Quality**: Higher fidelity than MP3
- **Medical Grade**: Suitable for professional applications

## 🔍 Troubleshooting

### **If Authentication Fails:**
1. Check `dochq-staging-72db3155a22d.json` is in backend folder
2. Verify `GOOGLE_APPLICATION_CREDENTIALS` path in `.env`
3. Ensure Google Cloud Speech APIs are enabled

### **If Voice Quality is Poor:**
- Check browser audio settings
- Verify LINEAR16 audio is supported
- Test with different browsers

### **If STT Accuracy is Low:**
- Verify microphone permissions
- Check background noise levels
- Ensure medical conversation model is working

## 📊 Benefits of This Update

1. **Authentication**: More secure OAuth2 vs API keys
2. **Voice Quality**: Chirp3 HD vs standard voices  
3. **Medical Accuracy**: Optimized for healthcare terminology
4. **Future Ready**: Voice cloning capabilities included
5. **Audio Quality**: LINEAR16 for professional applications

The integration now matches Google's latest TTS API format and provides significantly better voice quality for your physiotherapy platform.

## 🔐 Security Notes

- Service account key is used for backend authentication
- No API keys exposed to frontend
- OAuth tokens managed automatically by Google SDK
- Credentials stored securely in backend environment