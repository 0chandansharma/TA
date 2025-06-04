

import streamlit as st
import requests
import json
import time
import cv2
import numpy as np
from PIL import Image
import io
import base64
import pandas as pd
import matplotlib.pyplot as plt
import speech_recognition as sr
import pyttsx3
from streamlit_webrtc import webrtc_streamer, VideoProcessorBase, WebRtcMode
import av

# API endpoints
API_ENDPOINTS = {
    "conversation": "https://deecogs-xai-bot-844145949029.europe-west1.run.app/chat",  # Replace with your actual endpoint
    "rom_assessment": "https://deecogs-lbp-844145949029.us-central1.run.app",  # Replace with your actual endpoint
    "dashboard": "https://europe-west2-dochq-staging.cloudfunctions.net/deecogs-dashboard"  # Replace with your actual endpoint
}

# Set page configuration
st.set_page_config(page_title="Alia - MSK Assessment", page_icon="🩺", layout="wide", initial_sidebar_state="collapsed")

# Session state initialization
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []
if "session_id" not in st.session_state:
    st.session_state.session_id = f"session_{int(time.time())}"
if "assessment_stage" not in st.session_state:
    st.session_state.assessment_stage = "initial"  # initial, conversation, rom, dashboard
if "rom_data" not in st.session_state:
    st.session_state.rom_data = []
if "dashboard_data" not in st.session_state:
    st.session_state.dashboard_data = {}
if "voice_mode" not in st.session_state:
    st.session_state.voice_mode = False

# Custom styling
st.markdown("""
<style>
    .main {
        background-color: #f0f8ff;
    }
    .chat-message {
        padding: 1.5rem;
        border-radius: 0.5rem;
        margin-bottom: 1rem;
        display: flex;
        flex-direction: row;
        align-items: flex-start;
    }
    .chat-message.user {
        background-color: #e6f3ff;
    }
    .chat-message.assistant {
        background-color: #d1ffdd;
    }
    .avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        margin-right: 1rem;
        object-fit: cover;
    }
    .message-content {
        flex: 1;
    }
    .btn-primary {
        background-color: #4CAF50;
        color: white;
        padding: 10px 20px;
        text-align: center;
        text-decoration: none;
        display: inline-block;
        font-size: 16px;
        margin: 4px 2px;
        cursor: pointer;
        border-radius: 5px;
    }
    .dashboard-card {
        background-color: white;
        padding: 1.5rem;
        border-radius: 10px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        margin-bottom: 1rem;
    }
    .btn-voice {
        background-color: #ff5757;
        color: white;
        border-radius: 50%;
        width: 60px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto;
    }
    .symptom-tag {
        background-color: #ff7f7f;
        color: white;
        padding: 5px 10px;
        border-radius: 15px;
        display: inline-block;
        margin-right: 5px;
        margin-bottom: 5px;
    }
    .condition-tag {
        background-color: #7f7fff;
        color: white;
        padding: 5px 10px;
        border-radius: 15px;
        display: inline-block;
        margin-right: 5px;
        margin-bottom: 5px;
    }
    .next-step-tag {
        background-color: #7fff7f;
        color: black;
        padding: 5px 10px;
        border-radius: 15px;
        display: inline-block;
        margin-right: 5px;
        margin-bottom: 5px;
    }
</style>
""", unsafe_allow_html=True)

# Helper functions
def text_to_speech(text):
    """Convert text to speech and play it"""
    if not st.session_state.voice_mode:
        return
    
    engine = pyttsx3.init()
    engine.say(text)
    engine.runAndWait()
    
def speech_to_text():
    """Convert speech to text"""
    if not st.session_state.voice_mode:
        return ""
    
    r = sr.Recognizer()
    with sr.Microphone() as source:
        st.info("Listening... Speak now")
        audio = r.listen(source)
        st.info("Processing speech...")
    
    try:
        text = r.recognize_google(audio)
        return text
    except Exception as e:
        st.error(f"Could not recognize speech: {e}")
        return ""

def call_conversation_api(user_message):
    """Call the conversation API with the current chat history"""
    chat_history = st.session_state.chat_history.copy()
    
    # Add the latest user message
    if user_message:
        chat_history.append({"user": user_message})
    
    try:
        response = requests.post(
            API_ENDPOINTS["conversation"],
            json={"chat_history": chat_history, "session_id": st.session_state.session_id},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                ai_response = data["data"]
                chat_history.append({"response": ai_response["question"]})
                st.session_state.chat_history = chat_history
                
                # Check if we need to transition to another stage
                if ai_response["action"] == "rom_api":
                    st.session_state.assessment_stage = "rom"
                elif ai_response["action"] == "dashboard_api":
                    st.session_state.assessment_stage = "dashboard"
                    call_dashboard_api()
                
                return ai_response
            else:
                st.error("API returned an error: " + data.get("data", {}).get("error", "Unknown error"))
        else:
            st.error(f"API request failed with status code {response.status_code}")
    except Exception as e:
        st.error(f"Error calling conversation API: {e}")
    
    return None

def call_rom_api():
    """Call the ROM assessment API"""
    try:
        response = requests.post(
            API_ENDPOINTS["rom_assessment"],
            json={"session_id": st.session_state.session_id},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                st.session_state.rom_data = data["data"]["exercises"]
                # After ROM assessment is complete, move to dashboard
                st.session_state.assessment_stage = "dashboard"
                call_dashboard_api()
                return True
            else:
                st.error("ROM API returned an error: " + data.get("data", {}).get("error", "Unknown error"))
        else:
            st.error(f"ROM API request failed with status code {response.status_code}")
    except Exception as e:
        st.error(f"Error calling ROM API: {e}")
    
    return False

def call_dashboard_api():
    """Call the dashboard API to get assessment summary"""
    try:
        response = requests.get(
            f"{API_ENDPOINTS['dashboard']}/{st.session_state.session_id}",
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                st.session_state.dashboard_data = data["data"]
                return True
            else:
                st.error("Dashboard API returned an error: " + data.get("data", {}).get("error", "Unknown error"))
        else:
            st.error(f"Dashboard API request failed with status code {response.status_code}")
    except Exception as e:
        st.error(f"Error calling Dashboard API: {e}")
    
    return False

class VideoProcessor(VideoProcessorBase):
    """Video processor for ROM assessment"""
    def __init__(self):
        self.frame_count = 0
        self.exercise_name = "Forward Bend"
    
    def recv(self, frame):
        img = frame.to_ndarray(format="bgr24")
        self.frame_count += 1
        
        # Placeholder for pose detection
        # In a real implementation, you would integrate with Sports2D here
        # For demo purposes, we'll draw some skeleton points
        if self.frame_count % 5 == 0:  # Process every 5th frame
            # Draw skeleton (simplified)
            height, width = img.shape[:2]
            cv2.circle(img, (int(width/2), int(height/2)), 5, (0, 255, 0), -1)  # Head
            cv2.line(img, (int(width/2), int(height/2)), (int(width/2), int(height/2+50)), (0, 255, 0), 2)  # Spine
            cv2.line(img, (int(width/2), int(height/2+50)), (int(width/2-40), int(height/2+100)), (0, 255, 0), 2)  # Left leg
            cv2.line(img, (int(width/2), int(height/2+50)), (int(width/2+40), int(height/2+100)), (0, 255, 0), 2)  # Right leg
            
            # Add angle measurement (for demo)
            angle_text = f"{self.exercise_name}: {120}°"
            cv2.putText(img, angle_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        
        return av.VideoFrame.from_ndarray(img, format="bgr24")

# Main app layout
def main():
    # Header
    st.title("Alia - Remote Musculoskeletal Assessment")
    st.subheader("Lower Back Pain Triage & Assessment")
    
    # Toggle for voice mode
    voice_toggle = st.sidebar.checkbox("Enable Voice Interaction", value=st.session_state.voice_mode)
    if voice_toggle != st.session_state.voice_mode:
        st.session_state.voice_mode = voice_toggle
        st.rerun()
    
    # Display based on current stage
    if st.session_state.assessment_stage == "initial":
        show_initial_screen()
    elif st.session_state.assessment_stage == "conversation":
        show_conversation_screen()
    elif st.session_state.assessment_stage == "rom":
        show_rom_assessment_screen()
    elif st.session_state.assessment_stage == "dashboard":
        show_dashboard_screen()

def show_initial_screen():
    """Display the initial welcome screen"""
    col1, col2, col3 = st.columns([1, 2, 1])
    
    with col2:
        st.markdown("""
        <div style="text-align: center; padding: 2rem;">
            <img src="https://via.placeholder.com/150" alt="Alia Logo" style="border-radius: 50%;">
            <h2>Welcome to Alia</h2>
            <p>Your AI-powered physiotherapy assistant</p>
            <p>I'm here to help assess your lower back pain and provide guidance.</p>
        </div>
        """, unsafe_allow_html=True)
        
        if st.button("Start Assessment", key="start_btn"):
            st.session_state.assessment_stage = "conversation"
            # Initialize with first AI message
            initial_response = call_conversation_api("")
            if initial_response and st.session_state.voice_mode:
                text_to_speech(initial_response["question"])
            st.experimental_rerun()

def show_conversation_screen():
    """Display the conversation interface"""
    st.subheader("Assessment Interview")
    
    # Display chat history
    for i, message in enumerate(st.session_state.chat_history):
        if "user" in message:
            st.markdown(f"""
            <div class="chat-message user">
                <img src="https://via.placeholder.com/40" class="avatar">
                <div class="message-content">
                    <p><strong>You:</strong> {message["user"]}</p>
                </div>
            </div>
            """, unsafe_allow_html=True)
        elif "response" in message:
            st.markdown(f"""
            <div class="chat-message assistant">
                <img src="https://via.placeholder.com/40" class="avatar">
                <div class="message-content">
                    <p><strong>Alia:</strong> {message["response"]}</p>
                </div>
            </div>
            """, unsafe_allow_html=True)
    
    # Get the most recent AI response
    latest_response = None
    if st.session_state.chat_history and "response" in st.session_state.chat_history[-1]:
        for message in reversed(st.session_state.chat_history):
            if "response" in message:
                latest_response_text = message["response"]
                # Find the corresponding complete response with options
                for i, message in enumerate(st.session_state.chat_history):
                    if "response" in message and message["response"] == latest_response_text:
                        if i > 0 and i < len(st.session_state.chat_history) - 1:
                            latest_response = {"question": latest_response_text, "options": ["Yes", "No"]}
                            break
    
    # Input area
    st.markdown("### Your Response")
    if st.session_state.voice_mode:
        col1, col2 = st.columns([3, 1])
        with col1:
            user_input = st.text_input("Type your response:", key="user_input")
        with col2:
            if st.button("🎤", key="voice_btn"):
                user_input = speech_to_text()
                if user_input:
                    st.session_state.chat_history.append({"user": user_input})
                    ai_response = call_conversation_api(None)  # Already added to history
                    if ai_response:
                        text_to_speech(ai_response["question"])
                    st.experimental_rerun()
    else:
        user_input = st.text_input("Type your response:", key="user_input")
    
    # Option buttons if available
    if latest_response and "options" in latest_response and latest_response["options"]:
        st.markdown("### Quick Responses")
        cols = st.columns(min(4, len(latest_response["options"])))
        for i, option in enumerate(latest_response["options"]):
            with cols[i % min(4, len(latest_response["options"]))]:
                if st.button(option, key=f"option_{i}"):
                    st.session_state.chat_history.append({"user": option})
                    ai_response = call_conversation_api(None)  # Already added to history
                    if ai_response and st.session_state.voice_mode:
                        text_to_speech(ai_response["question"])
                    st.experimental_rerun()
    
    # Submit button for text input
    if st.button("Submit", key="submit_btn"):
        if user_input:
            st.session_state.chat_history.append({"user": user_input})
            ai_response = call_conversation_api(None)  # Already added to history
            if ai_response and st.session_state.voice_mode:
                text_to_speech(ai_response["question"])
            st.experimental_rerun()

def show_rom_assessment_screen():
    """Display the ROM assessment interface"""
    st.subheader("Range of Motion Assessment")
    
    # Instructions
    st.markdown("""
    ### Instructions:
    1. Position yourself so your full body is visible in the camera
    2. Stand approximately 2 meters away from the camera
    3. Follow the on-screen instructions for each movement
    4. Try to move slowly and steadily for accurate measurements
    """)
    
    # Exercise selection for demo
    exercise = st.selectbox(
        "Select exercise to perform:",
        ["Forward Bend", "Back Bend", "Side Bend (Left)", "Side Bend (Right)"]
    )
    
    # Camera feed with pose detection
    st.markdown("### Camera Feed")
    webrtc_ctx = webrtc_streamer(
        key="rom-assessment",
        mode=WebRtcMode.SENDRECV,
        video_processor_factory=VideoProcessor,
        media_stream_constraints={"video": True, "audio": False},
        async_processing=True,
    )
    
    # Progress bar for demo purposes
    if webrtc_ctx.video_transformer:
        webrtc_ctx.video_transformer.exercise_name = exercise
        progress = st.progress(0)
        for i in range(101):
            progress.progress(i)
            time.sleep(0.05)
        
        # Simulated results
        st.success(f"Exercise '{exercise}' completed!")
        st.metric(label="Achieved Range", value=f"{120}°", delta=f"{-30}° from expected")
        
        # Add to ROM data for demo
        st.session_state.rom_data.append({
            "exercise": exercise,
            "expected": 150,
            "achieved": 120,
            "unit": "degrees"
        })
        
    # Continue button
    if st.button("Complete Assessment", key="complete_rom"):
        st.session_state.assessment_stage = "dashboard"
        call_dashboard_api()
        st.experimental_rerun()

def show_dashboard_screen():
    """Display the assessment dashboard and results"""
    st.subheader("Assessment Summary")
    
    # If we have dashboard data, display it
    if st.session_state.dashboard_data:
        # For demo, create sample data if not present
        if not st.session_state.dashboard_data.get("symptoms"):
            st.session_state.dashboard_data = {
                "symptoms": ["Lower Back Sprain", "Slip Disc"],
                "range_of_motion": [
                    {"exercise": "Forward Bend", "expected": 150, "achieved": 120, "unit": "degrees"},
                    {"exercise": "Back Bend", "expected": 60, "achieved": 30, "unit": "degrees"}
                ],
                "interview_responses": [
                    {"question": "When did your lower back pain start?", "answer": "It started within the last week."},
                    {"question": "On a scale of 0-10, how would you rate your pain?", "answer": "7"}
                ],
                "possible_conditions": [
                    {"name": "Lower Back Sprain", "probability": 0.8},
                    {"name": "Slip Disc", "probability": 0.6}
                ],
                "next_steps": [
                    {"type": "managed-care", "description": "Rest and apply ice for 20 minutes every 2-3 hours"},
                    {"type": "managed-care", "description": "Take over-the-counter pain relievers as needed"},
                    {"type": "specialist", "description": "If pain persists for more than a week, consult a physiotherapist"}
                ]
            }
        
        # Create dashboard layout
        col1, col2 = st.columns(2)
        
        with col1:
            # Symptoms
            st.markdown("""
            <div class="dashboard-card">
                <h3>Your Symptoms</h3>
            """, unsafe_allow_html=True)
            
            for symptom in st.session_state.dashboard_data.get("symptoms", []):
                st.markdown(f"""
                <span class="symptom-tag">{symptom}</span>
                """, unsafe_allow_html=True)
            
            st.markdown("</div>", unsafe_allow_html=True)
            
            # ROM data
            st.markdown("""
            <div class="dashboard-card">
                <h3>Range Of Motion</h3>
            """, unsafe_allow_html=True)
            
            rom_data = []
            for exercise in st.session_state.dashboard_data.get("range_of_motion", []):
                rom_data.append([
                    exercise["exercise"],
                    f"{exercise['expected']}{exercise.get('unit', '°')}",
                    f"{exercise['achieved']}{exercise.get('unit', '°')}"
                ])
            
            if rom_data:
                df = pd.DataFrame(rom_data, columns=["Exercise", "Expected", "Achieved"])
                st.table(df)
                
                # Create bar chart
                exercises = [item["exercise"] for item in st.session_state.dashboard_data.get("range_of_motion", [])]
                expected = [item["expected"] for item in st.session_state.dashboard_data.get("range_of_motion", [])]
                achieved = [item["achieved"] for item in st.session_state.dashboard_data.get("range_of_motion", [])]
                
                fig, ax = plt.subplots(figsize=(10, 5))
                x = range(len(exercises))
                width = 0.35
                
                ax.bar([i - width/2 for i in x], expected, width, label='Expected', color='blue', alpha=0.7)
                ax.bar([i + width/2 for i in x], achieved, width, label='Achieved', color='green', alpha=0.7)
                
                ax.set_ylabel('Degrees')
                ax.set_title('Range of Motion')
                ax.set_xticks(x)
                ax.set_xticklabels(exercises)
                ax.legend()
                
                st.pyplot(fig)
            
            st.markdown("</div>", unsafe_allow_html=True)
        
        with col2:
            # Interview
            st.markdown("""
            <div class="dashboard-card">
                <h3>Interview</h3>
            """, unsafe_allow_html=True)
            
            for item in st.session_state.dashboard_data.get("interview_responses", []):
                st.markdown(f"""
                <p><strong>{item['question']}</strong><br>
                {item['answer']}</p>
                """, unsafe_allow_html=True)
            
            st.markdown("""
                <div style="text-align: center;">
                    <button class="btn-primary">See More ▼</button>
                </div>
            </div>
            """, unsafe_allow_html=True)
            
            # Possible conditions
            st.markdown("""
            <div class="dashboard-card">
                <h3>Possible Conditions</h3>
            """, unsafe_allow_html=True)
            
            for condition in st.session_state.dashboard_data.get("possible_conditions", []):
                st.markdown(f"""
                <div>
                    <span class="condition-tag">{condition['name']}</span>
                    <span style="float: right;">ℹ️</span>
                </div>
                """, unsafe_allow_html=True)
            
            st.markdown("</div>", unsafe_allow_html=True)
            
            # Next steps
            st.markdown("""
            <div class="dashboard-card">
                <h3>Next Steps</h3>
            """, unsafe_allow_html=True)
            
            for step in st.session_state.dashboard_data.get("next_steps", []):
                st.markdown(f"""
                <p><strong>{step['type'].title()}</strong><br>
                {step['description']}</p>
                """, unsafe_allow_html=True)
            
            st.markdown("""
                <div style="text-align: center;">
                    <button class="btn-primary">Managed Care Options</button>
                </div>
            </div>
            """, unsafe_allow_html=True)
    
    # If no dashboard data, show loading
    else:
        st.info("Generating your assessment summary...")
        st.spinner("Please wait...")
        # Attempt to get dashboard data
        call_dashboard_api()
        time.sleep(2)  # For demo purposes
        st.experimental_rerun()
    
    # Action buttons
    col1, col2, col3 = st.columns(3)
    with col1:
        if st.button("Start New Assessment", key="new_assessment"):
            # Reset all state
            st.session_state.chat_history = []
            st.session_state.session_id = f"session_{int(time.time())}"
            st.session_state.assessment_stage = "initial"
            st.session_state.rom_data = []
            st.session_state.dashboard_data = {}
            st.experimental_rerun()
    
    with col2:
        if st.button("Download Report (PDF)", key="download_pdf"):
            st.success("Report downloaded successfully!")
    
    with col3:
        if st.button("Book Appointment", key="book_appointment"):
            st.info("Redirecting to appointment booking system...")

# Run the app
if __name__ == "__main__":
    main()