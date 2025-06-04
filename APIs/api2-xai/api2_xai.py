import functions_framework
from google import genai
from google.genai import types
import base64
import json
import os
import logging
import re

# Configure logging
logging.basicConfig(level=logging.DEBUG, 
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Ensure credentials path is set correctly
CREDENTIALS_PATH = './credentials.json'
if os.path.exists(CREDENTIALS_PATH):
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = CREDENTIALS_PATH
else:
    logger.error(f"Credentials file not found at {CREDENTIALS_PATH}")

def extract_json_safely(response_text):
    """
    Attempt to extract a valid JSON object from the response text with multiple strategies
    """
    def clean_json_string(json_str):
        # Remove any leading/trailing non-JSON characters
        json_str = json_str.strip()
        # Ensure proper JSON formatting
        json_str = json_str.replace("'", '"')
        return json_str

    try:
        # Strategy 1: Direct JSON extraction
        json_match = re.search(r'\{.*?"question".*?"options".*?"action".*?\}', response_text, re.DOTALL)
        
        if json_match:
            try:
                json_str = clean_json_string(json_match.group(0))
                parsed_json = json.loads(json_str)
                
                # Validate key structure
                if all(key in parsed_json for key in ['question', 'options', 'action']):
                    return parsed_json
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse JSON directly. Raw text: {response_text}")
        
        # Strategy 2: Manually construct JSON if extraction fails
        logger.info("Falling back to manual JSON construction")
        return {
            "question": re.search(r'"question"\s*:\s*"([^"]*)"', response_text)
                        .group(1) if re.search(r'"question"\s*:\s*"([^"]*)"', response_text) else "Unable to process response",
            "options": [],
            "action": "continue"
        }
    
    except Exception as e:
        logger.error(f"Critical error in JSON extraction: {e}")
        return {
            "question": "An unexpected error occurred while processing the response",
            "options": [],
            "action": "continue"
        }

def generate(contents):
    """
    Generate response using Gemini AI with specific configuration
    """
    try:
        # Initialize Vertex AI client
        client = genai.Client(
            vertexai=True,
            project="dochq-staging",
            location="us-central1"
        )

        # System prompt (kept exactly as in the original code)
        system_prompt = """\"\"\"You are Alia, a physiotherapy AI assistant. You currently just deal with patients having problem or pain in their lower back. 
        You follow the below tree to diagnose the patient and recommend them with appropriate next steps be it self-care or physiotherapy exercises or book a doctor\\'s appointment. 
        Be polite, empath and crisp with your responses. Give options for the answers along with your response in a JSON format as below:
            {{'question': response, 'options': [..., ..., ...]}, "action": ...}
        where, "response" is the question which needs to be asked, "options" comes respectively with the question and "action" will depend on the next steps and can take following values: continue, rom_api, dashboard_api.
        The user might ask some clarifying questions in between, answer them and continue back with the appropriate tree path. 
        The user might change the answer to some previous question which he/she answered incorrectly before, analyze it and continue back from the the appropriate tree path question if the correction changes the tree path else acknowledge the user about the pain and continue the same path.
        Reply with JSON only and nothing else.

        TREE YAML:
        - You first enquire about the intensity f the lower back pain of the patient with 0 being no pain and 10 being the most severe pain.
        - Then ask the user whether bending forward or leaning backward is causing more discomfort.
        - Follow by enquiring whether the pain started after an accident, injury, or a sudden strain on your back?
          - If the user answers something like \"No, it just started on its own.\" mark it as spontaneous and try to notice whether the user was also having leg pain during this time.
            - If Yes, request the user to tell you whether it's in one leg or both.
              - If in Both Legs, Mark it as a critical situation and ask the user to address symptoms like numbness around perianal area, difficulty with bladder control or controlled urination, or loss of full rectal sensation.
                - If any or all are positive, ask the user to immediately report to ED and END the flow.
                - If all are negative, ask the user to address symptoms like fever, history of cancer, drug use, HIV, osteoporosis or night-time pain.
                  - If any or all are positive, ask the user to take pain reliefs and if the situation persists for more than 2-3 days, advise them to consult a doctor because the pain can possibly be due to some infection, tumor or lumbar compression fracture.
                  - If all are negative, ask the user to take video assessment for further understanding of the cause.
                    - If the user agrees for video assessment, strictly respond with string without modification\"Let's Start!\"
                    - If the user disagrees for video assessment, respond with \"Sure, I'll analyze your responses only.\"
              - If in One Leg, ask the user to address symptoms like fever, history of cancer, drug use, HIV, osteoporosis or night-time pain.
                - If any or all are positive, ask the user to take pain reliefs and if the situation persists for more than 2-3 days, advise them to consult a doctor because the pain can possibly be due to some infection, tumor or lumbar compression fracture and END the flow.
                - If all are negative, ask the user to take video assessment for further understanding of the cause and END the flow.
                    - If the user agrees for video assessment, strictly respond with string without modification \"Let's Start!\"
                    - If the user disagrees for video assessment, respond with \"Sure, I'll analyze your responses only.\"
            - If No, request the user to tell you whether it's getting worse as the days go by.
              - If Yes, ask the user to take video assessment for further understanding of the cause and END the flow.
                - If the user agrees for video assessment, strictly respond with string without modification \"Let's Start!\"
                - If the user disagrees for video assessment, respond with \"Sure, I'll analyze your responses only.\"
              - If No, ask the user to take video assessment as it can be possibly because of lumbar strain and END the flow.
                - If the user agrees for video assessment, strictly respond with string without modification \"Let's Start!\"
                - If the user disagrees for video assessment, respond with \"Sure, I'll analyze your responses only.\"
          - If the user answers something like \"Yes, it began after I injured myself or overexerted my back.\" mark it under trauma. 
            - If the user has explained the situation well, continue; else, ask the user to explain the instance better.
            - If the situation can be classified as violence or road accident, Inform the user that reporting such cases is recommended, so advice them to reach out to the appropriate authorities. Else continue.
            - Next, question the user whether it's harder to walk than usual.
              - If Yes, ask if any part of their leg like knee, ankle, toe feel weak or unstable while walking.
                - If Yes, ask the user to immediately report to ED and END the flow.
                - If No, ask the user to take video assessment as it can be possibly because of lumbar strain or fracture and END the flow.
                    - If the user agrees for video assessment, strictly respond with following string without modification \"Let's Start!\"
                    - If the user disagrees for video assessment, respond with \"Sure, I'll analyze your responses only.\"
              - If No, ask the user to take video assessment as it can be possibly because of stable fracture or no fracture and END the flow.
                - If the user agrees for video assessment, strictly respond with string without modification \"Let's Start!\"
                - If the user disagrees for video assessment, respond with \"Sure, I'll analyze your responses only.\"\"\"\""""

        # Configure model generation
        generate_content_config = types.GenerateContentConfig(
            temperature=0.2,
            top_p=0.8,
            max_output_tokens=1024,
            response_modalities=["TEXT"],
            safety_settings=[
                types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
                types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"),
                types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"),
                types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF")
            ],
            system_instruction=[types.Part.from_text(text=system_prompt)],
        )

        # Generate content
        response = client.models.generate_content(
            model="gemini-1.5-flash-002",
            contents=contents,
            config=generate_content_config,
        )
        
        # Log and return cleaned response text
        logger.debug(f"Raw AI Response: {response.text}")
        return response.text.replace("\n", "").strip()

    except Exception as e:
        logger.error(f"Error in generate function: {e}")
        raise

@functions_framework.http
def xai_qna(request):
    """
    Main HTTP handler for the physiotherapy Q&A API
    """
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
        # Extract chat history
        request_json = request.get_json(silent=True) or {}
        request_args = request.args or {}
        chat_history = request_json.get('chat_history') or request_args.get('chat_history')
        
        if not chat_history:
            error_response = {
                'error': 'No chat history provided',
                'question': 'Unable to process request',
                'options': [],
                'action': 'continue'
            }
            return (json.dumps({
                'success': False, 
                'statusCode': 400, 
                'data': error_response
            }), 400, headers)

        # Process chat history
        contents = []
        for item in chat_history:
            try:
                if 'user' in item:
                    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=item['user'])]))
                if 'response' in item:
                    contents.append(types.Content(role="model", parts=[types.Part.from_text(text=item['response'])]))
            except Exception as item_error:
                logger.error(f"Error processing chat history item: {item_error}")
                continue

        # Generate response
        try:
            res = generate(contents)
            logger.debug(f"Processed response: {res}")

            # Extract JSON safely
            response_data = extract_json_safely(res)

            # Determine action based on multiple criteria
            rom_api_triggers = [
                "let's start",
                "start assessment", 
                "video assessment", 
                "ready for movement check",
                "please show your movement"
            ]
            
            dashboard_api_triggers = [
                "sure, i'll analyze",
                "no video assessment",
                "responses only",
                "continue without video"
            ]

            # Convert question to lowercase for case-insensitive matching
            lower_question = response_data['question'].lower()

            # Determine action based on trigger words
            if any(trigger in lower_question for trigger in rom_api_triggers):
                response_data['action'] = 'rom_api'
            elif any(trigger in lower_question for trigger in dashboard_api_triggers):
                response_data['action'] = 'dashboard_api'
            
            # Additional fallback logic
            if 'action' not in response_data or not response_data['action']:
                # Check if there are options to continue or if more info is needed
                if response_data.get('options'):
                    response_data['action'] = 'continue'
                else:
                    # If no clear path, default to rom_api to keep the flow moving
                    response_data['action'] = 'rom_api'

            final_response = {
                'success': True, 
                'statusCode': 200, 
                'data': response_data
            }
            logger.info(f"Final Response: {final_response}")
            return (json.dumps(final_response), 200, headers)

        except Exception as generation_error:
            logger.error(f"Response generation error: {generation_error}", exc_info=True)
            error_response = {
                'question': 'Unable to generate response',
                'options': [],
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
            'question': 'An unexpected error occurred',
            'options': [],
            'action': 'continue'
        }
        final_response = {
            'success': False, 
            'statusCode': 500, 
            'data': error_response
        }
        return (json.dumps(final_response), 500, headers)