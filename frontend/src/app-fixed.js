import React, { useEffect, useRef, useState, useCallback } from 'react';

import './assets/styles/app.css';
import AiAvatar from './core/components/AiAvatar';
import AiDashboard from './core/components/AiDashboard';
import AiQus from './core/components/AiQus';
import AiRomMain from './core/components/AiRomMain';
import AiVideo from './core/components/AiVideo';
import ServiceChat from './core/services/serviceChat';

export default function App() {
    const [voices, setVoices] = useState([]);
    const [chatHistory, setChatHistory] = useState([]);
    const [QnAHistory, setQnAHistory] = useState([]);
    const [aiSpeaking, setAiSpeaking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [nextQuestion, setNextQuestion] = useState(false);

    const [recognition, setRecognition] = useState(null);
    const [analyser, setAnalyser] = useState(true);

    const [status, setStatus] = useState("");
    const [currentDisplayText, setCurrentDisplayText] = useState("");
    const [stage, setStage] = useState("idle");

    const [isStart, setIsStart] = useState(false);
    const [isOpen, setIsOpen] = useState(true);

    const [assessmentId, setAssessmentId] = useState(null);
    const assessmentIdRef = useRef(null);
    const [step, setStep] = useState(0);

    // Refs for cleanup
    const audioContextRef = useRef(null);
    const recognitionRef = useRef(null);
    const timeoutRefs = useRef([]);
    const isMountedRef = useRef(true);

    const mainService = new ServiceChat();

    // Cleanup function for timeouts
    const clearAllTimeouts = useCallback(() => {
        timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
        timeoutRefs.current = [];
    }, []);

    // Safe setState wrapper
    const safeSetState = useCallback((setter, value) => {
        if (isMountedRef.current) {
            setter(value);
        }
    }, []);

    // Initialize speech recognition with proper error handling
    const init = useCallback(async () => {
        try {
            // Check browser compatibility
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                safeSetState(setStatus, "Speech recognition not supported in this browser");
                return;
            }

            const recog = new SpeechRecognition();
            recog.continuous = false;
            recog.interimResults = false;
            recog.lang = "en-US";
            
            recognitionRef.current = recog;
            safeSetState(setRecognition, recog);

            // Load voices
            const loadVoices = () => {
                const availableVoices = window.speechSynthesis.getVoices();
                safeSetState(setVoices, availableVoices);
            };

            loadVoices();
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = loadVoices;
            }
        } catch (error) {
            console.error('Error initializing speech:', error);
            safeSetState(setStatus, "Error initializing speech features");
        }
    }, [safeSetState]);

    // Speak text with proper cleanup
    const speakText = useCallback((text, isAiSpeaking = false, listenNext = true, stepNumber = 0) => {
        if (!("speechSynthesis" in window)) {
            alert("Text-to-Speech is not supported in this browser.");
            return;
        }

        try {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();

            // Clean up previous audio context
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }

            // Create new audio context for visualization
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioContextRef.current = audioContext;
            
            const analyserNode = audioContext.createAnalyser();
            analyserNode.fftSize = 256;
            safeSetState(setAnalyser, analyserNode);

            if (isAiSpeaking) {
                safeSetState(setStatus, "AI is speaking...");
            }

            const utterance = new SpeechSynthesisUtterance(text);
            const femaleVoice = voices.find((voice) => voice.name.includes("Female"));
            if (femaleVoice) {
                utterance.voice = femaleVoice;
            }
            utterance.rate = 0.8;
            
            utterance.onend = () => {
                safeSetState(setStatus, "");
                if (listenNext && isMountedRef.current) {
                    startListening();
                }
                
                // Handle video step
                if (stepNumber === 8) {
                    const timeout1 = setTimeout(() => {
                        safeSetState(setCurrentDisplayText, "");
                        safeSetState(setStep, stepNumber);
                    }, 5000);
                    timeoutRefs.current.push(timeout1);
                    
                    // Countdown timer
                    for (let i = 5; i >= 0; i--) {
                        const timeout2 = setTimeout(() => {
                            if (i === 0) {
                                safeSetState(setCurrentDisplayText, "");
                            } else {
                                safeSetState(setCurrentDisplayText, `Please be ready in ${i} seconds`);
                            }
                        }, (5 - i) * 1000);
                        timeoutRefs.current.push(timeout2);
                    }
                }
            };

            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event);
                safeSetState(setStatus, "");
                if (listenNext && isMountedRef.current) {
                    startListening();
                }
            };

            window.speechSynthesis.speak(utterance);
        } catch (error) {
            console.error('Error in speakText:', error);
            safeSetState(setStatus, "Error speaking text");
        }
    }, [voices, safeSetState, startListening]);

    // Stop listening with proper cleanup
    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.abort();
                safeSetState(setIsListening, false);
            } catch (error) {
                console.error('Error stopping recognition:', error);
            }
        }
    }, [safeSetState]);

    // Start listening with error handling
    const startListening = useCallback(() => {
        if (!recognitionRef.current || !isMountedRef.current) {
            return;
        }

        try {
            // Clear any existing handlers
            recognitionRef.current.onresult = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.onend = null;

            recognitionRef.current.onstart = () => {
                safeSetState(setIsListening, true);
                safeSetState(setStatus, "Listening...");
            };

            recognitionRef.current.onresult = (event) => {
                if (event.results.length > 0) {
                    const userSpeech = event.results[0][0].transcript;
                    sendChat(userSpeech, assessmentIdRef.current);
                }
            };

            recognitionRef.current.onerror = (event) => {
                console.error('Recognition error:', event.error);
                safeSetState(setStatus, "Error: Please try again.");
                safeSetState(setIsListening, false);
                
                // Don't auto-restart on 'no-speech' or 'aborted' errors
                if (event.error !== 'no-speech' && event.error !== 'aborted') {
                    const timeout = setTimeout(() => {
                        if (isMountedRef.current) {
                            startListening();
                        }
                    }, 2000);
                    timeoutRefs.current.push(timeout);
                }
            };

            recognitionRef.current.onend = () => {
                safeSetState(setIsListening, false);
            };

            recognitionRef.current.start();
        } catch (error) {
            console.error('Error starting recognition:', error);
            safeSetState(setStatus, "Microphone access denied or unavailable");
            safeSetState(setIsListening, false);
        }
    }, [safeSetState, sendChat]);

    // Send chat with error handling
    const sendChat = useCallback(async (message, assID, isImage = false) => {
        if (!isImage) {
            safeSetState(setCurrentDisplayText, message);
        }
        safeSetState(setStatus, "Talking to the AI...");
        safeSetState(setIsListening, false);
        stopListening();

        try {
            const newMessage = { user: message };
            
            // Use functional update to ensure we have latest state
            setChatHistory(prevChats => {
                const updatedChats = [...prevChats, newMessage];
                
                // Make API call with updated chats
                const bodyChat = { chat_history: updatedChats };
                
                mainService.chatWithAI(bodyChat, '', assID)
                    .then((res) => {
                        if (res && res['success']) {
                            if (!isStart) {
                                safeSetState(setStage, "chat");
                            }
                            
                            const chatRes = res['data']['response'];
                            
                            // Update chat history with response
                            setChatHistory(latestChats => {
                                const updatedWithResponse = [...latestChats];
                                if (updatedWithResponse.length > 0) {
                                    updatedWithResponse[updatedWithResponse.length - 1].response = chatRes;
                                }
                                return updatedWithResponse;
                            });
                            
                            const next_action = res['data']['action'];
                            
                            if (next_action === "camera_on") {
                                const pain_location_video_step = 8;
                                safeSetState(setCurrentDisplayText, chatRes);
                                speakText(chatRes, true, false, pain_location_video_step);
                            } else if (next_action !== "next_api") {
                                safeSetState(setCurrentDisplayText, chatRes);
                                speakText(chatRes, true);
                            } else {
                                safeSetState(setCurrentDisplayText, "");
                                speakText(chatRes, true, false);
                                const QnA_step = 11;
                                safeSetState(setStep, QnA_step);
                                safeSetState(setAnalyser, false);
                            }
                        } else {
                            throw new Error('Invalid response from AI service');
                        }
                    })
                    .catch((error) => {
                        console.error('Chat API error:', error);
                        safeSetState(setStatus, "Error communicating with AI. Please try again.");
                        // Retry after delay
                        const timeout = setTimeout(() => {
                            if (isMountedRef.current) {
                                startListening();
                            }
                        }, 3000);
                        timeoutRefs.current.push(timeout);
                    });
                
                return updatedChats;
            });
        } catch (error) {
            console.error('Error in sendChat:', error);
            safeSetState(setStatus, "Error processing your message");
        }
    }, [isStart, mainService, safeSetState, speakText, startListening, stopListening]);

    // Send answer to QnA API with error handling
    const sendAnswerToAPI = useCallback(async (answer, assID, isFinal = false) => {
        safeSetState(setStatus, "Talking to the AI...");
        safeSetState(setIsListening, false);
        stopListening();

        try {
            const newMessage = { user: answer };
            
            setQnAHistory(prevQuestions => {
                const updatedQuestions = [...prevQuestions, newMessage];
                const bodyChat = { chat_history: updatedQuestions };
                
                mainService.chatWithQnAAI(bodyChat, '', assID)
                    .then((res) => {
                        if (res && res['success']) {
                            if (isStart) {
                                safeSetState(setStage, "QnA");
                            }
                            
                            const questionRes = res['data'];
                            safeSetState(setNextQuestion, questionRes);
                            
                            setQnAHistory(prevQuestions => {
                                const updatedWithResponse = [...prevQuestions];
                                if (updatedWithResponse.length > 0) {
                                    updatedWithResponse[updatedWithResponse.length - 1].assistant = questionRes.question;
                                }
                                return updatedWithResponse;
                            });
                        } else {
                            throw new Error('Invalid response from QnA service');
                        }
                    })
                    .catch((error) => {
                        console.error('QnA API error:', error);
                        safeSetState(setStatus, "Error getting next question. Please try again.");
                    });
                
                return updatedQuestions;
            });
        } catch (error) {
            console.error('Error in sendAnswerToAPI:', error);
            safeSetState(setStatus, "Error processing your answer");
        }
    }, [isStart, mainService, safeSetState, stopListening]);

    // Start assessment with error handling
    const startAssessment = useCallback(() => {
        const body = {
            userId: 1,
            anatomyId: 3,
            assessmentType: "PAIN",
        };
        
        mainService.createAssessment(body, '')
            .then((res) => {
                if (res && res['success']) {
                    const newAssessmentId = res['data']['assessmentId'];
                    setAssessmentId(newAssessmentId);
                    assessmentIdRef.current = newAssessmentId;
                    safeSetState(setIsStart, true);
                    sendChat('Hello', newAssessmentId);
                } else {
                    throw new Error('Failed to create assessment');
                }
            })
            .catch((error) => {
                console.error('Error creating assessment:', error);
                safeSetState(setStatus, "Error starting assessment. Please try again.");
            });
    }, [mainService, safeSetState, sendChat]);

    // Keep the ref updated with the latest state value
    useEffect(() => {
        assessmentIdRef.current = assessmentId;
    }, [assessmentId]);

    const reset = useCallback(() => {
        safeSetState(setStep, 0);
        safeSetState(setIsStart, false);
        safeSetState(setIsOpen, true);
        safeSetState(setChatHistory, []);
        safeSetState(setQnAHistory, []);
        safeSetState(setAssessmentId, null);
        assessmentIdRef.current = null;
        clearAllTimeouts();
    }, [safeSetState, clearAllTimeouts]);

    // Initialize on mount
    useEffect(() => {
        isMountedRef.current = true;
        init();

        // Cleanup on unmount
        return () => {
            isMountedRef.current = false;
            clearAllTimeouts();
            stopListening();
            window.speechSynthesis.cancel();
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    const sendPainPointImage = useCallback((base64Image) => {
        if (base64Image && assessmentId) {
            sendChat(base64Image, assessmentId, true);
        }
    }, [assessmentId, sendChat]);

    const saveRomData = useCallback(async (romData) => {
        try {
            const res = await mainService.saveRomData(romData, '', assessmentId);
            console.log("ROM data saved:", res);
        } catch (error) {
            console.error('Error saving ROM data:', error);
            safeSetState(setStatus, "Error saving ROM data");
        }
    }, [assessmentId, mainService, safeSetState]);

    return (
        <>
            <div className='bg-prime w-full h-screen overflow-hidden relative'>
                <div className='absolute top-0 left-0 w-full flex justify-center items-start z-50'>
                    <div className='bg-white/90 px-4 py-2 rounded-md shadow-sm'>
                        {status}
                    </div>
                </div>
                
                <AiVideo step={step} next={sendPainPointImage} />
                
                <AiQus 
                    step={step}
                    send={async (answer, isFinal = false) => {
                        await sendAnswerToAPI(answer, assessmentId, isFinal);
                        return nextQuestion;
                    }}
                    onComplete={() => {
                        safeSetState(setStep, prev => prev + 1);
                    }}
                    nextQuestion={nextQuestion}
                />
                
                {step < 8 && (
                    <AiAvatar 
                        text={currentDisplayText} 
                        isStart={isStart} 
                        onStart={startAssessment} 
                        isOpen={isOpen} 
                        analyser={analyser} 
                        step={step}
                        isListening={isListening}
                        isAiSpeaking={aiSpeaking}
                    />
                )}
                
                <AiRomMain 
                    step={step} 
                    next={() => {
                        safeSetState(setStep, prev => prev + 1);
                    }} 
                    saveRomData={saveRomData} 
                />
                
                <AiDashboard 
                    step={step} 
                    assessmentId={assessmentId} 
                    reset={reset} 
                /> 
            </div>
        </>
    );
}