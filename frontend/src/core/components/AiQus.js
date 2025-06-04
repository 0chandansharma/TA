import React, { useEffect, useRef, useState } from 'react';
import "@tensorflow/tfjs";
import * as tf from "@tensorflow/tfjs";
import { Camera, Mic } from 'lucide-react';
import { AnimatePresence, motion } from "motion/react";

export default function AiQus(props) {
    const localStreamRef = useRef();
    const [isListening, setIsListening] = useState(false);
    const recognition = useRef(null);
    const [currentAnswer, setCurrentAnswer] = useState("");
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [localHistory, setLocalHistory] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    
    console.log('=== AiQus RENDER ===');
    console.log('Step:', props.step);
    console.log('Next Question:', props.nextQuestion);
    console.log('Local History:', localHistory);
    
    const init = async () => {
        console.log('=== AiQus INIT ===');
        try {
            await tf.ready();
            await tf.setBackend("webgl");
            
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (localStreamRef.current) {
                localStreamRef.current.srcObject = stream;
                console.log('Camera initialized for QnA');
            }
        } catch (error) {
            console.error('Error initializing camera for QnA:', error);
        }
        
        // Initialize speech recognition
        initSpeechRecognition();
    };

    const initSpeechRecognition = () => {
        console.log('=== AiQus SPEECH RECOGNITION INIT ===');
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
            recognition.current = new SpeechRecognition();
            recognition.current.continuous = false;
            recognition.current.interimResults = false;
            recognition.current.lang = "en-US";
            recognition.current.maxAlternatives = 1;
            
            recognition.current.onstart = () => {
                console.log('=== QnA Speech recognition STARTED ===');
                setIsListening(true);
            };
            
            recognition.current.onresult = (event) => {
                console.log('=== QnA Speech recognition RESULT ===');
                const transcript = event.results[0][0].transcript;
                const confidence = event.results[0][0].confidence;
                console.log('Transcript:', transcript, 'Confidence:', confidence);
                handleAnswer(transcript);
            };

            recognition.current.onend = () => {
                console.log('=== QnA Speech recognition ENDED ===');
                setIsListening(false);
            };

            recognition.current.onerror = (event) => {
                console.error('=== QnA Speech recognition ERROR ===', event.error);
                setIsListening(false);
                
                // Don't auto-retry for no-speech errors - wait for user interaction
                console.log('Speech recognition error, waiting for manual interaction');
            };

            console.log('Speech recognition initialized for QnA');
        } else {
            console.error('Speech recognition not supported in this browser');
        }
    };

    useEffect(() => {
        console.log('=== AiQus STEP EFFECT ===');
        console.log('Step changed to:', props.step);
        if (parseInt(props.step) === 11) {
            init();
        }
        
        // Cleanup when leaving QnA phase
        return () => {
            if (parseInt(props.step) > 19 || parseInt(props.step) < 11) {
                stopListening();
                if (localStreamRef.current?.srcObject) {
                    localStreamRef.current.srcObject.getTracks().forEach(track => track.stop());
                }
            }
        };
    }, [props.step]);

    useEffect(() => {
        console.log('=== AiQus NEXT QUESTION EFFECT ===');
        console.log('Next question updated:', props.nextQuestion);
        console.log('Current question:', currentQuestion);
        
        if (props.nextQuestion && props.nextQuestion !== currentQuestion) {
            console.log('Setting new question and clearing answer');
            setCurrentQuestion(props.nextQuestion);
            setCurrentAnswer('');
            setIsProcessing(false);
            
            // Add to local history
            if (currentQuestion && currentAnswer) {
                setLocalHistory(prev => [...prev, {
                    question: currentQuestion.question || currentQuestion.response,
                    answer: currentAnswer,
                    timestamp: Date.now()
                }]);
            }
            
            // Don't auto-start listening - wait for user to manually start
            console.log('New question set, waiting for user interaction');
        }
    }, [props.nextQuestion, currentQuestion, currentAnswer]);

    const startListening = () => {
        console.log('=== AiQus START LISTENING ===');
        console.log('Recognition available:', !!recognition.current);
        console.log('Currently listening:', isListening);
        console.log('Currently processing:', isProcessing);
        
        if (recognition.current && !isListening && !isProcessing) {
            try {
                recognition.current.start();
                console.log('Speech recognition start() called');
            } catch (error) {
                console.error('Error starting speech recognition:', error);
                if (error.name === 'InvalidStateError') {
                    recognition.current.stop();
                    setTimeout(() => {
                        if (!isProcessing) {
                            try {
                                recognition.current.start();
                            } catch (e) {
                                console.error('Retry failed:', e);
                            }
                        }
                    }, 500);
                }
            }
        } else {
            console.log('Cannot start listening:', {
                hasRecognition: !!recognition.current,
                isListening: isListening,
                isProcessing: isProcessing
            });
        }
    };

    const stopListening = () => {
        console.log('=== AiQus STOP LISTENING ===');
        if (recognition.current && isListening) {
            try {
                recognition.current.stop();
                console.log('Speech recognition stop() called');
            } catch (error) {
                console.error('Error stopping speech recognition:', error);
            }
        }
        setIsListening(false);
    };

    const handleAnswer = async (answer) => {
        console.log('=== AiQus HANDLE ANSWER ===');
        console.log('Answer:', answer);
        console.log('Current question:', currentQuestion);
        
        if (isProcessing) {
            console.log('Already processing, ignoring duplicate answer');
            return;
        }
        
        setIsProcessing(true);
        setCurrentAnswer(answer);
        stopListening();
        
        // Update local history
        if (currentQuestion) {
            const newHistoryItem = {
                question: currentQuestion.question || currentQuestion.response,
                answer: answer,
                timestamp: Date.now()
            };
            
            setLocalHistory(prev => {
                const updated = [...prev, newHistoryItem];
                console.log('Updated local history:', updated);
                return updated;
            });
        }
        
        // Send answer to parent
        try {
            if (props.send) {
                console.log('Calling props.send with answer:', answer);
                await props.send(answer);
            } else {
                console.error('props.send not available');
            }
        } catch (error) {
            console.error('Error sending answer:', error);
            setIsProcessing(false);
        }
    };

    const handleOptionClick = (option) => {
        console.log('=== AiQus OPTION CLICKED ===');
        console.log('Option:', option);
        
        if (!isProcessing) {
            handleAnswer(option);
        }
    };

    const manualStartListening = () => {
        console.log('=== MANUAL START LISTENING ===');
        if (isProcessing) {
            console.log('Currently processing, cannot start listening');
            return;
        }
        startListening();
    };

    return (
        <AnimatePresence initial={false}>
            {(parseInt(props.step) >= 11 && parseInt(props.step) <= 19) && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className='w-[80%] h-[60vh] absolute left-[10%] mt-[10%]'
                >
                    <div className='flex items-center justify-between'>
                        <div className='w-[40%]'>
                            <div className='w-full pt-[80%] relative border-[6px] border-primeLight rounded-tl-[60px] rounded-tr-[2px] rounded-br-[60px] rounded-bl-[2px] overflow-hidden shadow-2xl'>
                                <video ref={localStreamRef} autoPlay playsInline muted className='absolute object-cover inset-0 w-full h-full' />
                                
                                {/* Microphone Button */}
                                <div 
                                    className={`w-[40px] h-[40px] absolute rounded-full bottom-[10px] left-[12px] flex items-center justify-center cursor-pointer transition-all ${
                                        isListening ? 'bg-red-500 animate-pulse' : 
                                        isProcessing ? 'bg-yellow-500' : 'bg-white hover:bg-gray-100'
                                    }`} 
                                    onClick={manualStartListening}
                                >
                                    <Mic size={22} color={isListening ? 'white' : 'black'} />
                                </div>
                                
                                {/* Camera Button */}
                                <div className='bg-white w-[40px] h-[40px] absolute rounded-full bottom-[10px] left-[68px] flex items-center justify-center cursor-pointer hover:bg-gray-100'>
                                    <Camera size={22} />
                                </div>
                                
                                {/* Status Indicator */}
                                <div className='bg-black/70 absolute top-[10px] left-[10px] text-white p-2 rounded text-xs'>
                                    <div>Listening: {isListening ? 'Yes' : 'No'}</div>
                                    <div>Processing: {isProcessing ? 'Yes' : 'No'}</div>
                                    <div>Question: {currentQuestion ? 'Yes' : 'No'}</div>
                                    <div>History: {localHistory.length}</div>
                                </div>
                                
                                {/* Listening Animation */}
                                {isListening && (
                                    <div className='absolute inset-0 border-4 border-green-400 animate-pulse rounded-tl-[60px] rounded-tr-[2px] rounded-br-[60px] rounded-bl-[2px]'></div>
                                )}
                            </div>
                        </div>
                        
                        <div className='w-[50%] h-[70vh] space-y-6 relative overflow-y-auto'>
                            <div className='space-y-3 flex flex-col items-end questions-list-container'>
                                
                                {/* Display conversation history */}
                                {localHistory.map((item, index) => (
                                    <div key={index} className="question-container">
                                        <p className='bg-chSend px-4 py-2 inline-block shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-base'>
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
                                    <div className="question-container">
                                        <p className='bg-chSend px-4 py-2 inline-block shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-base'>
                                            {currentQuestion.question || currentQuestion.response}
                                        </p>
                                        
                                        {/* Display options if available and no answer yet */}
                                        {currentQuestion.options && !currentAnswer && (
                                            <div className="question-option-container">
                                                {currentQuestion.options.map((option, index) => (
                                                    <div 
                                                        key={index}
                                                        className={`cursor-pointer question-option ${
                                                            isProcessing ? 'opacity-50 cursor-not-allowed' : ''
                                                        }`}
                                                        onClick={() => !isProcessing && handleOptionClick(option)}
                                                    >
                                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
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
                                
                                {/* Status Messages */}
                                {isListening && (
                                    <div className='bg-green-100 border border-green-400 px-4 py-2 rounded-lg text-sm text-green-700 flex items-center'>
                                        <div className='w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse'></div>
                                        Listening for your answer...
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
                </motion.div>
            )}
        </AnimatePresence>
    );
}