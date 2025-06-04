import requests
import json
import time

# API endpoint
API_URL = "https://deecogs-xai-bot-844145949029.europe-west1.run.app/chat"

def test_conversation():
    """
    Test a multi-turn conversation with the AI assistant
    """
    # Initialize chat history
    chat_history = []
    
    # Define test messages
    test_messages = [
        "Hello, I have lower back pain",
        "I'd rate it 6 out of 10",
        "It hurts more when I bend forward",
        "No, it just started on its own, not after an injury",
        "Yes, I have pain in my leg as well",
        "It's just in one leg, my right leg",
        "No, I don't have any fever or other conditions"
    ]
    
    # Iterate through test messages
    for message in test_messages:
        print("\n" + "-"*80)
        print(f"USER: {message}")
        
        # Add user message to chat history
        chat_history.append({"user": message})
        
        # Create request payload
        payload = {
            "chat_history": chat_history
        }
        
        # Make the API request
        try:
            response = requests.post(API_URL, json=payload)
            response.raise_for_status()  # Raise an exception for 4XX/5XX responses
            
            # Parse the response
            response_data = response.json()
            print(f"RESPONSE STATUS: {response_data['success']}, HTTP CODE: {response.status_code}")
            
            if response_data['success']:
                ai_response = response_data['data']
                
                # Print the AI's question
                print(f"AI: {ai_response['question']}")
                
                # Print the options if available
                if 'options' in ai_response and ai_response['options']:
                    print("OPTIONS:")
                    for idx, option in enumerate(ai_response['options']):
                        print(f"  {idx+1}. {option}")
                
                # Print the action
                print(f"ACTION: {ai_response['action']}")
                
                # Add AI response to chat history
                chat_history.append({"response": json.dumps(ai_response)})
            else:
                print(f"ERROR: {response_data.get('data', {}).get('error', 'Unknown error')}")
                break
                
        except requests.exceptions.RequestException as e:
            print(f"REQUEST ERROR: {e}")
            break
            
        # Small delay between requests
        time.sleep(1)
    
    print("\n" + "-"*80)
    print(f"Conversation test completed with {len(chat_history) // 2} turns")
    
def test_repetition():
    """
    Test if the AI avoids repeating questions when given similar answers
    """
    # Initialize chat history
    chat_history = []
    
    # First question
    print("\n" + "-"*80)
    print("TESTING REPETITION HANDLING")
    print("-"*80)
    
    # Initial message
    initial_message = "Hi, I have back pain"
    print(f"USER: {initial_message}")
    
    chat_history.append({"user": initial_message})
    payload = {"chat_history": chat_history}
    
    response = requests.post(API_URL, json=payload)
    response_data = response.json()
    
    if response_data['success']:
        ai_response = response_data['data']
        print(f"AI: {ai_response['question']}")
        chat_history.append({"response": json.dumps(ai_response)})
        
        # Simulate giving the same answer multiple times
        for i in range(3):
            answer = "It hurts a lot"
            print(f"\nUSER: {answer}")
            
            chat_history.append({"user": answer})
            payload = {"chat_history": chat_history}
            
            response = requests.post(API_URL, json=payload)
            response_data = response.json()
            
            if response_data['success']:
                ai_response = response_data['data']
                print(f"AI: {ai_response['question']}")
                chat_history.append({"response": json.dumps(ai_response)})
            else:
                print(f"ERROR: {response_data.get('data', {}).get('error', 'Unknown error')}")
                break
            
            time.sleep(1)
    else:
        print(f"ERROR: {response_data.get('data', {}).get('error', 'Unknown error')}")
        
def test_error_handling():
    """
    Test how the API handles malformed requests
    """
    print("\n" + "-"*80)
    print("TESTING ERROR HANDLING")
    print("-"*80)
    
    # Test 1: Empty chat history
    print("\nTest 1: Empty chat history")
    payload = {"chat_history": []}
    
    response = requests.post(API_URL, json=payload)
    print(f"Status code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    # Test 2: Malformed chat history
    print("\nTest 2: Malformed chat history")
    payload = {"chat_history": [{"invalid_key": "This should cause an error"}]}
    
    response = requests.post(API_URL, json=payload)
    print(f"Status code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    # Test 3: Missing chat_history key
    print("\nTest 3: Missing chat_history key")
    payload = {"wrong_key": []}
    
    response = requests.post(API_URL, json=payload)
    print(f"Status code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")

if __name__ == "__main__":
    print("=== TESTING API: deecogs-xai ===")
    print(f"Endpoint: {API_URL}")
    
    # Run the standard conversation test
    test_conversation()
    
    # Run the repetition test
    test_repetition()
    
    # Run the error handling test
    test_error_handling()
    
    print("\nAll tests completed!")