// AiQus.js - Fixed with better interaction handling
import React, { useEffect, useRef, useState } from 'react';
import "@tensorflow/tfjs";
import * as tf from "@tensorflow/tfjs";
import { Camera, Mic, MicOff } from 'lucide-react';
import { AnimatePresence, motion } from "motion/react";

export default function AiQus(props) {
    const localStreamRef = useRef();
    const [isListening, setIsListening] = useState(false);
    const [isMicEnabled, setIsMicEnabled] = useState(true); // Track if mic is enabled
    const [currentAnswer, setCurrentAnswer] = useState("");
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [localHistory, setLocalHistory] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(true);
    
    // Voice recording refs
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimeoutRef = useRef(null);
    
    // Track the last question to prevent duplicates
    const lastQuestionIdRef = useRef(null);
    const isInitializedRef = useRef(false);
    const processedQuestionsRef = useRef(new Set());
    
    console.log('🎯 [AiQus] === RENDER ===');
    console.log('🎯 [AiQus] Step:', props.step);
    console.log('🎯 [AiQus] Mic Enabled:', isMicEnabled);
    console.log('🎯 [AiQus] Is Listening:', isListening);
    
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
            // If mic access denied, disable mic
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
            
            mediaRecorderRef.current.onstop = () => {
                console.log('🎯 [AiQus] Recording stopped, processing audio');
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                audioChunksRef.current = [];
                
                if (audioBlob.size > 0 && props.onVoiceRecording) {
                    props.onVoiceRecording(audioBlob);
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
        console.log('🎙️ [AiQus] Mic enabled:', isMicEnabled);
        console.log('🎙️ [AiQus] Media recorder available:', !!mediaRecorderRef.current);
        
        if (!isMicEnabled) {
            console.log('⚠️ [AiQus] Mic is muted, cannot start listening');
            return;
        }
        
        if (mediaRecorderRef.current && !isListening && !isProcessing) {
            try {
                audioChunksRef.current = [];
                mediaRecorderRef.current.start();
                setIsListening(true);
                console.log('✅ [AiQus] Started recording');
                
                // Auto-stop after 5 seconds
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
        
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            try {
                mediaRecorderRef.current.stop();
                console.log('✅ [AiQus] Stopped recording');
            } catch (error) {
                console.error('❌ [AiQus] Error stopping recording:', error);
            }
        }
        setIsListening(false);
    };

    const handleAnswer = async (answer) => {
        console.log('💬 [AiQus] === HANDLE ANSWER ===');
        console.log('💬 [AiQus] Answer:', answer);
        console.log('💬 [AiQus] Current question:', currentQuestion);
        
        if (isProcessing) {
            console.log('⚠️ [AiQus] Already processing, ignoring duplicate answer');
            return;
        }
        
        setIsProcessing(true);
        setCurrentAnswer(answer);
        stopListening();
        
        // Update local history with current Q&A
        if (currentQuestion) {
            const newHistoryItem = {
                question: currentQuestion.question || currentQuestion.response,
                answer: answer,
                timestamp: Date.now()
            };
            
            setLocalHistory(prev => {
                const updated = [...prev, newHistoryItem];
                console.log('💬 [AiQus] Updated local history:', updated);
                return updated;
            });
        }
        
        // Send answer to parent with delay to prevent race conditions
        setTimeout(async () => {
            try {
                if (props.send) {
                    console.log('💬 [AiQus] Sending answer to parent');
                    await props.send(answer);
                } else {
                    console.error('❌ [AiQus] props.send not available');
                    setIsProcessing(false);
                }
            } catch (error) {
                console.error('❌ [AiQus] Error sending answer:', error);
                setIsProcessing(false);
            }
        }, 100);
    };

    const handleOptionClick = (option) => {
        console.log('🖱️ [AiQus] Option clicked:', option);
        
        if (!isProcessing) {
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
                lastQuestionIdRef.current = null;
                processedQuestionsRef.current.clear();
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
            
            if (lastQuestionIdRef.current === questionId) {
                console.log('⚠️ [AiQus] Same as last question, ignoring');
                return;
            }
            
            lastQuestionIdRef.current = questionId;
            processedQuestionsRef.current.add(questionId);
            
            console.log('✅ [AiQus] Setting new question');
            
            // Add previous Q&A to history if exists
            if (currentQuestion && currentAnswer && currentAnswer !== "") {
                setLocalHistory(prev => {
                    const exists = prev.some(item => 
                        item.question === (currentQuestion.question || currentQuestion.response) &&
                        item.answer === currentAnswer
                    );
                    
                    if (!exists) {
                        return [...prev, {
                            question: currentQuestion.question || currentQuestion.response,
                            answer: currentAnswer,
                            timestamp: Date.now()
                        }];
                    }
                    return prev;
                });
            }
            
            setCurrentQuestion(props.nextQuestion);
            setCurrentAnswer('');
            setIsProcessing(false);
        }
    }, [props.nextQuestion]);

    return (
        <AnimatePresence initial={false}>
            {(parseInt(props.step) >= 11 && parseInt(props.step) <= 19) && (
                <div className='w-[80%] h-[60vh] absolute left-[10%] mt-[10%]'>
                    <div className='flex items-center justify-between'>
                        {/* Camera View */}
                        <div className='w-[40%]'>
                            <div className='w-full pt-[80%] relative border-[6px] border-primeLight rounded-tl-[60px] rounded-tr-[2px] rounded-br-[60px] rounded-bl-[2px] overflow-hidden shadow-2xl'>
                                <video 
                                    ref={localStreamRef} 
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className='absolute object-cover inset-0 w-full h-full' 
                                />
                                
                                {/* Microphone Button - Now handles both mute/unmute and start/stop listening */}
                                <div 
                                    className={`w-[40px] h-[40px] absolute rounded-full bottom-[10px] left-[12px] flex items-center justify-center cursor-pointer transition-all ${
                                        !isMicEnabled ? 'bg-gray-400' :
                                        isListening ? 'bg-red-500 animate-pulse' : 
                                        isProcessing ? 'bg-yellow-500' : 'bg-white hover:bg-gray-100'
                                    }`} 
                                    onClick={() => {
                                        if (!isMicEnabled) {
                                            toggleMic(); // Enable mic first
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
                                    <div>Questions: {localHistory.length + (currentQuestion ? 1 : 0)}</div>
                                </div>
                                
                                {/* Listening Animation */}
                                {isListening && isMicEnabled && (
                                    <div className='absolute inset-0 border-4 border-green-400 animate-pulse rounded-tl-[60px] rounded-tr-[2px] rounded-br-[60px] rounded-bl-[2px]'></div>
                                )}
                            </div>
                        </div>
                        
                        {/* Questions and Answers - Hidden scrollbar but scrollable */}
                        <div className='w-[50%] h-[60vh] space-y-6 relative'>
                            <div 
                                className='space-y-3 flex flex-col items-end overflow-y-auto pr-2'
                                style={{
                                    maxHeight: '60vh',
                                    scrollbarWidth: 'none', /* Firefox */
                                    msOverflowStyle: 'none', /* IE and Edge */
                                }}
                            >
                                <style jsx>{`
                                    div::-webkit-scrollbar {
                                        display: none; /* Chrome, Safari and Opera */
                                    }
                                `}</style>
                                
                                {/* Display conversation history */}
                                {localHistory.map((item, index) => (
                                    <div key={`history-${index}-${item.timestamp}`} className="question-container w-full">
                                        <p className='bg-chSend px-4 py-2 inline-block shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-base ml-auto'>
                                            {item.question}
                                        </p>
                                        <div className="question-option-container">
                                            <div className='answer-text mt-2'>
                                                <p className='bg-primeDark px-4 py-2 inline-block shadow-md rounded-t-[14px] rounded-bl-[1px] rounded-br-[14px] text-base'>
                                                    {item.answer}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                
                                {/* Display current question */}
                                {currentQuestion && (
                                    <div className="question-container w-full">
                                        <p className='bg-chSend px-4 py-2 inline-block shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-base ml-auto'>
                                            {currentQuestion.question || currentQuestion.response}
                                        </p>
                                        
                                        {/* Display options if available and no answer yet */}
                                        {currentQuestion.options && !currentAnswer && (
                                            <div className="question-option-container">
                                                {currentQuestion.options.map((option, index) => (
                                                    <div 
                                                        key={`option-${index}`}
                                                        className={`cursor-pointer question-option ${
                                                            isProcessing ? 'opacity-50 cursor-not-allowed' : ''
                                                        }`}
                                                        onClick={() => !isProcessing && handleOptionClick(option)}
                                                    >
                                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs transition-colors'>
                                                            {option}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {/* Display current answer */}
                                        {currentAnswer && (
                                            <div className="question-option-container">
                                                <div className='answer-text mt-2'>
                                                    <p className='bg-primeDark px-4 py-2 inline-block shadow-md rounded-t-[14px] rounded-bl-[1px] rounded-br-[14px] text-base'>
                                                        {currentAnswer}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {/* Status Messages - Now with better mic status */}
                                {!isMicEnabled && currentQuestion && !currentAnswer && (
                                    <div className='bg-blue-100 border border-blue-400 px-4 py-2 rounded-lg text-sm text-blue-700 flex items-center'>
                                        <div className='w-2 h-2 bg-blue-500 rounded-full mr-2'></div>
                                        Mic is muted. Click on options to answer.
                                    </div>
                                )}
                                
                                {isMicEnabled && isListening && (
                                    <div className='bg-green-100 border border-green-400 px-4 py-2 rounded-lg text-sm text-green-700 flex items-center'>
                                        <div className='w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse'></div>
                                        Listening for your answer...
                                    </div>
                                )}
                                
                                {isMicEnabled && !isListening && currentQuestion && !currentAnswer && !isProcessing && (
                                    <div className='bg-gray-100 border border-gray-400 px-4 py-2 rounded-lg text-sm text-gray-700 flex items-center'>
                                        <div className='w-2 h-2 bg-gray-500 rounded-full mr-2'></div>
                                        Click mic to speak or select an option
                                    </div>
                                )}
                                
                                {isProcessing && (
                                    <div className='bg-yellow-100 border border-yellow-400 px-4 py-2 rounded-lg text-sm text-yellow-700 flex items-center'>
                                        <div className='w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-pulse'></div>
                                        Processing your answer...
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
}