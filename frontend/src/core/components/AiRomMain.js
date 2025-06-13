import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import Constent from '../services/models/AppConstent';

const VIDEO_DURATION = 5; // Changed from 500 to 5 seconds

export default function AiRomMain(props) {
    const localStreamRef = useRef();
    const lastFrameRef = useRef(null);
    const canvasRef = useRef(null);
    const wsRef = useRef(null);
    const [timer, setTimer] = useState(VIDEO_DURATION);
    const [lastFrame, setLastFrame] = useState(null);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const intervalRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const connectionTimeoutRef = useRef(null);
    const [wsStatus, setWsStatus] = useState('disconnected');
    const [error, setError] = useState(null);
    const hasInitializedRef = useRef(false);

    // Initialize WebSocket and Media Stream
    const init = async () => {
        console.log('🎬 [ROM] Initializing ROM phase');
        
        // Prevent double initialization
        if (hasInitializedRef.current) {
            console.log('⚠️ [ROM] Already initialized, skipping');
            return;
        }
        hasInitializedRef.current = true;

        try {
            // Get user media stream
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    aspectRatio: 16/9
                }, 
                audio: false // We don't need audio for ROM
            });
            
            if (localStreamRef.current) {
                localStreamRef.current.srcObject = stream;
                console.log('✅ [ROM] Camera stream initialized');

                // Wait for video to be ready
                localStreamRef.current.onloadedmetadata = () => {
                    console.log('✅ [ROM] Video metadata loaded');
                    setIsVideoReady(true);
                    initializeWebSocket();
                };
            }

        } catch (error) {
            console.error("❌ [ROM] Error initializing camera:", error);
            setError("Camera access denied. Please allow camera access and refresh.");
            setWsStatus('error');
        }
    };

    // Initialize WebSocket connection
    const initializeWebSocket = () => {
        console.log('🔌 [ROM] Initializing WebSocket connection');
        
        try {
            wsRef.current = new WebSocket(Constent.WS_URL);
            
            wsRef.current.onopen = () => {
                console.log('✅ [ROM] WebSocket Connected');
                setWsStatus('connected');
                setError(null);
                
                // Clear connection timeout
                if (connectionTimeoutRef.current) {
                    clearTimeout(connectionTimeoutRef.current);
                }
                
                // Start streaming after a short delay
                setTimeout(() => {
                    if (isVideoReady) {
                        startStreaming();
                    }
                }, 500);
            };

            wsRef.current.onclose = (event) => {
                console.log("🔌 [ROM] WebSocket closed:", event.code, event.reason);
                setWsStatus('disconnected');
                stopStreaming();
            };

            wsRef.current.onmessage = (event) => {
                try {
                    if (event.data && event.data !== 'pong') {
                        const data = JSON.parse(event.data);
                        console.log('📥 [ROM] Received data:', data);
                        
                        if (data.rom_data) {
                            lastFrameRef.current = data;
                            setLastFrame(data);
                            setWsStatus('receiving');
                        }
                    }
                } catch (error) {
                    console.error('❌ [ROM] Error parsing WebSocket message:', error);
                }
            };

            wsRef.current.onerror = (error) => {
                console.error('❌ [ROM] WebSocket Error:', error);
                setWsStatus('error');
                setError('Connection error. Please check your internet connection.');
            };

            // Set connection timeout
            connectionTimeoutRef.current = setTimeout(() => {
                if (wsRef.current?.readyState !== WebSocket.OPEN) {
                    console.error('❌ [ROM] WebSocket connection timeout');
                    setError('Connection timeout. Please try again.');
                    handleError();
                }
            }, 10000); // 10 second timeout

        } catch (error) {
            console.error('❌ [ROM] Error creating WebSocket:', error);
            setError('Failed to connect to server.');
            handleError();
        }
    };

    // Stream video frames to WebSocket
    const startStreaming = () => {
        console.log('📹 [ROM] Starting video streaming');
        
        if (!wsRef.current || !localStreamRef.current) {
            console.error('❌ [ROM] Cannot start streaming - missing WebSocket or video');
            return;
        }

        const canvas = document.createElement('canvas');
        const video = localStreamRef.current;
        
        // Set canvas size to match video
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');

        const sendFrame = () => {
            try {
                if (wsRef.current?.readyState === WebSocket.OPEN && 
                    video.readyState === video.HAVE_ENOUGH_DATA) {
                    
                    // Draw the current video frame to canvas
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    // Convert to base64 and send
                    const base64Image = canvas.toDataURL("image/jpeg", 0.7); // Reduced quality for performance
                    wsRef.current.send(base64Image);
                }
            } catch (error) {
                console.error('❌ [ROM] Error capturing/sending frame:', error);
            }
        };

        // Clear any existing interval
        stopStreaming();
        
        // Start new interval - reduced frequency for better performance
        intervalRef.current = setInterval(sendFrame, 200); // Send 5 frames per second
        console.log('✅ [ROM] Streaming started');
    };

    // Stop streaming
    const stopStreaming = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
            console.log('🛑 [ROM] Streaming stopped');
        }
    };

    // Handle errors
    const handleError = () => {
        stopStreaming();
        
        // Clean up
        if (wsRef.current) {
            wsRef.current.close();
        }
        if (localStreamRef.current?.srcObject) {
            localStreamRef.current.srcObject.getTracks().forEach(track => track.stop());
        }
        
        // Move to next step after delay
        setTimeout(() => {
            props.next();
        }, 3000);
    };

    // Handle timer end and cleanup
    const onTimerEnd = async () => {
        console.log('⏱️ [ROM] Timer ended, processing results');
        
        try {
            // Stop streaming
            stopStreaming();
            setIsVideoReady(false);
            
            // Process last frame data
            if (lastFrameRef.current?.rom_data) {
                console.log('📊 [ROM] Processing ROM data:', lastFrameRef.current.rom_data);
                
                const requestBody = {
                    rangeOfMotion: {
                        minimum: lastFrameRef.current.rom_data.ROM?.[0] || 0,
                        maximum: lastFrameRef.current.rom_data.ROM?.[1] || 0
                    }
                };
                
                // Save ROM data
                if (props.saveRomData) {
                    await props.saveRomData(requestBody);
                    console.log('✅ [ROM] ROM data saved');
                }
            } else {
                console.warn('⚠️ [ROM] No ROM data to save');
                
                // Send default values if no data received
                const defaultData = {
                    rangeOfMotion: {
                        minimum: 0,
                        maximum: 0
                    }
                };
                
                if (props.saveRomData) {
                    await props.saveRomData(defaultData);
                }
            }

            // Cleanup
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            
            if (localStreamRef.current?.srcObject) {
                localStreamRef.current.srcObject.getTracks().forEach(track => track.stop());
                localStreamRef.current.srcObject = null;
            }

            // Move to next step
            console.log('➡️ [ROM] Moving to next step');
            props.next();
            
        } catch (error) {
            console.error('❌ [ROM] Error in timer end handling:', error);
            // Move to next step even if there's an error
            props.next();
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

        const statusText = {
            disconnected: 'Connecting...',
            connected: 'Connected',
            receiving: 'Analyzing',
            error: 'Connection Error'
        };

        return (
            <div className='absolute top-[10px] left-[10px] flex items-center space-x-2 bg-white/90 backdrop-blur p-2 rounded-lg shadow-md'>
                <div className={`w-3 h-3 rounded-full ${statusStyles[wsStatus]} ${wsStatus === 'receiving' ? 'animate-pulse' : ''}`}></div>
                <span className='text-sm font-medium'>{statusText[wsStatus]}</span>
            </div>
        );
    };

    // Timer countdown effect
    useEffect(() => {
        if (parseInt(props.step) === 21 && !timerIntervalRef.current) {
            console.log('⏱️ [ROM] Starting timer countdown');
            
            timerIntervalRef.current = setInterval(() => {
                setTimer((prev) => {
                    if (prev <= 1) {
                        clearInterval(timerIntervalRef.current);
                        timerIntervalRef.current = null;
                        onTimerEnd();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
        };
    }, [props.step]);

    // Initialize when reaching step 21
    useEffect(() => {
        console.log('🔄 [ROM] Step changed to:', props.step);
        
        if (parseInt(props.step) === 21) {
            console.log('🚀 [ROM] Step 21 reached, initializing ROM phase');
            init();
        }

        // Cleanup on unmount or when leaving ROM phase
        return () => {
            if (parseInt(props.step) !== 21) {
                console.log('🧹 [ROM] Cleaning up ROM phase');
                
                hasInitializedRef.current = false;
                stopStreaming();
                
                if (timerIntervalRef.current) {
                    clearInterval(timerIntervalRef.current);
                    timerIntervalRef.current = null;
                }
                
                if (connectionTimeoutRef.current) {
                    clearTimeout(connectionTimeoutRef.current);
                    connectionTimeoutRef.current = null;
                }
                
                if (wsRef.current) {
                    wsRef.current.close();
                    wsRef.current = null;
                }
                
                if (localStreamRef.current?.srcObject) {
                    localStreamRef.current.srcObject.getTracks().forEach(track => track.stop());
                    localStreamRef.current.srcObject = null;
                }
            }
        };
    }, [props.step]);

    return (
        <AnimatePresence initial={false}>
            {(parseInt(props.step) >= 21 && parseInt(props.step) < 24) && (
                <motion.div 
                    initial={{ opacity: 0, translateY: '300px' }} 
                    animate={{ opacity: 1, translateY: 0 }} 
                    exit={{ opacity: 0, translateY: '300px' }} 
                    className='w-full h-screen flex items-center justify-center relative bg-prime/20'
                >
                    <div className='w-full h-full relative'>
                        <div className='w-full h-full border-[6px] border-primeLight overflow-hidden relative'>
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
                            
                            {/* WebSocket Status */}
                            {renderWebSocketStatus()}
                            
                            {/* Timer */}
                            <div className='bg-white absolute top-[10px] right-[10px] text-txtMain p-3 rounded-tl-[14px] rounded-tr-[2px] rounded-br-[14px] rounded-bl-[2px] text-lg font-medium shadow-md'>
                                <div className='text-2xl font-bold'>{timer}s</div>
                                <div className='text-xs text-gray-500'>Remaining</div>
                            </div>
                            
                            {/* Error Message */}
                            {error && (
                                <div className='bg-red-500/90 text-white absolute top-[80px] left-1/2 -translate-x-1/2 p-3 rounded-lg shadow-lg'>
                                    {error}
                                </div>
                            )}
                            
                            {/* Feedback Display */}
                            {lastFrameRef.current?.rom_data?.guidance && (
                                <div className='bg-white/90 backdrop-blur absolute bottom-[20px] left-1/2 -translate-x-1/2 text-txtMain p-4 px-8 rounded-lg shadow-lg'>
                                    <div className='text-2xl font-medium text-blue-600'>
                                        {lastFrameRef.current.rom_data.guidance}
                                    </div>
                                    {lastFrameRef.current.rom_data.ROM && (
                                        <div className='text-sm text-gray-600 mt-1'>
                                            Range: {lastFrameRef.current.rom_data.ROM[0]}° - {lastFrameRef.current.rom_data.ROM[1]}°
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {/* Reference Video */}
                            <div className='w-[280px] h-[50%] bg-gray-200/80 backdrop-blur flex items-center justify-center rounded-lg border-2 border-white/50 absolute left-[20px] top-[80px] shadow-xl overflow-hidden'>
                                <video 
                                    src="https://storage.googleapis.com/fabdemo/alia/video.mp4" 
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    loop
                                    className='object-cover absolute inset-0 w-full h-full' 
                                />
                                <div className='bg-white/90 backdrop-blur absolute flex items-center font-medium top-[10px] left-[10px] text-txtMain p-2 rounded-tl-[14px] rounded-tr-[2px] rounded-br-[14px] rounded-bl-[2px] text-sm shadow-md'>
                                    <RotateCcw size={14} /> &nbsp;5 Reps
                                </div>
                                <div className='absolute bottom-[10px] left-[10px] right-[10px] bg-white/90 backdrop-blur p-2 rounded-lg text-xs text-gray-700'>
                                    Follow the reference video
                                </div>
                            </div>
                            
                            {/* Instructions */}
                            {!error && (
                                <div className='absolute bottom-[80px] left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur text-white p-4 rounded-lg text-center max-w-md'>
                                    <p className='text-lg font-medium'>Range of Motion Analysis</p>
                                    <p className='text-sm mt-1'>Please follow the movement shown in the reference video</p>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}