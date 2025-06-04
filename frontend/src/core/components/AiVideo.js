import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from "motion/react";
import * as poseDetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs";
import * as tf from "@tensorflow/tfjs";

export default function AiVideo(props) {
    const localStreamRef = useRef();
    const canvasRef = useRef(null);
    const [timer, setTimer] = useState(5);

    // Function to capture frame and convert to base64
    const captureFrame = () => {
        if (localStreamRef.current && localStreamRef.current.videoWidth > 0) {
            const canvas = document.createElement('canvas');
            canvas.width = localStreamRef.current.videoWidth;
            canvas.height = localStreamRef.current.videoHeight;
            
            const ctx = canvas.getContext('2d');
            // Draw the current video frame to the canvas
            ctx.drawImage(localStreamRef.current, 0, 0, canvas.width, canvas.height);
            
            // Convert the canvas to base64
            const base64Image = canvas.toDataURL('image/jpeg');
            return base64Image;
        }
        return null;
    };

    const init = async () => {
        try {
            await tf.ready();
            await tf.setBackend("webgl");
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }, 
                audio: false 
            });
            
            if (localStreamRef.current) {
                localStreamRef.current.srcObject = stream;
                
                // Wait for video to be ready before starting pose detection
                localStreamRef.current.onloadedmetadata = () => {
                    detectPose();
                };
            }
        } catch (error) {
            console.error("Error accessing camera:", error);
        }
    };

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
                        
                        // Set canvas dimensions to match video
                        canvasRef.current.width = localStreamRef.current.videoWidth;
                        canvasRef.current.height = localStreamRef.current.videoHeight;
                        
                        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

                        poses.forEach((pose) => {
                            pose.keypoints.forEach((keypoint) => {
                                if (keypoint.score > 0.3) {
                                    const { x, y } = keypoint;
                                    ctx.beginPath();
                                    ctx.arc(x, y, 5, 0, 2 * Math.PI);
                                    ctx.fillStyle = "red";
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

    const onTimerEnd = () => {
        // Capture the last frame before ending
        const lastFrame = captureFrame();
        
        // Stop all tracks of the stream
        if (localStreamRef.current && localStreamRef.current.srcObject) {
            const tracks = localStreamRef.current.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            localStreamRef.current.srcObject = null;
        }
        
        console.log("Captured frame for pain location");
        
        // Call the parent's next function with the captured image
        if (props.next && lastFrame) {
            props.next(lastFrame);
        }
    };

    // Stop camera function
    const stopCamera = () => {
        if (localStreamRef.current && localStreamRef.current.srcObject) {
            const tracks = localStreamRef.current.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            localStreamRef.current.srcObject = null;
        }
    };

    useEffect(() => {
        if (parseInt(props.step) === 8) {
            init();
        }
        
        return () => {
            stopCamera();
        };
    }, [props.step]);

    useEffect(() => {
        if (parseInt(props.step) === 8) {
            const interval = setInterval(() => {
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
                            <div className='bg-white absolute top-[10px] left-[10px] text-txtMain p-2 rounded-tl-[14px] rounded-tr-[2px] rounded-br-[14px] rounded-bl-[2px] text-sm'>
                                Timer: {timer}s
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}