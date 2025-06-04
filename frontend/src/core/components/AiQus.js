// Update the AiQus component to properly handle chat history:
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
    
    const init = async () => {
        await tf.ready();
        await tf.setBackend("webgl");
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current.srcObject = stream;
        
        // Send initial message to get first question
        const response = await props.send("hi");
        if (response?.question) {
            setCurrentQuestion(response);
            setLocalHistory([{ user: "hi", response: response.question }]);
        }
    };

    useEffect(() => {
        if (parseInt(props.step) === 11) {
            init();
        }
    }, [props.step]);

    useEffect(() => {
        // Initialize speech recognition
        if ('webkitSpeechRecognition' in window) {
            recognition.current = new window.webkitSpeechRecognition();
            recognition.current.continuous = false;
            recognition.current.interimResults = false;
        }
    }, []);

    useEffect(() => {
        if (props.nextQuestion && props.nextQuestion !== currentQuestion) {
            setCurrentQuestion(props.nextQuestion);
            setCurrentAnswer('');
            startListening();
        }
    }, [props.nextQuestion]);

    const startListening = () => {
        if (recognition.current) {
            recognition.current.onstart = () => {
                setIsListening(true);
            };
            
            recognition.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                handleAnswer(transcript);
            };

            recognition.current.onend = () => {
                setIsListening(false);
            };

            recognition.current.start();
        }
    };

    const stopListening = () => {
        if (recognition.current) {
            recognition.current.stop();
            setIsListening(false);
        }
    };

    const handleAnswer = async (answer) => {
        setCurrentAnswer(answer);
        stopListening();
        
        // Update local history
        const updatedHistory = [...localHistory];
        if (updatedHistory.length > 0) {
            updatedHistory[updatedHistory.length - 1].response = currentQuestion.question;
        }
        updatedHistory.push({ user: answer });
        setLocalHistory(updatedHistory);
        
        // Send answer and wait for next question
        await props.send(answer);
    };

    return (
        <AnimatePresence initial={false}>
            {(parseInt(props.step) >= 11 && parseInt(props.step) <= 15) && (
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
                                <div 
                                    className={`bg-white w-[40px] h-[40px] absolute rounded-full bottom-[10px] left-[12px] flex items-center justify-center cursor-pointer ${isListening ? 'bg-red-500' : ''}`} 
                                    onClick={() => isListening ? stopListening() : startListening()}
                                >
                                    <Mic size={22} color={isListening ? 'white' : 'black'} />
                                </div>
                                <div className='bg-white w-[40px] h-[40px] absolute rounded-full bottom-[10px] left-[68px] flex items-center justify-center cursor-pointer'>
                                    <Camera size={22} />
                                </div>
                            </div>
                        </div>
                        
                        <div className='w-[50%] h-[70vh] space-y-6 relative overflow-y-auto'>
                            <div className='space-y-3 flex flex-col items-end'>
                                {localHistory.map((item, index) => (
                                    <div key={index} className="question-container">
                                        {item.response && (
                                            <p className='bg-chSend px-4 py-2 inline-block shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-base'>
                                                {item.response}
                                            </p>
                                        )}
                                        {item.user && item.user !== "hi" && (
                                            <p className='bg-chSend px-4 py-2 inline-block shadow-md rounded-t-[14px] rounded-bl-[1px] rounded-br-[14px] text-base answer-text bg-primeDark mt-2'>
                                                {item.user}
                                            </p>
                                        )}
                                    </div>
                                ))}
                                
                                {currentQuestion && !localHistory.find(h => h.response === currentQuestion.question) && (
                                    <div className="question-container">
                                        <p className='bg-chSend px-4 py-2 inline-block shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-base'>
                                            {currentQuestion.question}
                                        </p>
                                        
                                        {!currentAnswer && currentQuestion.options && (
                                            <div className="question-option-container">
                                                {currentQuestion.options.map((option, index) => (
                                                    <div 
                                                        key={index}
                                                        className='cursor-pointer question-option' 
                                                        onClick={() => handleAnswer(option)}
                                                    >
                                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                                            {option}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {currentAnswer && (
                                            <p className='bg-chSend px-4 py-2 inline-block shadow-md rounded-t-[14px] rounded-bl-[1px] rounded-br-[14px] text-base answer-text bg-primeDark mt-2'>
                                                {currentAnswer}
                                            </p>
                                        )}
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