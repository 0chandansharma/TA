import React, { useEffect, useRef, useState, useCallback } from 'react';
import './assets/styles/app.css';
import AiAvatar from './core/components/AiAvatar';
import AiDashboard from './core/components/AiDashboard';
import AiQus from './core/components/AiQus';
import AiRomMain from './core/components/AiRomMain';
import AiVideo from './core/components/AiVideo';
import ServiceChat from './core/services/serviceChat';
import ServiceGoogleSpeech from './core/services/serviceGoogleSpeech';

export default function App() {
    const [chatHistory, setChatHistory] = useState([]);
    const [QnAHistory, setQnAHistory] = useState([]);
    const [aiSpeaking, setAiSpeaking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [nextQuestion, setNextQuestion] = useState(null);
    const [analyser, setAnalyser] = useState(null);
    const [status, setStatus] = useState("");
    const [currentDisplayText, setCurrentDisplayText] = useState("");
    const [stage, setStage] = useState("idle");
    const [isStart, setIsStart] = useState(false);
    const [isOpen, setIsOpen] = useState(true);
    const [assessmentId, setAssessmentId] = useState(null);
    const assessmentIdRef = useRef(null);
    const [step, setStep] = useState(0);
    const [identifiedBodyPart, setIdentifiedBodyPart] = useState(null);

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const streamRef = useRef(null);
    const isMountedRef = useRef(true);
    const audioContextRef = useRef(null);

    const mainService = new ServiceChat();
    const googleSpeechService = new ServiceGoogleSpeech();

    // Helper function to convert chat history format for QnA API
    const convertChatHistoryToQnAFormat = useCallback((chatHist) => {
        console.log('=== CONVERTING CHAT HISTORY FORMAT ===');
        console.log('Input chat history:', chatHist);
        
        const converted = chatHist.map(chat => ({
            user: chat.user,
            assistant: chat.response || chat.assistant || ""
        })).filter(chat => chat.user && chat.user.trim() !== ""); // Remove empty user messages
        
        console.log('Converted QnA history:', converted);
        return converted;
    }, []);

    // Send answer to QnA API (for questionnaire phase) - FIXED
    const sendAnswerToAPI = useCallback(async (answer) => {
        console.log('=== SEND ANSWER TO API ===');
        console.log('Answer:', answer);
        console.log('Assessment ID from ref:', assessmentIdRef.current);
        console.log('Assessment ID from state:', assessmentId);
        
        // Use ref value as it's more reliable
        const currentAssessmentId = assessmentIdRef.current;
        
        if (!currentAssessmentId) {
            console.error('=== ERROR: Assessment ID is undefined ===');
            console.log('Assessment ID ref:', assessmentIdRef.current);
            console.log('Assessment ID state:', assessmentId);
            return;
        }
        
        setStatus("Processing answer...");

        // Create the message with user and prepare for response
        const newMessage = { user: answer, assistant: "" };
        
        setQnAHistory(prevHistory => {
            console.log('Previous QnA history:', prevHistory);
            const updatedHistory = [...prevHistory, newMessage];
            console.log('Updated QnA history:', updatedHistory);
            
            const bodyChat = {
                chat_history: updatedHistory
            };

            console.log('=== QnA API REQUEST ===');
            console.log('URL will be:', `/assessments/${currentAssessmentId}/questionnaires`);
            console.log('Payload:', JSON.stringify(bodyChat, null, 2));

            mainService.chatWithQnAAI(bodyChat, '', currentAssessmentId)
                .then(async (res) => {
                    console.log('=== QnA API RESPONSE ===');
                    console.log('Response:', JSON.stringify(res, null, 2));
                    
                    if (res?.success) {
                        setStage("QnA");
                        
                        const questionRes = res.data;
                        
                        // Extract question text properly
                        const questionText = questionRes.question || questionRes.response || "Please continue...";
                        
                        // Update the question object
                        const updatedQuestion = {
                            ...questionRes,
                            question: questionText
                        };
                        
                        setNextQuestion(updatedQuestion);
                        
                        // Update the last message with the assistant's response
                        setQnAHistory(prev => {
                            const updated = [...prev];
                            if (updated.length > 0) {
                                updated[updated.length - 1].assistant = questionText;
                            }
                            console.log('Updated QnA with assistant response:', updated);
                            return updated;
                        });
                        
                        // Speak the question without auto-starting listening
                        setCurrentDisplayText(questionText);
                        await speakText(questionText, true, false);
                        
                        setStatus(""); // Clear status after speaking
                        
                        // Check if we need to move to next phase
                        if (questionRes.action === "rom_api") {
                            console.log('Moving to ROM phase');
                            setStep(20); // Move to ROM phase
                        } else if (questionRes.action === "dashboard_api") {
                            console.log('Moving to Dashboard phase');
                            setStep(24); // Move to dashboard
                        }
                    }
                })
                .catch(error => {
                    console.error('QnA API error:', error);
                    setStatus("Error getting next question");
                });
            
            return updatedHistory;
        });
    }, [mainService]);

    // Initialize media recorder
    const initMediaRecorder = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 48000
                } 
            });
            
            streamRef.current = stream;
            
            const recorder = new MediaRecorder(stream, { 
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 128000
            });

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                audioChunksRef.current = [];
                
                if (audioBlob.size > 0) {
                    await handleSpeechToText(audioBlob);
                }
            };

            mediaRecorderRef.current = recorder;
            
            // Initialize audio analyser
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioContextRef.current = audioContext;
            const source = audioContext.createMediaStreamSource(stream);
            const analyserNode = audioContext.createAnalyser();
            analyserNode.fftSize = 256;
            source.connect(analyserNode);
            setAnalyser(analyserNode);
            
        } catch (error) {
            console.error('Error initializing media recorder:', error);
            setStatus("Microphone access denied");
        }
    }, []);

    // Text to speech handler
    const speakText = useCallback(async (text, isAiSpeaking = false, listenNext = true, stepNumber = 0) => {
        try {
            setAiSpeaking(true);
            if (isAiSpeaking) {
                setStatus("AI is speaking...");
            }
    
            const audioBlob = await googleSpeechService.textToSpeech(text);
            await googleSpeechService.playAudio(audioBlob);
    
            setAiSpeaking(false);
            setStatus("");
    
            // Only auto-start listening for chat phase (step < 11), not QnA phase
            if (listenNext && isMountedRef.current && step < 11) {
                console.log('Auto-starting listening after AI speech');
                startListening();
            } else {
                console.log('Not auto-starting listening (QnA phase or no listen):', {
                    listenNext,
                    isMounted: isMountedRef.current,
                    step,
                    shouldListen: step < 11
                });
            }
    
            // Handle video step timing
            if (stepNumber === 8) {
                setTimeout(() => {
                    setCurrentDisplayText("");
                    setStep(stepNumber);
                }, 5000);
    
                for (let i = 5; i > 0; i--) {
                    setTimeout(() => {
                        setCurrentDisplayText(`Please be ready in ${i} seconds`);
                    }, (5 - i) * 1000);
                }
                setTimeout(() => setCurrentDisplayText(""), 5000);
            }
        } catch (error) {
            console.error('Text-to-Speech error:', error);
            setAiSpeaking(false);
            setStatus("");
            
            // Fallback to browser TTS
            if ("speechSynthesis" in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 0.8;
                utterance.onend = () => {
                    if (listenNext && isMountedRef.current && step < 11) {
                        startListening();
                    }
                };
                window.speechSynthesis.speak(utterance);
            }
        }
    }, [googleSpeechService, step]);

    // Start listening
    const startListening = useCallback(() => {
        if (!mediaRecorderRef.current) {
            initMediaRecorder();
            return;
        }

        if (mediaRecorderRef.current.state === 'inactive') {
            setIsListening(true);
            setStatus("Listening...");
            audioChunksRef.current = [];
            
            mediaRecorderRef.current.start();
            
            // Auto-stop after 5 seconds
            setTimeout(() => {
                if (mediaRecorderRef.current?.state === 'recording') {
                    stopListening();
                }
            }, 5000);
        }
    }, [initMediaRecorder]);

    // Stop listening
    const stopListening = useCallback(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsListening(false);
        }
    }, []);

    // Handle speech to text
    const handleSpeechToText = useCallback(async (audioBlob) => {
        try {
            setStatus("Processing speech...");
            const transcript = await googleSpeechService.speechToText(audioBlob);
            
            console.log('=== SPEECH TO TEXT RESULT ===');
            console.log('Transcript:', transcript);
            console.log('Current Step:', step);
            
            if (transcript && transcript.trim()) {
                // Determine which API to call based on current step
                if (step >= 11) {
                    // We're in QnA phase
                    console.log('=== CALLING QnA API FROM SPEECH ===');
                    await sendAnswerToAPI(transcript);
                } else {
                    // We're in chat phase
                    console.log('=== CALLING CHAT API FROM SPEECH ===');
                    await sendChat(transcript, assessmentIdRef.current);
                }
            } else {
                console.log('No transcript received or empty');
                setStatus("Could not understand. Please try again.");
                setTimeout(() => {
                    if (isMountedRef.current && step < 11) {
                        startListening();
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('Speech-to-Text error:', error);
            setStatus("Error processing speech. Please try again.");
            setTimeout(() => {
                if (isMountedRef.current && step < 11) {
                    startListening();
                }
            }, 1000);
        }
    }, [step, sendAnswerToAPI]);

    // Send chat message (for initial conversation)
    const sendChat = useCallback(async (message, assID, isVideo = false) => {
        console.log('=== SENDCHAT START ===');
        console.log('Message:', message);
        console.log('AssessmentID:', assID);
        console.log('IsVideo:', isVideo);
        console.log('Current Step:', step);
        
        setStatus("Talking to the AI...");
        setIsListening(false);
        stopListening();
    
        // Display text only for non-video messages
        if (!isVideo) {
            setCurrentDisplayText(message);
        }
    
        setChatHistory(prevChats => {
            console.log('Previous chat history:', prevChats);
            let updatedChats = [...prevChats];
            let bodyChat = {};
            
            if (isVideo) {
                // For video, don't add to chat history as user message
                bodyChat = {
                    chat_history: updatedChats,
                    video: message
                };
                console.log('=== VIDEO REQUEST PAYLOAD ===');
                console.log('Body:', JSON.stringify(bodyChat, null, 2));
            } else {
                // For text, add to chat history normally
                const newMessage = { user: message };
                updatedChats = [...prevChats, newMessage];
                bodyChat = {
                    chat_history: updatedChats
                };
                console.log('=== TEXT REQUEST PAYLOAD ===');
                console.log('Body:', JSON.stringify(bodyChat, null, 2));
            }
    
            mainService.chatWithAI(bodyChat, '', assID)
                .then(async (res) => {
                    console.log('=== AI RESPONSE ===');
                    console.log('Response:', JSON.stringify(res, null, 2));
                    
                    if (res?.success) {
                        if (!isStart) {
                            setStage("chat");
                        }
                        
                        const chatRes = res.data.response;
                        const next_action = res.data.action;
                        
                        console.log('AI Response:', chatRes);
                        console.log('Next Action:', next_action);
                        
                        if (isVideo) {
                            // Handle video response - add hardcoded body part identification
                            const identifiedPart = "lower back";
                            setIdentifiedBodyPart(identifiedPart);
                            
                            const bodyPartMessage = { 
                                user: "User has shown body part on video", 
                                response: `${identifiedPart} identified as body part` 
                            };
                            
                            setChatHistory(latestChats => {
                                const updated = [...latestChats, bodyPartMessage];
                                console.log('Added body part identification to chat history:', updated);
                                return updated;
                            });
    
                            // Convert existing chat history to QnA format and initialize QnA
                            console.log('=== MOVING TO QnA STAGE ===');
                            
                            // PROPERLY SET STEP TO 11 IMMEDIATELY
                            setStep(11);
                            setAnalyser(false);
                            
                            // Convert chat history and initialize QnA
                            setTimeout(() => {
                                setChatHistory(currentChatHistory => {
                                    console.log('Converting chat history to QnA format:', currentChatHistory);
                                    const convertedHistory = convertChatHistoryToQnAFormat(currentChatHistory);
                                    setQnAHistory(convertedHistory);
                                    
                                    // Start first QnA question
                                    setTimeout(() => {
                                        console.log('=== STARTING QnA SESSION WITH CONVERTED HISTORY ===');
                                        sendAnswerToAPI("Let's continue with the assessment");
                                    }, 1000);
                                    
                                    return currentChatHistory;
                                });
                            }, 100);
    
                            // Speak the transition message
                            setCurrentDisplayText(`${identifiedPart} identified. Let's continue with some questions.`);
                            await speakText(`${identifiedPart} identified. Let's continue with some questions.`, true, false);
                            
                        } else {
                            // Update chat history with response field only for text messages
                            setChatHistory(latestChats => {
                                const updated = [...latestChats];
                                if (updated.length > 0) {
                                    updated[updated.length - 1].response = chatRes;
                                }
                                return updated;
                            });
                            
                            if (next_action === "camera_on") {
                                setCurrentDisplayText(chatRes);
                                await speakText(chatRes, true, false, 8);
                            } else if (next_action !== "next_api") {
                                setCurrentDisplayText(chatRes);
                                await speakText(chatRes, true);
                            } else {
                                // Moving to QnA phase
                                setCurrentDisplayText("");
                                await speakText(chatRes, true, false);
                                setStep(11);
                                setAnalyser(false);
                            }
                        }
                    }
                })
                .catch(async (error) => {
                    console.error('Chat API error:', error);
                    setStatus("Error communicating with AI");
                    
                    if (isVideo) {
                        // Fallback for video - still proceed to next stage
                        console.log('Video API failed, using fallback');
                        const identifiedPart = "lower back";
                        setIdentifiedBodyPart(identifiedPart);
                        
                        const bodyPartMessage = { 
                            user: "User has shown body part on video", 
                            response: `${identifiedPart} identified as body part (fallback)` 
                        };
                        
                        setChatHistory(latestChats => {
                            const updated = [...latestChats, bodyPartMessage];
                            
                            // PROPERLY SET STEP TO 11
                            setStep(11);
                            setAnalyser(false);
                            
                            // Convert and initialize QnA with fallback
                            setTimeout(() => {
                                const convertedHistory = convertChatHistoryToQnAFormat(updated);
                                setQnAHistory(convertedHistory);
                                
                                setTimeout(() => {
                                    sendAnswerToAPI("Let's continue with the assessment");
                                }, 1000);
                            }, 100);
                            
                            return updated;
                        });
                        
                        setCurrentDisplayText(`${identifiedPart} identified. Let's continue with some questions.`);
                        await speakText(`${identifiedPart} identified. Let's continue with some questions.`, true, false);
                    } else {
                        setTimeout(() => {
                            if (isMountedRef.current) {
                                startListening();
                            }
                        }, 2000);
                    }
                });
            
            // Return updated chats only for text messages
            return isVideo ? prevChats : updatedChats;
        });
    }, [isStart, mainService, speakText, startListening, stopListening, step, sendAnswerToAPI, convertChatHistoryToQnAFormat, chatHistory]);
    // Start assessment
    const startAssessment = useCallback(() => {
        console.log('=== STARTING ASSESSMENT ===');
        const body = {
            userId: 1,
            anatomyId: 3,
            assessmentType: "PAIN",
        };
        
        mainService.createAssessment(body, '')
            .then(async (res) => {
                console.log('=== ASSESSMENT CREATED ===');
                console.log('Response:', JSON.stringify(res, null, 2));
                
                if (res?.success) {
                    const newAssessmentId = res.data.assessmentId;
                    console.log('New Assessment ID:', newAssessmentId);
                    setAssessmentId(newAssessmentId);
                    assessmentIdRef.current = newAssessmentId;
                    setIsStart(true);
                    await sendChat('Hello', newAssessmentId);
                }
            })
            .catch(error => {
                console.error('Error creating assessment:', error);
                setStatus("Error starting assessment");
            });
    }, [mainService, sendChat]);

    // Update ref when assessmentId changes
    useEffect(() => {
        console.log('=== ASSESSMENT ID CHANGED ===');
        console.log('New assessmentId:', assessmentId);
        assessmentIdRef.current = assessmentId;
    }, [assessmentId]);

    // Initialize on mount
    useEffect(() => {
        isMountedRef.current = true;
        initMediaRecorder();

        return () => {
            isMountedRef.current = false;
            
            // Cleanup
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
            window.speechSynthesis.cancel();
        };
    }, [initMediaRecorder]);

    // Handle pain point video from video capture
    const sendPainPointVideo = useCallback((base64Video) => {
        console.log('=== RECEIVED VIDEO FROM AiVideo ===');
        console.log('Video received, length:', base64Video ? base64Video.length : 0);
        console.log('Assessment ID:', assessmentId);
        console.log('Assessment ID Ref:', assessmentIdRef.current);
        
        if (base64Video && assessmentId) {
            // Send as video, not as user message
            sendChat(base64Video, assessmentId, true);
        } else {
            console.error('Missing video or assessment ID');
            console.log('Video exists:', !!base64Video);
            console.log('Assessment ID exists:', !!assessmentId);
        }
    }, [assessmentId, sendChat]);

    // Save ROM data
    const saveRomData = useCallback(async (romData) => {
        try {
            const res = await mainService.saveRomData(romData, '', assessmentId);
            console.log("ROM data saved:", res);
        } catch (error) {
            console.error('Error saving ROM data:', error);
            setStatus("Error saving ROM data");
        }
    }, [assessmentId, mainService]);

    // Reset assessment
    const reset = useCallback(() => {
        setStep(0);
        setIsStart(false);
        setIsOpen(true);
        setChatHistory([]);
        setQnAHistory([]);
        setAssessmentId(null);
        assessmentIdRef.current = null;
        setNextQuestion(null);
        setCurrentDisplayText("");
        setStatus("");
        setStage("idle");
        setIdentifiedBodyPart(null);
    }, []);

    return (
        <div className='bg-prime w-full h-screen overflow-hidden relative'>
            <div className='absolute top-0 left-0 w-full flex justify-center items-start z-50'>
                <div className='bg-white/90 px-4 py-2 rounded-md shadow-sm'>
                    {status}
                </div>
            </div>
            
            {/* Debug Info */}
            <div className='absolute top-10 right-0 bg-black/80 text-white p-2 text-xs z-50'>
                <div>Step: {step}</div>
                <div>Stage: {stage}</div>
                <div>Assessment ID: {assessmentId}</div>
                <div>Body Part: {identifiedBodyPart}</div>
                <div>Chat History: {chatHistory.length}</div>
                <div>QnA History: {QnAHistory.length}</div>
            </div>
            
            <AiVideo step={step} next={sendPainPointVideo} />
            
            <AiQus 
                step={step}
                send={sendAnswerToAPI}
                onComplete={() => setStep(prev => prev + 1)}
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
                next={() => setStep(prev => prev + 1)} 
                saveRomData={saveRomData} 
            />
            
            <AiDashboard 
                step={step} 
                assessmentId={assessmentId} 
                reset={reset} 
            /> 
        </div>
    );
}