import functions_framework
from google import genai
from google.genai import types
import base64
import json
import os
import logging
import re

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration
PROJECT_ID = os.environ.get('GCP_PROJECT_ID', 'dochq-staging')
LOCATION = os.environ.get('GCP_LOCATION', 'us-central1')
CREDENTIALS_PATH = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', './credentials.json')

# Validate environment setup
def validate_environment():
    """Validate that required environment variables and files are present"""
    if CREDENTIALS_PATH and os.path.exists(CREDENTIALS_PATH):
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = CREDENTIALS_PATH
        logger.info(f"Using credentials from {CREDENTIALS_PATH}")
    else:
        logger.warning(f"Credentials file not found at {CREDENTIALS_PATH}, using default credentials")
    
    return True

def extract_json_with_action(text):
    """
    Extract a JSON object with 'response' and 'action' keys from the text.
    If extraction fails, create a default response.
    """
    try:
        # Try multiple regex patterns to extract JSON
        patterns = [
            r'\{[^{}]*"response"[^{}]*"action"[^{}]*\}',
            r'\{.*?"response".*?"action".*?\}',
            r'\{[^}]*\}'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.DOTALL)
            if match:
                try:
                    json_str = match.group(0)
                    # Clean up common issues
                    json_str = json_str.replace('\n', ' ').replace('\r', '')
                    json_str = re.sub(r',\s*}', '}', json_str)  # Remove trailing commas
                    
                    parsed_json = json.loads(json_str)
                    
                    # Validate the JSON has required keys
                    if 'response' in parsed_json and 'action' in parsed_json:
                        return parsed_json
                except json.JSONDecodeError as e:
                    logger.debug(f"JSON decode error with pattern {pattern}: {e}")
                    continue
        
        # If no valid JSON found, extract response text and guess action
        logger.warning(f"Could not extract valid JSON from text: {text}")
        
        # Try to extract just the response part
        response_match = re.search(r'"response"\s*:\s*"([^"]*)"', text)
        response_text = response_match.group(1) if response_match else text.strip()
        
        # Try to extract action
        action_match = re.search(r'"action"\s*:\s*"([^"]*)"', text)
        action = action_match.group(1) if action_match else "continue"
        
        return {
            "response": response_text,
            "action": action
        }
    
    except Exception as e:
        logger.error(f"Error extracting JSON: {e}")
        return {
            "response": "I'm having trouble understanding the response. Could you please repeat?",
            "action": "continue"
        }

def generate(contents):
    """Generate response using Vertex AI with proper error handling"""
    try:
        # Validate environment first
        if not validate_environment():
            raise Exception("Environment validation failed")
        
        # Initialize client with error handling
        try:
            client = genai.Client(
                vertexai=True,
                project=PROJECT_ID,
                location=LOCATION,
            )
        except Exception as client_init_error:
            logger.error(f"Failed to initialize Genai Client: {client_init_error}")
            raise Exception(f"Could not connect to AI service: {str(client_init_error)}")

        # System prompt with fixed formatting
        system_prompt = """You are Alia, a physiotherapy AI assistant. You currently just deal with patients having problem or pain in their body. You follow the below tree to diagnose the patient and recommend them with appropriate next steps be it self-care or physiotherapy exercises or book a doctor's appointment. Be polite, empathetic and crisp with your responses. And Respond in the below format:
{"response": "...", "action": "..."}
where, "response" is the question which needs to be asked and "action" will depend on the next steps and can take following values: close_chat, continue, next_api, camera_on.

TREE YAML:
- Greet the person and introduce yourself only by your name and ask how can you assist them today.
- Analyze the patient's pain location. If it is lower back proceed further else tell them that "I'm just capable of handling lower back pains right now, check back after some time".
- Express your concern about the pain in the lower back area and ask for a quick assessment to better understand the problem.
- If the user says YES
  - to further confirm on the pain location ask the patient to show where exactly he/she is experiencing pain.
  - Respond by telling the body part name only shown by the user in the video along with "Thank you for showing me the pain location." and action being next_api in above given JSON format.
- If the user says NO
  - Respond with "You can visit us sometime later so that we can assist you better." and action being close_chat in given JSON format."""

        # Configure model generation with conservative settings
        model = "gemini-1.5-flash-002"
        generate_content_config = types.GenerateContentConfig(
            temperature=0.3,  # Lower temperature for more consistent responses
            top_p=0.8,
            max_output_tokens=512,  # Limit output length
            response_modalities=["TEXT"],
            safety_settings=[
                types.SafetySetting(
                    category="HARM_CATEGORY_HATE_SPEECH",
                    threshold="BLOCK_ONLY_HIGH"
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold="BLOCK_ONLY_HIGH"
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold="BLOCK_ONLY_HIGH"
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_HARASSMENT",
                    threshold="BLOCK_ONLY_HIGH"
                )
            ],
            system_instruction=[types.Part.from_text(text=system_prompt)],
        )

        # Generate content with timeout and retry logic
        max_retries = 2
        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=generate_content_config,
                )
                
                if response and response.text:
                    return response.text.strip()
                else:
                    raise Exception("Empty response from AI model")
                    
            except Exception as generation_error:
                logger.error(f"Content generation attempt {attempt + 1} failed: {generation_error}")
                if attempt == max_retries - 1:
                    raise
                continue

    except Exception as e:
        logger.error(f"Critical error in generate function: {e}")
        # Return a safe fallback response
        return json.dumps({
            "response": "I'm experiencing technical difficulties. Please try again in a moment.",
            "action": "continue"
        })

@functions_framework.http
def hello_http(request):
    """Main HTTP handler with comprehensive error handling"""
    # CORS handling
    if request.method == "OPTIONS":
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "3600",
        }
        return ("", 204, headers)

    # Standard headers
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
    }

    try:
        # Validate request method
        if request.method not in ["GET", "POST"]:
            return (json.dumps({
                'success': False,
                'statusCode': 405,
                'data': {'error': 'Method not allowed'}
            }), 405, headers)

        # Extract and validate request data
        try:
            request_json = request.get_json(silent=True) or {}
            request_args = request.args or {}
        except Exception as parse_error:
            logger.error(f"Request parsing error: {parse_error}")
            return (json.dumps({
                'success': False,
                'statusCode': 400,
                'data': {'error': 'Invalid request format'}
            }), 400, headers)

        # Extract chat history with validation
        chat_history = request_json.get('chat_history') or request_args.get('chat_history')
        
        if not chat_history:
            # Return a greeting for empty chat history
            response_data = {
                "response": "Hello! I'm Alia, your physiotherapy assistant. How can I help you today?",
                "action": "continue"
            }
            return (json.dumps({
                'success': True,
                'statusCode': 200,
                'data': response_data
            }), 200, headers)

        # Validate chat history format
        if not isinstance(chat_history, list):
            return (json.dumps({
                'success': False,
                'statusCode': 400,
                'data': {'error': 'Chat history must be a list'}
            }), 400, headers)

        # Process chat history with error handling
        contents = []
        for idx, item in enumerate(chat_history):
            try:
                if not isinstance(item, dict):
                    logger.warning(f"Skipping non-dict item at index {idx}")
                    continue
                
                if 'user' in item and item['user']:
                    contents.append(types.Content(
                        role="user", 
                        parts=[types.Part.from_text(text=str(item['user']))]
                    ))
                
                if 'response' in item and item['response']:
                    contents.append(types.Content(
                        role="model", 
                        parts=[types.Part.from_text(text=str(item['response']))]
                    ))
                
                # Handle video/image data
                if 'video' in item and item['video']:
                    try:
                        # Validate base64 format
                        if ',' in item['video']:
                            video_data = item['video'].split(',')[1]
                        else:
                            video_data = item['video']
                        
                        decoded_data = base64.b64decode(video_data)
                        contents.append(types.Content(
                            role="user", 
                            parts=[types.Part.from_bytes(
                                data=decoded_data, 
                                mime_type="video/mp4"
                            )]
                        ))
                    except Exception as video_error:
                        logger.error(f"Video processing error at index {idx}: {video_error}")
                        # Add text description instead
                        contents.append(types.Content(
                            role="user",
                            parts=[types.Part.from_text(text="[User showed a video]")]
                        ))
                        
            except Exception as item_error:
                logger.error(f"Error processing chat history item {idx}: {item_error}")
                continue

        # Ensure we have some content to process
        if not contents:
            response_data = {
                "response": "I didn't receive any messages. How can I assist you today?",
                "action": "continue"
            }
            return (json.dumps({
                'success': True,
                'statusCode': 200,
                'data': response_data
            }), 200, headers)

        # Generate response with error handling
        try:
            res = generate(contents)
            logger.info(f"Generated response: {res[:200]}...")  # Log first 200 chars

            # Extract and validate JSON response
            response_data = extract_json_with_action(res)
            
            # Ensure response is not empty
            if not response_data.get('response'):
                response_data['response'] = "I'm here to help with your physiotherapy needs. What brings you here today?"

            final_response = {
                'success': True, 
                'statusCode': 200, 
                'data': response_data
            }
            return (json.dumps(final_response), 200, headers)

        except Exception as generation_error:
            logger.error(f"Response generation error: {generation_error}")
            error_response = {
                'response': "I'm having trouble processing your request right now. Please try again.",
                'action': 'continue'
            }
            final_response = {
                'success': False, 
                'statusCode': 500, 
                'data': error_response
            }
            return (json.dumps(final_response), 500, headers)

    except Exception as e:
        logger.error(f"Unexpected error in hello_http: {e}", exc_info=True)
        error_response = {
            'response': "An unexpected error occurred. Please try again later.",
            'action': 'continue'
        }
        final_response = {
            'success': False, 
            'statusCode': 500, 
            'data': error_response
        }
        return (json.dumps(final_response), 500, headers)