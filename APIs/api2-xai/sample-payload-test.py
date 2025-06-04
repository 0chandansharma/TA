import requests
import json
import pprint

# API endpoint
API_URL = "https://deecogs-xai-bot-844145949029.europe-west1.run.app/chat"

# Sample conversation that caused the repeating questions issue
sample_chat_history = [
    {"user": "Hello! I'm experiencing lower back pain."},
    {"response": "{\"question\":\"On a scale of 0 to 10, with 0 being no pain and 10 being the most severe pain, how would you rate your lower back pain?\",\"options\":[\"0\",\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\",\"8\",\"9\",\"10\"],\"action\":\"continue\"}"},
    {"user": "4"},
    {"response": "{\"question\":\"On a scale of 0 to 10, with 0 being no pain and 10 being the most severe pain, how would you rate your lower back pain?\",\"options\":[\"0\",\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\",\"8\",\"9\",\"10\"],\"action\":\"continue\"}"}
]

# Create payload
payload = {
    "chat_history": sample_chat_history
}

print("Sending request with the following chat history:")
for i, message in enumerate(sample_chat_history):
    role = "User" if "user" in message else "AI"
    content = message.get("user") if "user" in message else message.get("response")
    print(f"{i+1}. {role}: {content[:50]}...")

print("\nSending request...")
response = requests.post(API_URL, json=payload)

print(f"\nStatus code: {response.status_code}")
try:
    response_data = response.json()
    print("\nResponse data:")
    pprint.pprint(response_data)
    
    if response_data.get('success'):
        ai_response = response_data['data']
        
        print("\nAI's next response:")
        print(f"Question: {ai_response.get('question', 'No question found')}")
        
        if 'options' in ai_response:
            print("\nOptions:")
            for option in ai_response['options']:
                print(f"- {option}")
                
        print(f"\nAction: {ai_response.get('action', 'No action specified')}")
    else:
        print("\nAPI returned an error:")
        pprint.pprint(response_data.get('data', {}))
except Exception as e:
    print(f"Error parsing response: {e}")
    print(f"Raw response: {response.text}")