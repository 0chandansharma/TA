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

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const streamRef = useRef(null);
    const isMountedRef = useRef(true);
    const audioContextRef = useRef(null);

    const mainService = new ServiceChat();
    const googleSpeechService = new ServiceGoogleSpeech();

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

    // Handle speech to text
    const handleSpeechToText = useCallback(async (audioBlob) => {
        try {
            setStatus("Processing speech...");
            const transcript = await googleSpeechService.speechToText(audioBlob);
            
            if (transcript) {
                // Determine which API to call based on current step
                if (step >= 11) {
                    // We're in QnA phase
                    await sendAnswerToAPI(transcript, assessmentIdRef.current);
                } else {
                    // We're in chat phase
                    await sendChat(transcript, assessmentIdRef.current);
                }
            } else {
                setStatus("Could not understand. Please try again.");
                setTimeout(() => {
                    if (isMountedRef.current) {
                        startListening();
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('Speech-to-Text error:', error);
            setStatus("Error processing speech. Please try again.");
            setTimeout(() => {
                if (isMountedRef.current) {
                    startListening();
                }
            }, 1000);
        }
    }, [step]);

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

            if (listenNext && isMountedRef.current) {
                startListening();
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
                    if (listenNext && isMountedRef.current) {
                        startListening();
                    }
                };
                window.speechSynthesis.speak(utterance);
            }
        }
    }, [googleSpeechService]);

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

    // Send chat message (for initial conversation)
    const sendChat = useCallback(async (message, assID, isImage = false) => {
        if (!isImage) {
            setCurrentDisplayText(message);
        }
        setStatus("Talking to the AI...");
        setIsListening(false);
        stopListening();

        // Create new message object
        const newMessage = { user: message };
        
        setChatHistory(prevChats => {
            const updatedChats = [...prevChats, newMessage];
            
            // Create request body
            const bodyChat = {
                chat_history: updatedChats
            };
            
            // If it's an image, add video field
            if (isImage) {
                bodyChat.video = message; // message contains base64 image
            }

            mainService.chatWithAI(bodyChat, '', assID)
                .then(async (res) => {
                    if (res?.success) {
                        if (!isStart) {
                            setStage("chat");
                        }
                        
                        const chatRes = res.data.response;
                        
                        // Update chat history with response field
                        setChatHistory(latestChats => {
                            const updated = [...latestChats];
                            if (updated.length > 0) {
                                updated[updated.length - 1].response = chatRes;
                            }
                            return updated;
                        });
                        
                        const next_action = res.data.action;
                        
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
                })
                .catch(error => {
                    console.error('Chat API error:', error);
                    setStatus("Error communicating with AI");
                    setTimeout(() => {
                        if (isMountedRef.current) {
                            startListening();
                        }
                    }, 2000);
                });
            
            return updatedChats;
        });
    }, [isStart, mainService, speakText, startListening, stopListening]);

    // Send answer to QnA API (for questionnaire phase)
    const sendAnswerToAPI = useCallback(async (answer, assID) => {
        setStatus("Processing answer...");
        setIsListening(false);
        stopListening();

        // Create the message with user and prepare for response
        const newMessage = { user: answer };
        
        setQnAHistory(prevHistory => {
            const updatedHistory = [...prevHistory, newMessage];
            
            const bodyChat = {
                chat_history: updatedHistory
            };

            mainService.chatWithQnAAI(bodyChat, '', assID)
                .then((res) => {
                    if (res?.success) {
                        if (isStart) {
                            setStage("QnA");
                        }
                        
                        const questionRes = res.data;
                        setNextQuestion(questionRes);
                        
                        // Update the last message with the assistant's response
                        setQnAHistory(prev => {
                            const updated = [...prev];
                            if (updated.length > 0) {
                                updated[updated.length - 1].assistant = questionRes.question;
                            }
                            return updated;
                        });
                        
                        // Check if we need to move to next phase
                        if (questionRes.action === "rom_api") {
                            setStep(20); // Move to ROM phase
                        } else if (questionRes.action === "dashboard_api") {
                            setStep(24); // Move to dashboard
                        }
                    }
                })
                .catch(error => {
                    console.error('QnA API error:', error);
                    setStatus("Error getting next question");
                    setTimeout(() => {
                        if (isMountedRef.current) {
                            startListening();
                        }
                    }, 2000);
                });
            
            return updatedHistory;
        });
    }, [isStart, mainService, stopListening]);

    // Start assessment
    const startAssessment = useCallback(() => {
        const body = {
            userId: 1,
            anatomyId: 3,
            assessmentType: "PAIN",
        };
        
        mainService.createAssessment(body, '')
            .then(async (res) => {
                if (res?.success) {
                    const newAssessmentId = res.data.assessmentId;
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

    // Handle pain point image from video capture
    const sendPainPointImage = useCallback((base64Image) => {
        if (base64Image && assessmentId) {
            sendChat(base64Image, assessmentId, true);
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
    }, []);

    return (
        <div className='bg-prime w-full h-screen overflow-hidden relative'>
            <div className='absolute top-0 left-0 w-full flex justify-center items-start z-50'>
                <div className='bg-white/90 px-4 py-2 rounded-md shadow-sm'>
                    {status}
                </div>
            </div>
            
            <AiVideo step={step} next={sendPainPointImage} />
            
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