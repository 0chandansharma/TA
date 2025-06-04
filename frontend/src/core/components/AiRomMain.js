import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import Constent from '../services/models/AppConstent';
const VIDEO_DURATION = 500;
export default function AiRomMain(props) {
    const localStreamRef = useRef();
    const lastFrameRef = useRef(null);
    const canvasRef = useRef(null);
    const wsRef = useRef(null);
    const [timer, setTimer] = useState(VIDEO_DURATION);
    const [lastFrame, setLastFrame] = useState(null);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const intervalRef = useRef(null); // New ref for interval
    const startStreamingIntervalRef = useRef(null);
    const [wsStatus, setWsStatus] = useState('disconnected'); 

    // Initialize WebSocket and Media Stream
    const init = async () => {
        try {
            // Get user media stream
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    aspectRatio: 16/9
                }, 
                audio: true 
            });
            localStreamRef.current.srcObject = stream;

            // Wait for video to be ready
            localStreamRef.current.onloadedmetadata = () => {
                setIsVideoReady(true);
            };

            // Initialize WebSocket
            wsRef.current = new WebSocket(Constent.WS_URL);
            
            wsRef.current.onopen = () => {
                console.log('WebSocket Connected to server',wsRef.current);
                setWsStatus('connected');
                startStreamingIntervalRef.current = setInterval(() => {
                    // pingWebSocket();
                    startStreaming(isVideoReady);
                }, 5000);
            };

            wsRef.current.onclose = () => {
                console.log("WebSocket connection closed.");
            };
    

            wsRef.current.onmessage = (event) => {
                // Store the latest frame data received from server
                if(event.data){
                    const data = JSON.parse(event.data);
                    lastFrameRef.current = data;
                    console.log('lastFrameRef.current=>',lastFrameRef.current);
                    setLastFrame(data);
                    setWsStatus('receiving');
                }
            };

            wsRef.current.onerror = (error) => {
                console.error('WebSocket Error:', error);
                setWsStatus('error');
            };

            setTimeout(() => {
                pingWebSocket();
            }, 1000);

        } catch (error) {
            console.error("Error initializing:", error);
            setWsStatus('error');
        }
    };

    // Add ping to check connection
    const pingWebSocket = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send('ping');
        }
    };
    // Add status indicator in UI
    const renderWebSocketStatus = () => {
        const statusStyles = {
            disconnected: 'bg-red-500',
            connected: 'bg-yellow-500',
            receiving: 'bg-green-500',
            error: 'bg-red-500'
        };

        return (
            <div className='absolute top-[10px] left-[10px] flex items-center space-x-2 bg-white p-2 rounded-lg'>
                <div className={`w-3 h-3 rounded-full ${statusStyles[wsStatus]}`}></div>
                <span className='text-sm capitalize'>{wsStatus}</span>
            </div>
        );
    };
    // Stream video frames to WebSocket
    const startStreaming = (isVideoReady) => {
        if (!wsRef.current) return;

        const canvas = document.createElement('canvas');
        canvas.width = localStreamRef.current.videoWidth;
        canvas.height = localStreamRef.current.videoHeight;
        const ctx = canvas.getContext('2d');

        const sendFrame = () => {
            try {
                // Draw the current video frame to canvas
                ctx.drawImage(localStreamRef.current, 0, 0);
                
                // Convert frame to blob and send
                canvas.toBlob((blob) => {
                    // console.log('sendFrame =>',blob);
                    const base64Image = canvas.toDataURL("image/jpeg");
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(base64Image);
                    }
                }, 'image/jpeg', 0.8);
            } catch (error) {
                console.error('Error capturing frame:', error);
            }
        };

             // Clear any existing interval
             if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            
            // Start new interval
            intervalRef.current = setInterval(sendFrame, 100);
    };

    // Handle timer end and cleanup
    const onTimerEnd = async () => {
        try {
            // Clear the streaming interval
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                clearInterval(startStreamingIntervalRef.current);
                intervalRef.current = null;
            }
            setIsVideoReady(false);
            if (lastFrameRef.current) {
                // Send last frame to backend
                console.log('lastFrame inside=>',lastFrameRef.current.rom_data);
                const requestBody = {
                    rangeOfMotion: {
                        minimum: lastFrameRef.current.rom_data?.ROM ? lastFrameRef.current.rom_data?.ROM[0] : 0,
                        maximum: lastFrameRef.current.rom_data?.ROM ? lastFrameRef.current.rom_data?.ROM[1] : 0
                    }
                };
                props.saveRomData(requestBody);
            }

            // Cleanup
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (localStreamRef.current.srcObject) {
                localStreamRef.current.srcObject.getTracks().forEach(track => track.stop());
            }



            // Move to next step
            props.next();
        } catch (error) {
            console.error('Error in timer end handling:', error);
        }
    };
    // Start streaming when video is ready
    useEffect(() => {
        console.log('isVideoReady updated',isVideoReady);
        if (isVideoReady) {
            startStreaming();
        }
    }, [isVideoReady]);
    // Timer effect
    useEffect(() => {
        if (parseInt(props.step) === 21) {
            let interval = setInterval(() => {
                setTimer((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        onTimerEnd();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [props.step]);

    // Initialize when reaching the correct step
    useEffect(() => {
        if (parseInt(props.step) === 21) {
            init();
        }

        return () => {
            // Cleanup on unmount
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (localStreamRef.current?.srcObject) {
                localStreamRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
        };
    }, [props.step]);

    return (
        <AnimatePresence initial={false}>
            <div className='flex items-center justify-between'>
                {(parseInt(props.step) >= 20 && parseInt(props.step) < 22) && (
                    <motion.div 
                        initial={{ opacity: 0, translateY: '300px' }} 
                        animate={{ opacity: 1, translateY: 0 }} 
                        exit={{ opacity: 0, translateY: '300px' }} 
                        className='w-full h-screen flex items-center justify-center relative'
                    >
                        <div className='w-full h-full relative'>
                            <div className='w-full h-full border-[6px] border-primeLight overflow-hidden'>
                                <video 
                                    ref={localStreamRef} 
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className='object-cover absolute inset-0 w-full h-full' 
                                />
                                <canvas 
                                    ref={canvasRef} 
                                    className='w-full h-full absolute top-0 left-0 pointer-events-none' 
                                />
                                <div className='bg-white absolute top-[10px] right-[10px] text-txtMain p-2 rounded-tl-[14px] rounded-tr-[2px] rounded-br-[14px] rounded-bl-[2px] text-sm'>
                                    Timer: {timer}s
                                </div>
                                {lastFrameRef.current?.rom_data && <div className='bg-white absolute bottom-[10px] left-1/2 -translate-x-1/2 text-txtMain p-2 pl-10 pr-10 rounded-bl-[2px] text-2xl font-normal text-blue-600'>
                                    Feedback: {lastFrameRef.current?.rom_data?.guidance}
                                </div>}
                                <div className='w-[280px] h-[50%] bg-gray-200 flex items-center justify-center rounded border border-dashed absolute left-[20px] top-[20px]'>
                                    <video 
                                        src="https://storage.googleapis.com/fabdemo/alia/video.mp4" 
                                        autoPlay 
                                        playsInline 
                                        muted 
                                        className='object-fill absolute inset-0 w-full h-full' 
                                    />
                                     <div className='bg-white absolute flex items-center font-medium top-[10px] left-[10px] text-txtMain p-2 rounded-tl-[14px] rounded-tr-[2px] rounded-br-[14px] rounded-bl-[2px] text-sm'>
                                        <RotateCcw size={14} /> &nbsp;5 Reps
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </AnimatePresence>
    );
}