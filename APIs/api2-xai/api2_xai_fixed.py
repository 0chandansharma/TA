import functions_framework
from google import genai
from google.genai import types
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

def extract_json_safely(response_text):
    """
    Attempt to extract a valid JSON object from the response text with multiple strategies
    """
    def clean_json_string(json_str):
        # Remove any leading/trailing non-JSON characters
        json_str = json_str.strip()
        # Fix common JSON issues
        json_str = json_str.replace("'", '"')
        json_str = re.sub(r',\s*}', '}', json_str)  # Remove trailing commas
        json_str = re.sub(r',\s*]', ']', json_str)  # Remove trailing commas in arrays
        return json_str

    try:
        # Strategy 1: Direct JSON extraction with flexible patterns
        patterns = [
            r'\{[^{}]*"question"[^{}]*"options"[^{}]*"action"[^{}]*\}',
            r'\{.*?"question".*?"options".*?"action".*?\}',
            r'\{[^}]*"question"[^}]*\}',
            r'\{[^}]+\}'
        ]
        
        for pattern in patterns:
            matches = re.finditer(pattern, response_text, re.DOTALL)
            for match in matches:
                try:
                    json_str = clean_json_string(match.group(0))
                    parsed_json = json.loads(json_str)
                    
                    # Ensure required keys exist
                    if 'question' not in parsed_json:
                        continue
                    
                    # Add default values for missing keys
                    if 'options' not in parsed_json:
                        parsed_json['options'] = []
                    if 'action' not in parsed_json:
                        parsed_json['action'] = 'continue'
                    
                    # Validate options is a list
                    if not isinstance(parsed_json['options'], list):
                        parsed_json['options'] = []
                    
                    return parsed_json
                    
                except json.JSONDecodeError as e:
                    logger.debug(f"JSON decode error with pattern {pattern}: {e}")
                    continue
        
        # Strategy 2: Extract components separately
        logger.info("Attempting component extraction from response")
        
        # Extract question
        question_match = re.search(r'"question"\s*:\s*"([^"]*)"', response_text)
        question = question_match.group(1) if question_match else "Could you please clarify?"
        
        # Extract options
        options = []
        options_match = re.search(r'"options"\s*:\s*\[(.*?)\]', response_text, re.DOTALL)
        if options_match:
            options_str = options_match.group(1)
            # Extract individual options
            option_pattern = r'"([^"]*)"'
            options = re.findall(option_pattern, options_str)
        
        # Extract action
        action_match = re.search(r'"action"\s*:\s*"([^"]*)"', response_text)
        action = action_match.group(1) if action_match else "continue"
        
        return {
            "question": question,
            "options": options,
            "action": action
        }
    
    except Exception as e:
        logger.error(f"Critical error in JSON extraction: {e}")
        return {
            "question": "I'm having trouble processing that. Could you please try again?",
            "options": ["Yes", "No"],
            "action": "continue"
        }

def generate(contents):
    """Generate response using Vertex AI with robust error handling"""
    try:
        # Validate environment first
        if not validate_environment():
            raise Exception("Environment validation failed")
        
        # Initialize Vertex AI client
        try:
            client = genai.Client(
                vertexai=True,
                project=PROJECT_ID,
                location=LOCATION
            )
        except Exception as client_error:
            logger.error(f"Failed to initialize Genai Client: {client_error}")
            raise Exception(f"Could not connect to AI service: {str(client_error)}")

        # System prompt with proper formatting
        system_prompt = """You are Alia, a physiotherapy AI assistant. You currently just deal with patients having problem or pain in their lower back. 
You follow the below tree to diagnose the patient and recommend them with appropriate next steps be it self-care or physiotherapy exercises or book a doctor's appointment. 
Be polite, empathetic and crisp with your responses. Give options for the answers along with your response in a JSON format as below:
{"question": "response", "options": ["option1", "option2", "option3"], "action": "continue"}
where, "question" is the question which needs to be asked, "options" comes respectively with the question and "action" will depend on the next steps and can take following values: continue, rom_api, dashboard_api.
The user might ask some clarifying questions in between, answer them and continue back with the appropriate tree path. 
The user might change the answer to some previous question which he/she answered incorrectly before, analyze it and continue back from the appropriate tree path question if the correction changes the tree path else acknowledge the user about the pain and continue the same path.
Reply with JSON only and nothing else.

TREE YAML:
- You first enquire about the intensity of the lower back pain of the patient with 0 being no pain and 10 being the most severe pain.
- Then ask the user whether bending forward or leaning backward is causing more discomfort.
- Follow by enquiring whether the pain started after an accident, injury, or a sudden strain on your back?
  - If the user answers something like "No, it just started on its own." mark it as spontaneous and try to notice whether the user was also having leg pain during this time.
    - If Yes, request the user to tell you whether it's in one leg or both.
      - If in Both Legs, Mark it as a critical situation and ask the user to address symptoms like numbness around perianal area, difficulty with bladder control or controlled urination, or loss of full rectal sensation.
        - If any or all are positive, ask the user to immediately report to ED and END the flow.
        - If all are negative, ask the user to address symptoms like fever, history of cancer, drug use, HIV, osteoporosis or night-time pain.
          - If any or all are positive, ask the user to take pain reliefs and if the situation persists for more than 2-3 days, advise them to consult a doctor because the pain can possibly be due to some infection, tumor or lumbar compression fracture.
          - If all are negative, ask the user to take video assessment for further understanding of the cause.
            - If the user agrees for video assessment, respond with: {"question": "Let's Start!", "options": [], "action": "rom_api"}
            - If the user disagrees for video assessment, respond with: {"question": "Sure, I'll analyze your responses only.", "options": [], "action": "dashboard_api"}
      - If in One Leg, ask the user to address symptoms like fever, history of cancer, drug use, HIV, osteoporosis or night-time pain.
        - If any or all are positive, ask the user to take pain reliefs and if the situation persists for more than 2-3 days, advise them to consult a doctor because the pain can possibly be due to some infection, tumor or lumbar compression fracture and END the flow.
        - If all are negative, ask the user to take video assessment for further understanding of the cause and END the flow.
            - If the user agrees for video assessment, respond with: {"question": "Let's Start!", "options": [], "action": "rom_api"}
            - If the user disagrees for video assessment, respond with: {"question": "Sure, I'll analyze your responses only.", "options": [], "action": "dashboard_api"}
    - If No, request the user to tell you whether it's getting worse as the days go by.
      - If Yes, ask the user to take video assessment for further understanding of the cause and END the flow.
        - If the user agrees for video assessment, respond with: {"question": "Let's Start!", "options": [], "action": "rom_api"}
        - If the user disagrees for video assessment, respond with: {"question": "Sure, I'll analyze your responses only.", "options": [], "action": "dashboard_api"}
      - If No, ask the user to take video assessment as it can be possibly because of lumbar strain and END the flow.
        - If the user agrees for video assessment, respond with: {"question": "Let's Start!", "options": [], "action": "rom_api"}
        - If the user disagrees for video assessment, respond with: {"question": "Sure, I'll analyze your responses only.", "options": [], "action": "dashboard_api"}
  - If the user answers something like "Yes, it began after I injured myself or overexerted my back." mark it under trauma. 
    - If the user has explained the situation well, continue; else, ask the user to explain the instance better.
    - If the situation can be classified as violence or road accident, Inform the user that reporting such cases is recommended, so advice them to reach out to the appropriate authorities. Else continue.
    - Next, question the user whether it's harder to walk than usual.
      - If Yes, ask if any part of their leg like knee, ankle, toe feel weak or unstable while walking.
        - If Yes, ask the user to immediately report to ED and END the flow.
        - If No, ask the user to take video assessment as it can be possibly because of lumbar strain or fracture and END the flow.
            - If the user agrees for video assessment, respond with: {"question": "Let's Start!", "options": [], "action": "rom_api"}
            - If the user disagrees for video assessment, respond with: {"question": "Sure, I'll analyze your responses only.", "options": [], "action": "dashboard_api"}
      - If No, ask the user to take video assessment as it can be possibly because of stable fracture or no fracture and END the flow.
        - If the user agrees for video assessment, respond with: {"question": "Let's Start!", "options": [], "action": "rom_api"}
        - If the user disagrees for video assessment, respond with: {"question": "Sure, I'll analyze your responses only.", "options": [], "action": "dashboard_api"}"""

        # Configure model generation with conservative settings
        generate_content_config = types.GenerateContentConfig(
            temperature=0.2,  # Low temperature for consistent responses
            top_p=0.8,
            max_output_tokens=512,
            response_modalities=["TEXT"],
            safety_settings=[
                types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_ONLY_HIGH"),
                types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_ONLY_HIGH"),
                types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_ONLY_HIGH"),
                types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_ONLY_HIGH")
            ],
            system_instruction=[types.Part.from_text(text=system_prompt)],
        )

        # Generate content with retry logic
        max_retries = 2
        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(
                    model="gemini-1.5-flash-002",
                    contents=contents,
                    config=generate_content_config,
                )
                
                if response and response.text:
                    # Clean and return response
                    cleaned_response = response.text.replace("\n", " ").strip()
                    logger.debug(f"Raw AI Response: {cleaned_response[:200]}...")
                    return cleaned_response
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
            "question": "I'm experiencing technical difficulties. Could you please repeat your last response?",
            "options": ["Yes", "No"],
            "action": "continue"
        })

@functions_framework.http
def xai_qna(request):
    """Main HTTP handler for the physiotherapy Q&A API with comprehensive error handling"""
    # CORS handling
    if request.method == "OPTIONS":
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

        # Extract chat history
        chat_history = request_json.get('chat_history') or request_args.get('chat_history')
        
        if not chat_history:
            # Return initial question for empty chat history
            initial_response = {
                'question': 'On a scale of 0-10, with 0 being no pain and 10 being the most severe, how would you rate your lower back pain?',
                'options': ['0-3 (Mild)', '4-6 (Moderate)', '7-10 (Severe)'],
                'action': 'continue'
            }
            return (json.dumps({
                'success': True, 
                'statusCode': 200, 
                'data': initial_response
            }), 200, headers)

        # Validate chat history format
        if not isinstance(chat_history, list):
            return (json.dumps({
                'success': False,
                'statusCode': 400,
                'data': {
                    'error': 'Chat history must be a list',
                    'question': 'Invalid format. Please try again.',
                    'options': [],
                    'action': 'continue'
                }
            }), 400, headers)

        # Process chat history with error handling
        contents = []
        for idx, item in enumerate(chat_history):
            try:
                if not isinstance(item, dict):
                    logger.warning(f"Skipping non-dict item at index {idx}")
                    continue
                
                # Add user message
                if 'user' in item and item['user']:
                    contents.append(types.Content(
                        role="user", 
                        parts=[types.Part.from_text(text=str(item['user']))]
                    ))
                
                # Add assistant/model response
                if 'assistant' in item and item['assistant']:
                    contents.append(types.Content(
                        role="model", 
                        parts=[types.Part.from_text(text=str(item['assistant']))]
                    ))
                elif 'response' in item and item['response']:
                    contents.append(types.Content(
                        role="model", 
                        parts=[types.Part.from_text(text=str(item['response']))]
                    ))
                    
            except Exception as item_error:
                logger.error(f"Error processing chat history item {idx}: {item_error}")
                continue

        # Ensure we have content to process
        if not contents:
            initial_response = {
                'question': 'Let me start over. On a scale of 0-10, how would you rate your lower back pain?',
                'options': ['0-3 (Mild)', '4-6 (Moderate)', '7-10 (Severe)'],
                'action': 'continue'
            }
            return (json.dumps({
                'success': True,
                'statusCode': 200,
                'data': initial_response
            }), 200, headers)

        # Generate response with error handling
        try:
            res = generate(contents)
            logger.info(f"Generated response length: {len(res)}")

            # Extract JSON safely
            response_data = extract_json_safely(res)
            
            # Validate and enhance response
            if not response_data.get('question'):
                response_data['question'] = 'Could you please tell me more about your symptoms?'
            
            # Ensure options is a list
            if not isinstance(response_data.get('options'), list):
                response_data['options'] = []
            
            # Determine action based on response content if not specified
            if not response_data.get('action') or response_data['action'] not in ['continue', 'rom_api', 'dashboard_api']:
                lower_question = response_data['question'].lower()
                
                if "let's start" in lower_question:
                    response_data['action'] = 'rom_api'
                elif "analyze your responses only" in lower_question:
                    response_data['action'] = 'dashboard_api'
                else:
                    response_data['action'] = 'continue'

            final_response = {
                'success': True, 
                'statusCode': 200, 
                'data': response_data
            }
            
            logger.info(f"Final response: {json.dumps(final_response)[:200]}...")
            return (json.dumps(final_response), 200, headers)

        except Exception as generation_error:
            logger.error(f"Response generation error: {generation_error}", exc_info=True)
            error_response = {
                'question': 'I apologize for the technical issue. Could you please repeat your last response?',
                'options': ['Yes', 'Start over'],
                'action': 'continue'
            }
            final_response = {
                'success': False, 
                'statusCode': 500, 
                'data': error_response
            }
            return (json.dumps(final_response), 500, headers)

    except Exception as e:
        logger.error(f"Unexpected error in xai_qna: {e}", exc_info=True)
        error_response = {
            'question': 'An unexpected error occurred. Would you like to start over?',
            'options': ['Yes', 'No'],
            'action': 'continue'
        }
        final_response = {
            'success': False, 
            'statusCode': 500, 
            'data': error_response
        }
        return (json.dumps(final_response), 500, headers)