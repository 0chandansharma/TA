import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from "motion/react";
import * as poseDetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs";
import * as tf from "@tensorflow/tfjs";

export default function AiVideo(props) {
    const localStreamRef = useRef();
    const canvasRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const [timer, setTimer] = useState(5);
    const [isRecording, setIsRecording] = useState(false);
    const recordingTimeoutRef = useRef(null);

    // Function to start recording 5-second video
    const startRecording = () => {
        console.log('=== STARTING VIDEO RECORDING ===');
        if (localStreamRef.current?.srcObject && !isRecording) {
            try {
                // Clear previous chunks
                recordedChunksRef.current = [];
                
                // Create media recorder with video stream
                const mediaRecorder = new MediaRecorder(localStreamRef.current.srcObject, {
                    mimeType: 'video/webm;codecs=vp9,opus'
                });
                
                mediaRecorderRef.current = mediaRecorder;
                setIsRecording(true);
                console.log('Recording started, mediaRecorder state:', mediaRecorder.state);

                // Handle data available event
                mediaRecorder.ondataavailable = (event) => {
                    console.log('Data available:', event.data.size, 'bytes');
                    if (event.data && event.data.size > 0) {
                        recordedChunksRef.current.push(event.data);
                    }
                };

                // Handle stop event
                mediaRecorder.onstop = () => {
                    console.log('=== RECORDING STOPPED EVENT ===');
                    console.log('Recording stopped, chunks:', recordedChunksRef.current.length);
                    setIsRecording(false);
                    
                    const videoBlob = new Blob(recordedChunksRef.current, {
                        type: 'video/webm'
                    });
                    
                    console.log('Video blob created, size:', videoBlob.size, 'bytes');
                    
                    if (videoBlob.size > 0) {
                        convertToBase64(videoBlob);
                    } else {
                        console.error('No video data recorded, using fallback');
                        captureFrame();
                    }
                };

                // Handle errors
                mediaRecorder.onerror = (event) => {
                    console.error('MediaRecorder error:', event.error);
                    setIsRecording(false);
                    captureFrame();
                };

                // Start recording WITHOUT timeslice parameter
                mediaRecorder.start();
                console.log('MediaRecorder.start() called without timeslice');

                // Set a timeout to stop recording after 5 seconds
                recordingTimeoutRef.current = setTimeout(() => {
                    console.log('=== 5 SECOND TIMEOUT - STOPPING RECORDING ===');
                    if (mediaRecorder.state === 'recording') {
                        mediaRecorder.stop();
                        console.log('MediaRecorder.stop() called by timeout');
                    }
                }, 5000);

            } catch (error) {
                console.error('Error starting video recording:', error);
                setIsRecording(false);
                captureFrame();
            }
        } else {
            console.error('Cannot start recording:', {
                hasStream: !!localStreamRef.current?.srcObject,
                isRecording: isRecording
            });
        }
    };

    // Function to stop recording
    const stopRecording = () => {
        console.log('=== MANUAL STOP RECORDING ===');
        
        // Clear the timeout
        if (recordingTimeoutRef.current) {
            clearTimeout(recordingTimeoutRef.current);
            recordingTimeoutRef.current = null;
        }
        
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            try {
                mediaRecorderRef.current.stop();
                console.log('MediaRecorder.stop() called manually');
            } catch (error) {
                console.error('Error stopping recording:', error);
                setIsRecording(false);
            }
        } else {
            console.log('Cannot stop recording:', {
                hasRecorder: !!mediaRecorderRef.current,
                recorderState: mediaRecorderRef.current?.state,
                isRecording: isRecording
            });
            
            // If we have chunks but recording stopped automatically, process them
            if (recordedChunksRef.current.length > 0) {
                console.log('Processing existing chunks');
                const videoBlob = new Blob(recordedChunksRef.current, {
                    type: 'video/webm'
                });
                convertToBase64(videoBlob);
            }
        }
    };

    // Convert video blob to base64
    const convertToBase64 = (videoBlob) => {
        console.log('=== CONVERTING VIDEO TO BASE64 ===');
        console.log('Video blob size:', videoBlob.size, 'bytes');
        
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Video = reader.result;
            console.log('Video converted to base64, length:', base64Video.length);
            console.log('Base64 starts with:', base64Video.substring(0, 100) + '...');
            
            // Stop camera
            stopCamera();
            
            // Send to parent component
            if (props.next && base64Video) {
                console.log('Calling props.next with video');
                props.next(base64Video);
            } else {
                console.error('Cannot send video:', {
                    hasNext: !!props.next,
                    hasVideo: !!base64Video
                });
            }
        };
        
        reader.onerror = () => {
            console.error('Error converting video to base64');
            captureFrame();
        };
        
        reader.readAsDataURL(videoBlob);
    };

    // Fallback: Capture single frame if video recording fails
    const captureFrame = () => {
        console.log('=== FALLBACK: CAPTURING SINGLE FRAME ===');
        if (localStreamRef.current && localStreamRef.current.videoWidth > 0) {
            const canvas = document.createElement('canvas');
            canvas.width = localStreamRef.current.videoWidth;
            canvas.height = localStreamRef.current.videoHeight;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(localStreamRef.current, 0, 0, canvas.width, canvas.height);
            
            const base64Image = canvas.toDataURL('image/jpeg');
            console.log('Fallback frame captured, length:', base64Image.length);
            
            stopCamera();
            
            if (props.next && base64Image) {
                console.log('Calling props.next with fallback image');
                props.next(base64Image);
            }
        } else {
            console.error('Cannot capture frame - video not ready');
        }
    };

    // Initialize camera and pose detection
    const init = async () => {
        console.log('=== INITIALIZING CAMERA ===');
        try {
            await tf.ready();
            await tf.setBackend("webgl");
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }, 
                audio: true
            });
            
            console.log('Camera stream obtained:', stream.getTracks().length, 'tracks');
            
            if (localStreamRef.current) {
                localStreamRef.current.srcObject = stream;
                
                localStreamRef.current.onloadedmetadata = () => {
                    console.log('Video metadata loaded, starting pose detection');
                    detectPose();
                    setTimeout(() => {
                        console.log('Starting recording after delay');
                        startRecording();
                    }, 500);
                };
            }
        } catch (error) {
            console.error("Error accessing camera:", error);
        }
    };

    // Pose detection for visual feedback
    const detectPose = async () => {
        try {
            const detector = await poseDetection.createDetector(
                poseDetection.SupportedModels.MoveNet
            );

            const detect = async () => {
                if (localStreamRef.current && localStreamRef.current.readyState === 4 && detector) {
                    const poses = await detector.estimatePoses(localStreamRef.current);

                    if (canvasRef.current) {
                        const ctx = canvasRef.current.getContext("2d");
                        
                        canvasRef.current.width = localStreamRef.current.videoWidth;
                        canvasRef.current.height = localStreamRef.current.videoHeight;
                        
                        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

                        poses.forEach((pose) => {
                            pose.keypoints.forEach((keypoint) => {
                                if (keypoint.score > 0.3) {
                                    const { x, y } = keypoint;
                                    ctx.beginPath();
                                    ctx.arc(x, y, 5, 0, 2 * Math.PI);
                                    ctx.fillStyle = isRecording ? "red" : "blue";
                                    ctx.fill();
                                }
                            });
                        });
                    }
                }
                
                if (parseInt(props.step) === 8) {
                    requestAnimationFrame(detect);
                }
            };

            detect();
        } catch (error) {
            console.error("Error in pose detection:", error);
        }
    };

    // Handle timer end
    const onTimerEnd = () => {
        console.log('=== TIMER ENDED ===');
        stopRecording();
    };

    // Stop camera function
    const stopCamera = () => {
        console.log('=== STOPPING CAMERA ===');
        if (localStreamRef.current && localStreamRef.current.srcObject) {
            const tracks = localStreamRef.current.srcObject.getTracks();
            tracks.forEach(track => {
                console.log('Stopping track:', track.kind);
                track.stop();
            });
            localStreamRef.current.srcObject = null;
        }
    };

    // Initialize when step changes to 8
    useEffect(() => {
        console.log('=== STEP CHANGED TO:', props.step, '===');
        if (parseInt(props.step) === 8) {
            init();
        }
        
        return () => {
            console.log('=== CLEANUP ===');
            if (recordingTimeoutRef.current) {
                clearTimeout(recordingTimeoutRef.current);
            }
            stopRecording();
            stopCamera();
        };
    }, [props.step]);

    // Timer countdown effect
    useEffect(() => {
        if (parseInt(props.step) === 8) {
            console.log('=== STARTING TIMER ===');
            const interval = setInterval(() => {
                setTimer((prev) => {
                    console.log('Timer:', prev - 1);
                    if (prev <= 1) {
                        clearInterval(interval);
                        onTimerEnd();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            
            return () => {
                console.log('=== CLEARING TIMER ===');
                clearInterval(interval);
            };
        }
    }, [props.step]);

    return (
        <AnimatePresence initial={false}>
            {parseInt(props.step) === 8 && (
                <motion.div 
                    initial={{ opacity: 0, translateY: '300px' }} 
                    animate={{ opacity: 1, translateY: 0 }} 
                    exit={{ opacity: 0, translateY: '300px' }} 
                    className='w-full h-screen flex items-center justify-center relative'
                >
                    <div className='w-[60%]'>
                        <div className='w-full pt-[56.25%] relative border-[6px] border-primeLight rounded-[20px] overflow-hidden'>
                            <video 
                                ref={localStreamRef} 
                                autoPlay 
                                playsInline 
                                muted 
                                className='object-fill absolute inset-0 w-full h-full' 
                            />
                            <canvas 
                                ref={canvasRef} 
                                className='w-full h-full absolute top-0 left-0 pointer-events-none' 
                            />
                            
                            {/* Timer Display */}
                            <div className='bg-white absolute top-[10px] left-[10px] text-txtMain p-2 rounded-tl-[14px] rounded-tr-[2px] rounded-br-[14px] rounded-bl-[2px] text-sm'>
                                Timer: {timer}s
                            </div>
                            
                            {/* Recording Indicator */}
                            {isRecording && (
                                <div className='bg-red-500 absolute top-[10px] right-[10px] text-white p-2 rounded-full flex items-center'>
                                    <div className='w-3 h-3 bg-white rounded-full mr-2 animate-pulse'></div>
                                    Recording
                                </div>
                            )}
                            
                            {/* Debug Info */}
                            <div className='bg-blue-500/80 absolute top-[60px] left-[10px] text-white p-2 rounded text-xs'>
                                <div>Chunks: {recordedChunksRef.current.length}</div>
                                <div>Recording: {isRecording ? 'Yes' : 'No'}</div>
                                <div>State: {mediaRecorderRef.current?.state || 'None'}</div>
                            </div>
                            
                            {/* Instructions */}
                            <div className='bg-black/70 absolute bottom-[10px] left-1/2 transform -translate-x-1/2 text-white p-3 rounded-lg text-center'>
                                <p className='text-sm'>Please show me where your pain is located</p>
                                <p className='text-xs mt-1'>Recording {timer > 0 ? `${6-timer}/5` : '5/5'} seconds</p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}