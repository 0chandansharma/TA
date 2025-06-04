import React, { useEffect, useRef } from 'react';
import './AiOrb2D.css';

export default function AiOrb2D({ isListening, isAiSpeaking, analyser, className = '' }) {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const waveformRef = useRef([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Initialize waveform points
        const initWaveform = () => {
            waveformRef.current = [];
            for (let i = 0; i < 128; i++) {
                waveformRef.current.push({
                    angle: (i / 128) * Math.PI * 2,
                    radius: 60,
                    targetRadius: 60,
                    velocity: 0
                });
            }
        };

        initWaveform();

        let time = 0;
        const audioData = new Uint8Array(128);

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            time += 0.016;

            // Get audio data if available
            let averageVolume = 0;
            if (analyser && (isListening || isAiSpeaking)) {
                try {
                    analyser.getByteFrequencyData(audioData);
                    averageVolume = audioData.reduce((sum, val) => sum + val, 0) / audioData.length / 255;
                } catch (e) {
                    // Handle error silently
                }
            }

            // Draw background glow
            drawGlow(ctx, centerX, centerY, averageVolume);

            // Draw main orb
            drawOrb(ctx, centerX, centerY, time, averageVolume);

            // Draw waveform
            if (isListening || isAiSpeaking) {
                drawWaveform(ctx, centerX, centerY, audioData);
            }

            // Draw particles
            drawParticles(ctx, centerX, centerY, time, averageVolume);

            animationRef.current = requestAnimationFrame(animate);
        };

        const drawGlow = (ctx, x, y, volume) => {
            const glowRadius = 150 + volume * 50;
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);

            if (isAiSpeaking) {
                // Blue glow for AI speaking
                gradient.addColorStop(0, 'rgba(0, 122, 255, 0.4)');
                gradient.addColorStop(0.5, 'rgba(0, 122, 255, 0.2)');
                gradient.addColorStop(1, 'rgba(0, 122, 255, 0)');
            } else if (isListening) {
                // Purple glow for listening
                gradient.addColorStop(0, 'rgba(147, 51, 234, 0.4)');
                gradient.addColorStop(0.5, 'rgba(147, 51, 234, 0.2)');
                gradient.addColorStop(1, 'rgba(147, 51, 234, 0)');
            } else {
                // White glow for idle
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
                gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            }

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        };

        const drawOrb = (ctx, x, y, time, volume) => {
            // Breathing effect
            const breathingScale = 1 + Math.sin(time * 2) * 0.05;
            const baseRadius = 50 * breathingScale;
            const radius = baseRadius + volume * 20;

            // Main orb gradient
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);

            if (isAiSpeaking) {
                gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
                gradient.addColorStop(0.3, 'rgba(0, 122, 255, 0.8)');
                gradient.addColorStop(1, 'rgba(0, 122, 255, 0.3)');
            } else if (isListening) {
                gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
                gradient.addColorStop(0.3, 'rgba(147, 51, 234, 0.8)');
                gradient.addColorStop(1, 'rgba(147, 51, 234, 0.3)');
            } else {
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
                gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
            }

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            // Inner core
            const coreRadius = radius * 0.4;
            const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, coreRadius);
            coreGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            coreGradient.addColorStop(1, 'rgba(255, 255, 255, 0.6)');

            ctx.beginPath();
            ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
            ctx.fillStyle = coreGradient;
            ctx.fill();
        };

        const drawWaveform = (ctx, centerX, centerY, audioData) => {
            // Update waveform points
            waveformRef.current.forEach((point, i) => {
                const audioValue = audioData[i] / 255;
                const targetRadius = 60 + audioValue * 40;
                
                // Smooth animation
                point.velocity += (targetRadius - point.radius) * 0.1;
                point.velocity *= 0.8; // Damping
                point.radius += point.velocity;
            });

            // Draw waveform
            ctx.beginPath();
            ctx.strokeStyle = isAiSpeaking ? 'rgba(0, 122, 255, 0.6)' : 'rgba(147, 51, 234, 0.6)';
            ctx.lineWidth = 2;

            waveformRef.current.forEach((point, i) => {
                const x = centerX + Math.cos(point.angle) * point.radius;
                const y = centerY + Math.sin(point.angle) * point.radius;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.closePath();
            ctx.stroke();

            // Draw waveform points
            waveformRef.current.forEach((point, i) => {
                if (i % 4 === 0) { // Draw every 4th point
                    const x = centerX + Math.cos(point.angle) * point.radius;
                    const y = centerY + Math.sin(point.angle) * point.radius;

                    ctx.beginPath();
                    ctx.arc(x, y, 2, 0, Math.PI * 2);
                    ctx.fillStyle = isAiSpeaking ? 'rgba(0, 122, 255, 0.8)' : 'rgba(147, 51, 234, 0.8)';
                    ctx.fill();
                }
            });
        };

        const drawParticles = (ctx, centerX, centerY, time, volume) => {
            const particleCount = 20;
            const maxRadius = 120 + volume * 30;

            for (let i = 0; i < particleCount; i++) {
                const angle = (i / particleCount) * Math.PI * 2 + time * 0.5;
                const radius = maxRadius + Math.sin(time * 2 + i) * 20;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                
                const opacity = (isListening || isAiSpeaking) ? 0.6 : 0.2;
                const size = 2 + Math.sin(time * 3 + i) * 1;

                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                
                if (isAiSpeaking) {
                    ctx.fillStyle = `rgba(0, 122, 255, ${opacity})`;
                } else if (isListening) {
                    ctx.fillStyle = `rgba(236, 72, 153, ${opacity})`;
                } else {
                    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                }
                
                ctx.fill();
            }
        };

        animate();

        // Cleanup
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isListening, isAiSpeaking, analyser]);

    return (
        <div className={`ai-orb-2d-container ${className}`}>
            <canvas 
                ref={canvasRef} 
                width={300} 
                height={300} 
                className="ai-orb-2d-canvas"
            />
            <div className="ai-orb-2d-status">
                <span className={`status-indicator ${isAiSpeaking ? 'ai-speaking' : isListening ? 'user-speaking' : 'idle'}`}>
                    <span className="status-dot"></span>
                    <span className="status-text">
                        {isAiSpeaking ? 'AI Speaking' : isListening ? 'Listening...' : 'Ready'}
                    </span>
                </span>
            </div>
        </div>
    );
}