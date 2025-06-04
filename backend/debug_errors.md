# Debugging Speech and Chat History Errors

## Error 1: "Error processing speech. Please try again."

### Root Cause
Google Speech API authentication/configuration issue.

### How to Fix

1. **Set Environment Variables** (for local development):
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/Users/chandansharma/Desktop/workspace/deecogs-workspace/dochq/Triage-app/backend/dochq-staging-72db3155a22d.json"
export GOOGLE_CLOUD_PROJECT_ID="dochq-staging"
```

2. **Test Google Credentials**:
```bash
# Check if credentials file exists
ls -la $GOOGLE_APPLICATION_CREDENTIALS

# Test if project ID is set
echo $GOOGLE_CLOUD_PROJECT_ID
```

3. **Check Backend Logs** for these messages:
- "Warning: GOOGLE_APPLICATION_CREDENTIALS not set"
- "Warning: Google credentials not found"
- "authentication failed - check GOOGLE_APPLICATION_CREDENTIALS"

### Production Deployment
The GitHub Actions workflow already sets the project ID. Just ensure the `STAGING_CLOUD_RUN_KEY_JSON` secret is properly configured.

---

## Error 2: "Inner chat_history key missing"

### Root Cause
Mismatch between database storage format and retrieval logic.

### How it was Fixed
- Updated chat history parsing to handle both direct array format and nested format
- Now gracefully handles missing chat history instead of throwing errors
- Initializes empty arrays when parsing fails

### Testing
You can test the fix by:

1. **Create an assessment**:
```bash
curl -X POST http://localhost:8080/assessments \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "anatomyId": 1, "assessmentType": "PAIN"}'
```

2. **Send chat message**:
```bash
curl -X POST http://localhost:8080/assessments/1/questionnaires \
  -H "Content-Type: application/json" \
  -d '{
    "chat_history": [
      {"user": "hello", "assistant": "hi there"}
    ]
  }'
```

3. **Retrieve assessment** (should not show the error anymore):
```bash
curl -X GET http://localhost:8080/assessments/1
```

---

## Expected Log Messages After Fix

### Good Messages:
- "No chat history found for this assessment" (when empty)
- "Direct unmarshal failed, trying nested format..." (when handling legacy data)
- "Could not parse chat_history in any known format, using empty array" (graceful fallback)

### Error Messages to Watch For:
- "authentication failed - check GOOGLE_APPLICATION_CREDENTIALS"
- "permission denied - check project ID and API permissions"
- "Google Speech API error"

---

## Environment Setup Checklist

- [ ] `GOOGLE_APPLICATION_CREDENTIALS` points to valid service account key file
- [ ] `GOOGLE_CLOUD_PROJECT_ID` is set to "dochq-staging"
- [ ] Service account key file exists and is readable
- [ ] Google Cloud Speech API is enabled for the project
- [ ] Service account has Speech API permissions

---

## Quick Debug Commands

```bash
# Check environment variables
env | grep GOOGLE

# Test backend startup (look for Google credential warnings)
go run cmd/app/main.go

# Test speech endpoint directly (if you have a speech handler)
curl -X POST http://localhost:8080/speech/test

# Check database connection
curl -X GET http://localhost:8080/ping
```