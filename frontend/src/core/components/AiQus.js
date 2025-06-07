// AiQus.js - Complete updated version with all fixes
import React, { useEffect, useRef, useState, useCallback } from 'react';
import "@tensorflow/tfjs";
import * as tf from "@tensorflow/tfjs";
import { Camera, Mic, MicOff } from 'lucide-react';
import { AnimatePresence, motion } from "motion/react";

export default function AiQus(props) {
    const localStreamRef = useRef();
    const [isListening, setIsListening] = useState(false);
    const [isMicEnabled, setIsMicEnabled] = useState(true);
    const [currentAnswer, setCurrentAnswer] = useState("");
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [localHistory, setLocalHistory] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    
    // Voice recording refs
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimeoutRef = useRef(null);
    
    // Track initialization and processed questions
    const isInitializedRef = useRef(false);
    const processedQuestionsRef = useRef(new Set());
    const lastAnswerRef = useRef(null);
    
    console.log('🎯 [AiQus] === RENDER ===');
    console.log('🎯 [AiQus] Step:', props.step);
    console.log('🎯 [AiQus] Current Question:', currentQuestion?.question);
    console.log('🎯 [AiQus] Is Processing:', isProcessing);
    
    const init = async () => {
        console.log('🎯 [AiQus] === INIT ===');
        
        if (isInitializedRef.current) {
            console.log('🎯 [AiQus] Already initialized, skipping');
            return;
        }
        
        isInitializedRef.current = true;
        
        try {
            await tf.ready();
            await tf.setBackend("webgl");
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 48000
                }
            });
            
            if (localStreamRef.current) {
                localStreamRef.current.srcObject = stream;
                console.log('✅ [AiQus] Camera and audio initialized');
                
                // Initialize media recorder for audio
                initializeMediaRecorder(stream);
            }
        } catch (error) {
            console.error('❌ [AiQus] Error initializing camera:', error);
            setErrorMessage("Camera/microphone access denied. Please use the options below.");
            if (error.name === 'NotAllowedError' || error.name === 'NotFoundError') {
                setIsMicEnabled(false);
                console.log('🎯 [AiQus] Mic access denied, disabling mic features');
            }
        }
    };

    const initializeMediaRecorder = (stream) => {
        console.log('🎯 [AiQus] Initializing media recorder');
        try {
            const audioStream = new MediaStream(stream.getAudioTracks());
            
            mediaRecorderRef.current = new MediaRecorder(audioStream, {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 128000
            });
            
            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };
            
            mediaRecorderRef.current.onstop = async () => {
                console.log('🎯 [AiQus] Recording stopped, processing audio');
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                audioChunksRef.current = [];
                
                if (audioBlob.size > 0 && props.onStartListening && props.onStopListening) {
                    // Process the audio through parent's speech-to-text
                    const processedText = await props.onStopListening();
                    if (processedText) {
                        handleAnswer(processedText);
                    }
                }
                
                setIsListening(false);
            };
            
            console.log('✅ [AiQus] Media recorder initialized');
        } catch (error) {
            console.error('❌ [AiQus] Error initializing media recorder:', error);
            setIsMicEnabled(false);
        }
    };

    const toggleMic = () => {
        console.log('🎙️ [AiQus] Toggling mic from', isMicEnabled, 'to', !isMicEnabled);
        
        if (isListening) {
            stopListening();
        }
        
        if (localStreamRef.current?.srcObject) {
            const audioTracks = localStreamRef.current.srcObject.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = !isMicEnabled;
            });
        }
        
        setIsMicEnabled(!isMicEnabled);
    };

    const startListening = () => {
        console.log('🎙️ [AiQus] === START LISTENING ===');
        
        if (!isMicEnabled || props.isAiSpeaking) {
            console.log('⚠️ [AiQus] Mic is muted or AI is speaking, cannot start listening');
            return;
        }
        
        // Use parent's listening functionality if available
        if (props.onStartListening) {
            props.onStartListening();
            setIsListening(true);
            
            // Auto-stop after 5 seconds
            recordingTimeoutRef.current = setTimeout(() => {
                console.log('🎙️ [AiQus] Auto-stopping after 5 seconds');
                stopListening();
            }, 5000);
        } else if (mediaRecorderRef.current && !isListening && !isProcessing) {
            // Fallback to local recording
            try {
                audioChunksRef.current = [];
                mediaRecorderRef.current.start();
                setIsListening(true);
                console.log('✅ [AiQus] Started recording');
                
                recordingTimeoutRef.current = setTimeout(() => {
                    console.log('🎙️ [AiQus] Auto-stopping after 5 seconds');
                    stopListening();
                }, 5000);
            } catch (error) {
                console.error('❌ [AiQus] Error starting recording:', error);
                setIsListening(false);
            }
        }
    };

    const stopListening = () => {
        console.log('🎙️ [AiQus] === STOP LISTENING ===');
        
        if (recordingTimeoutRef.current) {
            clearTimeout(recordingTimeoutRef.current);
            recordingTimeoutRef.current = null;
        }
        
        if (props.onStopListening) {
            props.onStopListening();
        } else if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            try {
                mediaRecorderRef.current.stop();
                console.log('✅ [AiQus] Stopped recording');
            } catch (error) {
                console.error('❌ [AiQus] Error stopping recording:', error);
            }
        }
        setIsListening(false);
    };

    const handleAnswer = useCallback(async (answer) => {
        console.log('💬 [AiQus] === HANDLE ANSWER ===');
        console.log('💬 [AiQus] Answer:', answer);
        console.log('💬 [AiQus] Current question:', currentQuestion);
        
        if (isProcessing || props.isAiSpeaking) {
            console.log('⚠️ [AiQus] Already processing or AI speaking, ignoring answer');
            return;
        }
        
        if (!currentQuestion) {
            console.log('⚠️ [AiQus] No current question, ignoring answer');
            return;
        }
        
        // Prevent duplicate answers
        if (lastAnswerRef.current === answer && isProcessing) {
            console.log('⚠️ [AiQus] Duplicate answer detected, ignoring');
            return;
        }
        
        lastAnswerRef.current = answer;
        setIsProcessing(true);
        setCurrentAnswer(answer);
        setErrorMessage("");
        stopListening();
        
        // Update local history with current Q&A
        const newHistoryItem = {
            question: currentQuestion.question || currentQuestion.response,
            answer: answer,
            timestamp: Date.now()
        };
        
        setLocalHistory(prev => [...prev, newHistoryItem]);
        
        // Send answer to parent
        try {
            if (props.send) {
                console.log('💬 [AiQus] Sending answer to parent');
                await props.send(answer);
            } else {
                console.error('❌ [AiQus] props.send not available');
                setIsProcessing(false);
                setErrorMessage("Unable to send answer. Please try again.");
            }
        } catch (error) {
            console.error('❌ [AiQus] Error sending answer:', error);
            setIsProcessing(false);
            setCurrentAnswer("");
            setErrorMessage("Failed to process answer. Please try again.");
        }
    }, [currentQuestion, isProcessing, props]);

    const handleVoiceAnswer = useCallback(async (transcript) => {
        console.log('🎤 [AiQus] Voice answer received:', transcript);
        
        if (!currentQuestion || isProcessing || props.isAiSpeaking) {
            console.log('⚠️ [AiQus] Cannot process voice answer now');
            return;
        }
        
        // Check if transcript matches any option (case-insensitive)
        if (currentQuestion.options) {
            const matchedOption = currentQuestion.options.find(option => 
                option.toLowerCase().includes(transcript.toLowerCase()) ||
                transcript.toLowerCase().includes(option.toLowerCase())
            );
            
            if (matchedOption) {
                console.log('✅ [AiQus] Matched option:', matchedOption);
                handleAnswer(matchedOption);
            } else {
                // If no exact match, use the transcript as-is
                console.log('📝 [AiQus] No option match, using transcript as answer');
                handleAnswer(transcript);
            }
        } else {
            // For questions without options, use transcript directly
            handleAnswer(transcript);
        }
    }, [currentQuestion, isProcessing, props.isAiSpeaking, handleAnswer]);

    const handleOptionClick = (option) => {
        console.log('🖱️ [AiQus] Option clicked:', option);
        
        if (!isProcessing && currentQuestion && !props.isAiSpeaking) {
            handleAnswer(option);
        }
    };

    const toggleCamera = () => {
        console.log('📹 [AiQus] Toggling camera');
        if (localStreamRef.current?.srcObject) {
            const videoTracks = localStreamRef.current.srcObject.getVideoTracks();
            videoTracks.forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsCameraActive(!isCameraActive);
        }
    };

    // Clear error message after 5 seconds
    useEffect(() => {
        if (errorMessage) {
            const timer = setTimeout(() => {
                setErrorMessage("");
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [errorMessage]);

    useEffect(() => {
        console.log('🔄 [AiQus] Step effect triggered, step:', props.step);
        
        if (parseInt(props.step) === 11 && !isInitializedRef.current) {
            init();
        }
        
        // Cleanup when leaving QnA phase
        return () => {
            if (parseInt(props.step) > 19 || parseInt(props.step) < 11) {
                console.log('🧹 [AiQus] Cleaning up QnA phase');
                stopListening();
                isInitializedRef.current = false;
                processedQuestionsRef.current.clear();
                lastAnswerRef.current = null;
                if (localStreamRef.current?.srcObject) {
                    localStreamRef.current.srcObject.getTracks().forEach(track => track.stop());
                }
            }
        };
    }, [props.step]);

    useEffect(() => {
        console.log('🔄 [AiQus] Next question effect triggered');
        
        if (props.nextQuestion) {
            const questionId = `${props.nextQuestion.question || props.nextQuestion.response}_${props.nextQuestion.timestamp || Date.now()}`;
            
            if (processedQuestionsRef.current.has(questionId)) {
                console.log('⚠️ [AiQus] Question already processed, ignoring');
                return;
            }
            
            processedQuestionsRef.current.add(questionId);
            
            console.log('✅ [AiQus] Setting new question');
            setCurrentQuestion(props.nextQuestion);
            setCurrentAnswer('');
            setIsProcessing(false);
            setErrorMessage("");
        }
    }, [props.nextQuestion]);

    // Sync with parent's listening state if provided
    useEffect(() => {
        if (props.isListening !== undefined) {
            setIsListening(props.isListening);
        }
    }, [props.isListening]);

    return (
        <AnimatePresence initial={false}>
            {(parseInt(props.step) >= 11 && parseInt(props.step) <= 19) && (
                <div className='w-[90%] h-[70vh] absolute left-[5%] mt-[5%]'>
                    <div className='flex items-center justify-between gap-8'>
                        {/* Camera View */}
                        <div className='w-[35%]'>
                            <div className='w-full pt-[80%] relative border-[6px] border-primeLight rounded-tl-[60px] rounded-tr-[2px] rounded-br-[60px] rounded-bl-[2px] overflow-hidden shadow-2xl'>
                                <video 
                                    ref={localStreamRef} 
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className='absolute object-cover inset-0 w-full h-full' 
                                />
                                
                                {/* Microphone Button */}
                                <div 
                                    className={`w-[40px] h-[40px] absolute rounded-full bottom-[10px] left-[12px] flex items-center justify-center cursor-pointer transition-all ${
                                        !isMicEnabled ? 'bg-gray-400' :
                                        isListening ? 'bg-red-500 animate-pulse' : 
                                        isProcessing ? 'bg-yellow-500' : 
                                        props.isAiSpeaking ? 'bg-gray-300 cursor-not-allowed' : 
                                        'bg-white hover:bg-gray-100'
                                    }`} 
                                    onClick={() => {
                                        if (props.isAiSpeaking) return;
                                        if (!isMicEnabled) {
                                            toggleMic();
                                        } else if (isListening) {
                                            stopListening();
                                        } else if (!isProcessing) {
                                            startListening();
                                        }
                                    }}
                                >
                                    {!isMicEnabled ? (
                                        <MicOff size={22} color="white" />
                                    ) : (
                                        <Mic size={22} color={isListening || isProcessing ? 'white' : 'black'} />
                                    )}
                                </div>
                                
                                {/* Camera Button */}
                                <div 
                                    className='bg-white w-[40px] h-[40px] absolute rounded-full bottom-[10px] left-[68px] flex items-center justify-center cursor-pointer hover:bg-gray-100'
                                    onClick={toggleCamera}
                                >
                                    <Camera size={22} />
                                </div>
                                
                                {/* Status Indicator */}
                                <div className='bg-black/70 absolute top-[10px] left-[10px] text-white p-2 rounded text-xs'>
                                    <div>Mic: {!isMicEnabled ? 'Muted' : isListening ? 'Recording' : 'Ready'}</div>
                                    <div>Processing: {isProcessing ? 'Yes' : 'No'}</div>
                                </div>
                                
                                {/* Listening Animation */}
                                {isListening && isMicEnabled && (
                                    <div className='absolute inset-0 border-4 border-green-400 animate-pulse rounded-tl-[60px] rounded-tr-[2px] rounded-br-[60px] rounded-bl-[2px]'></div>
                                )}
                            </div>
                        </div>
                        
                        {/* Questions and Answers - Increased width */}
                        <div className='w-[60%] h-[70vh] space-y-6 relative'>
                            <div 
                                className='space-y-3 flex flex-col items-end overflow-y-auto pr-4'
                                style={{
                                    maxHeight: '65vh',
                                    scrollbarWidth: 'none',
                                    msOverflowStyle: 'none',
                                    WebkitScrollbar: 'none'
                                }}
                            >
                                <style jsx>{`
                                    div::-webkit-scrollbar {
                                        display: none;
                                    }
                                `}</style>
                                
                                {/* Display conversation history */}
                                {localHistory.map((item, index) => (
                                    <div key={`history-${index}-${item.timestamp}`} className="w-full mb-6">
                                        {/* Question bubble */}
                                        <div className="flex justify-end mb-3">
                                            <div className='bg-white px-6 py-3 shadow-lg rounded-tl-[20px] rounded-tr-[4px] rounded-br-[20px] rounded-bl-[20px] max-w-[85%]'>
                                                <p className='text-base text-gray-800'>
                                                    {item.question}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {/* Answer bubble */}
                                        <div className="flex justify-end">
                                            <div className='bg-[#6AFBC6] px-6 py-3 shadow-lg rounded-tl-[20px] rounded-tr-[20px] rounded-br-[4px] rounded-bl-[20px] max-w-[85%]'>
                                                <p className='text-base text-gray-800'>
                                                    {item.answer}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                
                                {/* Display current question */}
                                {currentQuestion && (
                                    <div className="w-full mb-6">
                                        {/* Current question bubble */}
                                        <div className="flex justify-end mb-4">
                                            <div className='bg-white px-6 py-3 shadow-lg rounded-tl-[20px] rounded-tr-[4px] rounded-br-[20px] rounded-bl-[20px] max-w-[85%]'>
                                                <p className='text-base text-gray-800'>
                                                    {currentQuestion.question || currentQuestion.response}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {/* Display options if available and no answer yet */}
                                        {currentQuestion.options && !currentAnswer && (
                                            <div className="flex flex-col items-end space-y-2">
                                                {currentQuestion.options.map((option, index) => (
                                                    <div 
                                                        key={`option-${index}`}
                                                        className={`cursor-pointer transition-all transform hover:scale-105 ${
                                                            isProcessing || props.isAiSpeaking ? 'opacity-50 cursor-not-allowed' : ''
                                                        }`}
                                                        onClick={() => !isProcessing && !props.isAiSpeaking && handleOptionClick(option)}
                                                    >
                                                        <div className='bg-white hover:bg-gray-50 px-5 py-2 shadow-md rounded-tl-[16px] rounded-tr-[4px] rounded-br-[16px] rounded-bl-[16px] border border-gray-200 transition-colors'>
                                                            <p className='text-sm text-gray-700'>
                                                                {option}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {/* Display current answer only once */}
                                        {currentAnswer && (
                                            <div className="flex justify-end">
                                                <div className='bg-[#6AFBC6] px-6 py-3 shadow-lg rounded-tl-[20px] rounded-tr-[20px] rounded-br-[4px] rounded-bl-[20px] max-w-[85%]'>
                                                    <p className='text-base text-gray-800'>
                                                        {currentAnswer}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {/* Error Message */}
                                {errorMessage && (
                                    <div className='bg-red-50 border border-red-200 px-4 py-3 rounded-lg text-sm text-red-700 w-full max-w-[85%]'>
                                        {errorMessage}
                                    </div>
                                )}
                            </div>
                            
                            {/* Status Messages - Moved outside scrollable area */}
                            <div className='absolute bottom-0 right-0 pr-4'>
                                {!isMicEnabled && currentQuestion && !currentAnswer && !errorMessage && (
                                    <p className='text-sm text-gray-500 italic'>
                                        Mic is muted. Click on options to answer.
                                    </p>
                                )}
                                
                                {isMicEnabled && isListening && (
                                    <p className='text-sm text-green-600 italic'>
                                        Listening for your answer...
                                    </p>
                                )}
                                
                                {isMicEnabled && !isListening && currentQuestion && !currentAnswer && !isProcessing && !errorMessage && !props.isAiSpeaking && (
                                    <p className='text-sm text-gray-500 italic'>
                                        Click mic to speak or select an option
                                    </p>
                                )}
                                
                                {isProcessing && (
                                    <p className='text-sm text-yellow-600 italic'>
                                        Processing your answer...
                                    </p>
                                )}
                                
                                {props.isAiSpeaking && (
                                    <p className='text-sm text-blue-600 italic'>
                                        AI is speaking...
                                    </p>
                                )}
                                {props.isQnAComplete && !currentQuestion && !isProcessing && (
                                    <p className='text-sm text-gray-600 italic'>
                                        Feel free to ask any follow-up questions...
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
}