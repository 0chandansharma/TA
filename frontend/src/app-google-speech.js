// app-google-speech.js - Fixed version with detailed logging
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
    
    // CRITICAL: Add refs to prevent duplicate API calls and track state
    const isTransitioningToQnARef = useRef(false);
    const hasInitializedQnARef = useRef(false);
    const lastProcessedQuestionRef = useRef(null);
    const qnaApiCallInProgressRef = useRef(false);

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const streamRef = useRef(null);
    const isMountedRef = useRef(true);
    const audioContextRef = useRef(null);

    const mainService = new ServiceChat();
    const googleSpeechService = new ServiceGoogleSpeech();

    // Helper function to convert chat history format for QnA API
    const convertChatHistoryToQnAFormat = useCallback((chatHist) => {
        console.log('🔄 [CONVERT] Converting chat history format');
        console.log('🔄 [CONVERT] Input length:', chatHist.length);
        
        const converted = chatHist.map(chat => ({
            user: chat.user,
            assistant: chat.response || chat.assistant || ""
        })).filter(chat => chat.user && chat.user.trim() !== "");
        
        console.log('🔄 [CONVERT] Output length:', converted.length);
        return converted;
    }, []);

    // Send answer to QnA API (for questionnaire phase) - FIXED with duplicate prevention
    const sendAnswerToAPI = useCallback(async (answer) => {
        console.log('📤 [QNA-API] sendAnswerToAPI called');
        console.log('📤 [QNA-API] Answer:', answer);
        console.log('📤 [QNA-API] Assessment ID:', assessmentIdRef.current);
        console.log('📤 [QNA-API] API call in progress?', qnaApiCallInProgressRef.current);
        console.log('📤 [QNA-API] Is transitioning?', isTransitioningToQnARef.current);
        
        // CRITICAL: Prevent duplicate API calls
        if (qnaApiCallInProgressRef.current) {
            console.log('⚠️ [QNA-API] API call already in progress, SKIPPING');
            return;
        }
        
        // Prevent calls during transition
        if (isTransitioningToQnARef.current && answer === "Let's continue with the assessment") {
            console.log('⚠️ [QNA-API] Still transitioning, SKIPPING initial call');
            return;
        }
        
        const currentAssessmentId = assessmentIdRef.current;
        
        if (!currentAssessmentId) {
            console.error('❌ [QNA-API] Assessment ID is undefined');
            return;
        }
        
        // Set flag to prevent duplicate calls
        qnaApiCallInProgressRef.current = true;
        setStatus("Processing answer...");

        // Create the message with user and prepare for response
        const newMessage = { user: answer, assistant: "" };
        
        // Update QnA history first
        const updatedHistory = [...QnAHistory, newMessage];
        setQnAHistory(updatedHistory);
        
        const bodyChat = {
            chat_history: updatedHistory
        };

        console.log('📤 [QNA-API] Making API request');
        console.log('📤 [QNA-API] URL:', `/assessments/${currentAssessmentId}/questionnaires`);
        console.log('📤 [QNA-API] Payload:', JSON.stringify(bodyChat, null, 2));

        try {
            const res = await mainService.chatWithQnAAI(bodyChat, '', currentAssessmentId);
            
            console.log('✅ [QNA-API] Response received');
            console.log('✅ [QNA-API] Success?', res?.success);
            
            if (res?.success) {
                setStage("QnA");
                
                const questionRes = res.data;
                const questionText = questionRes.question || questionRes.response || "Please continue...";
                
                console.log('📋 [QNA-API] Question text:', questionText);
                console.log('📋 [QNA-API] Last processed question:', lastProcessedQuestionRef.current);
                
                // Check if this is a duplicate question
                if (lastProcessedQuestionRef.current === questionText) {
                    console.log('⚠️ [QNA-API] Duplicate question detected, SKIPPING update');
                    qnaApiCallInProgressRef.current = false;
                    setStatus("");
                    return;
                }
                
                lastProcessedQuestionRef.current = questionText;
                
                // Update the question object
                const updatedQuestion = {
                    ...questionRes,
                    question: questionText,
                    timestamp: Date.now() // Add timestamp for uniqueness
                };
                
                console.log('📋 [QNA-API] Setting next question');
                setNextQuestion(updatedQuestion);
                
                // Update the QnA history with assistant response
                setQnAHistory(prev => {
                    const updated = [...prev];
                    if (updated.length > 0) {
                        updated[updated.length - 1].assistant = questionText;
                    }
                    return updated;
                });
                
                // Display and speak the question
                setCurrentDisplayText(questionText);
                
                // Cancel any ongoing speech before speaking
                window.speechSynthesis.cancel();
                await speakText(questionText, true, false);
                
                setStatus("");
                
                // Check for phase transitions
                if (questionRes.action === "rom_api") {
                    console.log('🎯 [QNA-API] Moving to ROM phase');
                    setStep(20);
                } else if (questionRes.action === "dashboard_api") {
                    console.log('🎯 [QNA-API] Moving to Dashboard phase');
                    setStep(24);
                }
            }
        } catch (error) {
            console.error('❌ [QNA-API] Error:', error);
            setStatus("Error getting next question");
        } finally {
            // Reset the flag
            qnaApiCallInProgressRef.current = false;
            console.log('🔓 [QNA-API] API call completed, flag reset');
        }
    }, [QnAHistory, mainService]);

    // Initialize media recorder
    const initMediaRecorder = useCallback(async () => {
        console.log('🎤 [MEDIA] Initializing media recorder');
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
                console.log('🎤 [MEDIA] Recording stopped, chunks:', audioChunksRef.current.length);
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
            
            console.log('✅ [MEDIA] Media recorder initialized');
        } catch (error) {
            console.error('❌ [MEDIA] Error initializing:', error);
            setStatus("Microphone access denied");
        }
    }, []);

    // Text to speech handler
    const speakText = useCallback(async (text, isAiSpeaking = false, listenNext = true, stepNumber = 0) => {
        console.log('🔊 [TTS] Speaking:', text.substring(0, 50) + '...');
        try {
            setAiSpeaking(true);
            if (isAiSpeaking) {
                setStatus("AI is speaking...");
            }
    
            const audioBlob = await googleSpeechService.textToSpeech(text);
            await googleSpeechService.playAudio(audioBlob);
    
            setAiSpeaking(false);
            setStatus("");
            
            console.log('🔊 [TTS] Speech completed, listenNext:', listenNext, 'step:', step);
    
            // Only auto-start listening for chat phase (step < 11), not QnA phase
            if (listenNext && isMountedRef.current && step < 11) {
                console.log('🎤 [TTS] Auto-starting listening after speech');
                startListening();
            }
    
            // Handle video step timing
            if (stepNumber === 8) {
                console.log('📹 [TTS] Starting video countdown');
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
            console.error('❌ [TTS] Error:', error);
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
        console.log('🎤 [LISTEN] Starting to listen');
        if (!mediaRecorderRef.current) {
            console.log('🎤 [LISTEN] No media recorder, initializing');
            initMediaRecorder();
            return;
        }

        if (mediaRecorderRef.current.state === 'inactive') {
            setIsListening(true);
            setStatus("Listening...");
            audioChunksRef.current = [];
            
            mediaRecorderRef.current.start();
            console.log('✅ [LISTEN] Recording started');
            
            // Auto-stop after 5 seconds
            setTimeout(() => {
                if (mediaRecorderRef.current?.state === 'recording') {
                    console.log('⏱️ [LISTEN] Auto-stopping after 5 seconds');
                    stopListening();
                }
            }, 5000);
        }
    }, [initMediaRecorder]);

    // Stop listening
    const stopListening = useCallback(() => {
        console.log('🛑 [LISTEN] Stopping listening');
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsListening(false);
            console.log('✅ [LISTEN] Recording stopped');
        }
    }, []);

    // Handle speech to text
    const handleSpeechToText = useCallback(async (audioBlob) => {
        console.log('🎤 [STT] Processing speech, blob size:', audioBlob.size);
        try {
            setStatus("Processing speech...");
            const transcript = await googleSpeechService.speechToText(audioBlob);
            
            console.log('📝 [STT] Transcript:', transcript);
            console.log('📝 [STT] Current Step:', step);
            
            if (transcript && transcript.trim()) {
                // Determine which API to call based on current step
                if (step >= 11) {
                    console.log('📝 [STT] In QnA phase, sending to QnA API');
                    await sendAnswerToAPI(transcript);
                } else {
                    console.log('📝 [STT] In chat phase, sending to chat API');
                    await sendChat(transcript, assessmentIdRef.current);
                }
            } else {
                console.log('⚠️ [STT] No transcript or empty');
                setStatus("Could not understand. Please try again.");
                setTimeout(() => {
                    if (isMountedRef.current && step < 11) {
                        startListening();
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('❌ [STT] Error:', error);
            setStatus("Error processing speech. Please try again.");
            setTimeout(() => {
                if (isMountedRef.current && step < 11) {
                    startListening();
                }
            }, 1000);
        }
    }, [step, sendAnswerToAPI]);

    // Send chat message (for initial conversation) - FIXED
    const sendChat = useCallback(async (message, assID, isVideo = false) => {
        console.log('💬 [CHAT] sendChat called');
        console.log('💬 [CHAT] Message:', isVideo ? 'VIDEO' : message);
        console.log('💬 [CHAT] AssessmentID:', assID);
        console.log('💬 [CHAT] Step:', step);
        
        setStatus("Talking to the AI...");
        setIsListening(false);
        stopListening();
    
        // Display text only for non-video messages
        if (!isVideo) {
            setCurrentDisplayText(message);
        }
    
        setChatHistory(prevChats => {
            let updatedChats = [...prevChats];
            let bodyChat = {};
            
            if (isVideo) {
                bodyChat = {
                    chat_history: updatedChats,
                    video: message
                };
                console.log('📹 [CHAT] Sending video request');
            } else {
                const newMessage = { user: message };
                updatedChats = [...prevChats, newMessage];
                bodyChat = {
                    chat_history: updatedChats
                };
                console.log('💬 [CHAT] Sending text request');
            }
    
            mainService.chatWithAI(bodyChat, '', assID)
                .then(async (res) => {
                    console.log('✅ [CHAT] Response received');
                    console.log('✅ [CHAT] Success?', res?.success);
                    
                    if (res?.success) {
                        if (!isStart) {
                            setStage("chat");
                        }
                        
                        const chatRes = res.data.response;
                        const next_action = res.data.action;
                        
                        console.log('💬 [CHAT] Action:', next_action);
                        
                        if (isVideo) {
                            console.log('🎯 [CHAT] Processing video response');
                            
                            // Set transition flag
                            isTransitioningToQnARef.current = true;
                            hasInitializedQnARef.current = false;
                            
                            const identifiedPart = "lower back";
                            setIdentifiedBodyPart(identifiedPart);
                            
                            const bodyPartMessage = { 
                                user: "User has shown body part on video", 
                                response: `${identifiedPart} identified as body part` 
                            };
                            
                            setChatHistory(latestChats => {
                                const updated = [...latestChats, bodyPartMessage];
                                console.log('💬 [CHAT] Updated chat history with body part');
                                return updated;
                            });
    
                            // Move to QnA stage
                            console.log('🎯 [CHAT] Setting step to 11');
                            setStep(11);
                            setAnalyser(false);
                            
                            // Speak transition message
                            setCurrentDisplayText(`${identifiedPart} identified. Let's continue with some questions.`);
                            await speakText(`${identifiedPart} identified. Let's continue with some questions.`, true, false);
                            
                            // Convert chat history AFTER speaking
                            setTimeout(() => {
                                console.log('🔄 [CHAT] Converting chat history for QnA');
                                const currentHistory = chatHistory;
                                const convertedHistory = convertChatHistoryToQnAFormat([...currentHistory, bodyPartMessage]);
                                setQnAHistory(convertedHistory);
                                
                                // Clear transition flag and initialize QnA
                                setTimeout(() => {
                                    console.log('🚀 [CHAT] Initializing QnA phase');
                                    isTransitioningToQnARef.current = false;
                                    
                                    // Only make the initial call if not already done
                                    if (!hasInitializedQnARef.current) {
                                        hasInitializedQnARef.current = true;
                                        sendAnswerToAPI("Let's continue with the assessment");
                                    }
                                }, 2000);
                            }, 500);
                            
                        } else {
                            // Update chat history with response
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
                                setCurrentDisplayText("");
                                await speakText(chatRes, true, false);
                                setStep(11);
                                setAnalyser(false);
                            }
                        }
                    }
                })
                .catch(async (error) => {
                    console.error('❌ [CHAT] Error:', error);
                    setStatus("Error communicating with AI");
                    
                    if (isVideo) {
                        // Fallback for video
                        console.log('⚠️ [CHAT] Using video fallback');
                        isTransitioningToQnARef.current = true;
                        hasInitializedQnARef.current = false;
                        
                        const identifiedPart = "lower back";
                        setIdentifiedBodyPart(identifiedPart);
                        
                        const bodyPartMessage = { 
                            user: "User has shown body part on video", 
                            response: `${identifiedPart} identified as body part (fallback)` 
                        };
                        
                        setChatHistory(latestChats => [...latestChats, bodyPartMessage]);
                        
                        setStep(11);
                        setAnalyser(false);
                        
                        setTimeout(() => {
                            const convertedHistory = convertChatHistoryToQnAFormat(chatHistory);
                            setQnAHistory(convertedHistory);
                            
                            setTimeout(() => {
                                isTransitioningToQnARef.current = false;
                                if (!hasInitializedQnARef.current) {
                                    hasInitializedQnARef.current = true;
                                    sendAnswerToAPI("Let's continue with the assessment");
                                }
                            }, 2000);
                        }, 500);
                        
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
            
            return isVideo ? prevChats : updatedChats;
        });
    }, [isStart, mainService, speakText, startListening, stopListening, step, sendAnswerToAPI, convertChatHistoryToQnAFormat, chatHistory]);

    // Start assessment
    const startAssessment = useCallback(() => {
        console.log('🚀 [ASSESSMENT] Starting new assessment');
        const body = {
            userId: 1,
            anatomyId: 3,
            assessmentType: "PAIN",
        };
        
        mainService.createAssessment(body, '')
            .then(async (res) => {
                console.log('✅ [ASSESSMENT] Created successfully');
                console.log('✅ [ASSESSMENT] ID:', res.data?.assessmentId);
                
                if (res?.success) {
                    const newAssessmentId = res.data.assessmentId;
                    setAssessmentId(newAssessmentId);
                    assessmentIdRef.current = newAssessmentId;
                    setIsStart(true);
                    await sendChat('Hello', newAssessmentId);
                }
            })
            .catch(error => {
                console.error('❌ [ASSESSMENT] Error:', error);
                setStatus("Error starting assessment");
            });
    }, [mainService, sendChat]);

    // Update ref when assessmentId changes
    useEffect(() => {
        console.log('🔄 [ASSESSMENT] ID updated:', assessmentId);
        assessmentIdRef.current = assessmentId;
    }, [assessmentId]);

    // Initialize on mount
    useEffect(() => {
        console.log('🚀 [APP] Mounting component');
        isMountedRef.current = true;
        initMediaRecorder();

        return () => {
            console.log('🛑 [APP] Unmounting component');
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
        console.log('📹 [VIDEO] Received video from AiVideo');
        console.log('📹 [VIDEO] Video size:', base64Video ? base64Video.length : 0);
        console.log('📹 [VIDEO] Assessment ID:', assessmentId);
        
        if (base64Video && assessmentId) {
            sendChat(base64Video, assessmentId, true);
        } else {
            console.error('❌ [VIDEO] Missing video or assessment ID');
        }
    }, [assessmentId, sendChat]);

    // Save ROM data
    const saveRomData = useCallback(async (romData) => {
        console.log('💾 [ROM] Saving ROM data');
        try {
            const res = await mainService.saveRomData(romData, '', assessmentId);
            console.log('✅ [ROM] Data saved successfully');
        } catch (error) {
            console.error('❌ [ROM] Error saving data:', error);
            setStatus("Error saving ROM data");
        }
    }, [assessmentId, mainService]);

    // Reset assessment
    const reset = useCallback(() => {
        console.log('🔄 [RESET] Resetting assessment');
        
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        // Reset all refs
        isTransitioningToQnARef.current = false;
        hasInitializedQnARef.current = false;
        lastProcessedQuestionRef.current = null;
        qnaApiCallInProgressRef.current = false;
        
        // Reset state
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
                <div>Transitioning: {isTransitioningToQnARef.current ? 'Yes' : 'No'}</div>
                <div>QnA Initialized: {hasInitializedQnARef.current ? 'Yes' : 'No'}</div>
                <div>API Call in Progress: {qnaApiCallInProgressRef.current ? 'Yes' : 'No'}</div>
            </div>
            
            <AiVideo step={step} next={sendPainPointVideo} />
            
            <AiQus 
                step={step}
                send={sendAnswerToAPI}
                onComplete={() => setStep(prev => prev + 1)}
                nextQuestion={nextQuestion}
                isListening={isListening}
                onStartListening={startListening}
                onStopListening={stopListening}
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