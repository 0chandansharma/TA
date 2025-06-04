import { Canvas, useFrame } from '@react-three/fiber';
import React, { Suspense, useMemo, useRef, useState, useEffect } from 'react';
import { Color, IcosahedronGeometry, MeshDepthMaterial, MeshPhysicalMaterial, RGBADepthPacking } from 'three';
import CustomShaderMaterial from 'three-custom-shader-material';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { useMediaQuery } from 'usehooks-ts';

const AiOrbGeometry = ({ shouldReduceQuality, isMobile, analyser, isListening, isAiSpeaking }) => {
    const materialRef = useRef(null);
    const depthMaterialRef = useRef(null);
    const meshRef = useRef(null);
    
    // Animation states
    const [pulseIntensity, setPulseIntensity] = useState(0);
    const [colorTransition, setColorTransition] = useState(0);

    const vertexShader = `
    attribute vec4 tangent;

    varying float vPattern;
    varying float vAudioIntensity;

    uniform float uTime;
    uniform float uSpeed;
    uniform float uNoiseStrength;
    uniform float uDisplacementStrength;
    uniform float uFractAmount;
    uniform float uAudioReactivity;
    uniform float uPulseIntensity;

    //	Classic Perlin 3D Noise 
    //	by Stefan Gustavson (https://github.com/stegu/webgl-noise)
    //
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
    vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

    float cnoise(vec3 P){
    vec3 Pi0 = floor(P); // Integer part for indexing
    vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
    Pi0 = mod(Pi0, 289.0);
    Pi1 = mod(Pi1, 289.0);
    vec3 Pf0 = fract(P); // Fractional part for interpolation
    vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz;
    vec4 iz1 = Pi1.zzzz;

    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);

    vec4 gx0 = ixy0 / 7.0;
    vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);

    vec4 gx1 = ixy1 / 7.0;
    vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);

    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
    g000 *= norm0.x;
    g010 *= norm0.y;
    g100 *= norm0.z;
    g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
    g001 *= norm1.x;
    g011 *= norm1.y;
    g101 *= norm1.z;
    g111 *= norm1.w;

    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
    float n111 = dot(g111, Pf1);

    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
    return 2.2 * n_xyz;
    }

    float smoothMod(float axis, float amp, float rad) {
        float top = cos(PI * (axis / amp)) * sin(PI * (axis / amp));
        float bottom = pow(sin(PI * (axis / amp)), 2.0) + pow(rad, 2.0);
        float at = atan(top / bottom);
        return amp * (1.0 / 2.0) - (1.0 / PI) * at;
    }

    float getDisplacement(vec3 position) {
        vec3 pos = position;
        pos.y -= uTime * 0.05 * uSpeed;
        
        // Add pulse effect
        float pulse = sin(uTime * 3.0) * uPulseIntensity * 0.1;
        
        // Add audio reactivity
        pos += cnoise(pos * 1.65) * (uNoiseStrength + uAudioReactivity * 0.5);

        return (smoothMod(pos.y * uFractAmount, 1., 1.5) + pulse) * uDisplacementStrength;
    }    

    void main() {
        vec3 biTangent = cross(csm_Normal, tangent.xyz);
        float shift = 0.01;
        vec3 posA = csm_Position + tangent.xyz * shift;
        vec3 posB = csm_Position + biTangent * shift;

        float pattern = getDisplacement(csm_Position);
        vPattern = pattern;
        vAudioIntensity = uAudioReactivity;

        csm_Position += csm_Normal * pattern;
        posA += csm_Normal * getDisplacement(posA);
        posB += csm_Normal * getDisplacement(posB);

        vec3 toA = normalize(posA - csm_Position);
        vec3 toB = normalize(posB - csm_Position);

        csm_Normal = normalize(cross(toA, toB));
    }    
    `;

    const fragmentShader = `
    varying float vPattern;
    varying float vAudioIntensity;

    uniform vec3 uColorIdle;
    uniform vec3 uColorListening;
    uniform vec3 uColorSpeaking;
    uniform float uColorMix;
    uniform float uGlowIntensity;
    uniform float uTime;

    void main() {
        // Mix colors based on state
        vec3 targetColor = uColorIdle;
        
        if (uColorMix > 0.5) {
            targetColor = mix(uColorListening, uColorSpeaking, (uColorMix - 0.5) * 2.0);
        } else {
            targetColor = mix(uColorIdle, uColorListening, uColorMix * 2.0);
        }
        
        // Enhanced glow effect with listening boost
        float glow = sin(uTime * 2.0) * 0.2 + 0.8;
        if (uColorMix > 0.0 && uColorMix < 0.6) { // Listening state
            glow += sin(uTime * 6.0) * 0.4; // Faster pulsing when listening
        }
        vec3 color = vPattern * targetColor * (1.0 + uGlowIntensity * glow);
        
        // Enhanced audio reactive brightness
        color += vAudioIntensity * 0.5;
        
        // Extra shimmer effect when listening
        if (uColorMix > 0.0 && uColorMix < 0.6) {
            float shimmer = sin(uTime * 8.0 + vPattern * 10.0) * 0.3;
            color += shimmer * targetColor * 0.4;
        }

        csm_DiffuseColor = vec4(color, 1.);
        
        // Add emissive for glow effect
        csm_Emissive = color * uGlowIntensity * 0.5;
    }
    `;

    // Smooth transitions for state changes with enhanced listening feedback
    useEffect(() => {
        const targetIntensity = isListening ? 1.2 : (isAiSpeaking ? 1.0 : 0.0); // Increased for listening
        const interval = setInterval(() => {
            setPulseIntensity(prev => {
                const diff = targetIntensity - prev;
                return Math.abs(diff) < 0.01 ? targetIntensity : prev + diff * 0.15; // Faster transition
            });
        }, 16);
        
        return () => clearInterval(interval);
    }, [isListening, isAiSpeaking]);

    // Color transition based on state
    useEffect(() => {
        const targetColor = isAiSpeaking ? 1.0 : (isListening ? 0.5 : 0.0);
        const interval = setInterval(() => {
            setColorTransition(prev => {
                const diff = targetColor - prev;
                return Math.abs(diff) < 0.01 ? targetColor : prev + diff * 0.1;
            });
        }, 16);
        
        return () => clearInterval(interval);
    }, [isListening, isAiSpeaking]);

    useFrame(({ clock }) => {
        const elapsedTime = clock.getElapsedTime();
        
        // Store clock reference for use in JSX
        window.orbClock = clock;
        
        // Enhanced rotation and movement
        if (meshRef.current) {
            // Faster rotation when listening
            const rotationSpeed = isListening ? 0.3 : (isAiSpeaking ? 0.2 : 0.1);
            meshRef.current.rotation.y = elapsedTime * rotationSpeed;
            
            // More pronounced bobbing when listening
            if (isListening) {
                meshRef.current.position.y = Math.sin(elapsedTime * 3) * 0.08;
                // Add subtle rotation wobble for listening feedback
                meshRef.current.rotation.x = Math.sin(elapsedTime * 4) * 0.05;
                meshRef.current.rotation.z = Math.cos(elapsedTime * 3.5) * 0.03;
            } else if (isAiSpeaking) {
                meshRef.current.position.y = Math.sin(elapsedTime * 2) * 0.05;
                meshRef.current.rotation.x = 0;
                meshRef.current.rotation.z = 0;
            } else {
                // Return to center when idle
                meshRef.current.position.y *= 0.95;
                meshRef.current.rotation.x *= 0.95;
                meshRef.current.rotation.z *= 0.95;
            }
        }

        let audioReactivity = 0;
        
        if (analyser && (isListening || isAiSpeaking)) {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            
            // Calculate different frequency bands
            const bass = dataArray.slice(0, 50).reduce((a, b) => a + b, 0) / 50;
            const mid = dataArray.slice(50, 200).reduce((a, b) => a + b, 0) / 150;
            const treble = dataArray.slice(200, 500).reduce((a, b) => a + b, 0) / 300;
            
            // Weight different frequencies
            const weightedAverage = (bass * 0.5 + mid * 0.3 + treble * 0.2) / 128;
            audioReactivity = weightedAverage;
            
            if (materialRef.current) {
                // Smooth audio reactivity
                materialRef.current.uniforms.uAudioReactivity.value += 
                    (audioReactivity - materialRef.current.uniforms.uAudioReactivity.value) * 0.3;
                
                // Modify animation based on audio
                materialRef.current.uniforms.uNoiseStrength.value = 0.90 + audioReactivity * 0.6;
                materialRef.current.uniforms.uDisplacementStrength.value = 0.48 + audioReactivity * 0.3;
                materialRef.current.uniforms.uFractAmount.value = 4 + audioReactivity * 3;
                materialRef.current.uniforms.uSpeed.value = 1.10 + audioReactivity * 0.5;
            }

            if (depthMaterialRef.current) {
                depthMaterialRef.current.uniforms.uAudioReactivity.value = materialRef.current.uniforms.uAudioReactivity.value;
                depthMaterialRef.current.uniforms.uNoiseStrength.value = materialRef.current.uniforms.uNoiseStrength.value;
                depthMaterialRef.current.uniforms.uDisplacementStrength.value = materialRef.current.uniforms.uDisplacementStrength.value;
                depthMaterialRef.current.uniforms.uFractAmount.value = materialRef.current.uniforms.uFractAmount.value;
                depthMaterialRef.current.uniforms.uSpeed.value = materialRef.current.uniforms.uSpeed.value;
            }
        } else {
            // Gradually return to idle state
            if (materialRef.current) {
                materialRef.current.uniforms.uAudioReactivity.value *= 0.95;
                materialRef.current.uniforms.uNoiseStrength.value += (0.90 - materialRef.current.uniforms.uNoiseStrength.value) * 0.1;
                materialRef.current.uniforms.uDisplacementStrength.value += (0.48 - materialRef.current.uniforms.uDisplacementStrength.value) * 0.1;
                materialRef.current.uniforms.uFractAmount.value += (4 - materialRef.current.uniforms.uFractAmount.value) * 0.1;
                materialRef.current.uniforms.uSpeed.value += (1.10 - materialRef.current.uniforms.uSpeed.value) * 0.1;
            }
        }

        // Update uniforms
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = elapsedTime;
            materialRef.current.uniforms.uPulseIntensity.value = pulseIntensity;
            materialRef.current.uniforms.uColorMix.value = colorTransition;
            materialRef.current.uniforms.uGlowIntensity.value = 
                isAiSpeaking ? 1.5 : (isListening ? 1.8 : 0.3); // Higher glow for listening
        }
        if (depthMaterialRef.current) {
            depthMaterialRef.current.uniforms.uTime.value = elapsedTime;
            depthMaterialRef.current.uniforms.uPulseIntensity.value = pulseIntensity;
        }
    });

    const geometry = useMemo(() => {
        const geometry = mergeVertices(new IcosahedronGeometry(1.3, shouldReduceQuality ? 128 : 200));
        geometry.computeTangents();
        return geometry;
    }, [shouldReduceQuality]);

    const uniforms = {
        uTime: { value: 0 },
        uColorIdle: { value: new Color('#ffeffe') },
        uColorListening: { value: new Color('#ff69b4') }, // Hot pink for listening - more vibrant
        uColorSpeaking: { value: new Color('#00bfff') }, // Deeper sky blue for AI speaking
        uColorMix: { value: 0 },
        uGlowIntensity: { value: 0.3 },
        uGradientStrength: { value: 3 },
        uSpeed: { value: 1.10 },
        uNoiseStrength: { value: 0.90 },
        uDisplacementStrength: { value: 0.48 },
        uFractAmount: { value: 4 },
        uAudioReactivity: { value: 0 },
        uPulseIntensity: { value: 0 },
    };

    return (
        <>
            <mesh 
                ref={meshRef}
                geometry={geometry} 
                frustumCulled={false} 
                position={[0, isMobile ? -1.3 * 0 : 0, 0]}
                scale={isListening ? 1.15 : (isAiSpeaking ? 1.1 : 1)} // Slightly larger when listening
            >
                <CustomShaderMaterial 
                    ref={materialRef} 
                    baseMaterial={MeshPhysicalMaterial} 
                    vertexShader={vertexShader} 
                    fragmentShader={fragmentShader} 
                    silent 
                    roughness={0.54} 
                    metalness={0.52} 
                    reflectivity={0.74} 
                    clearcoat={0} 
                    ior={0.29} 
                    iridescence={1} 
                    uniforms={uniforms}
                    transparent={true}
                    opacity={0.9}
                />
                <CustomShaderMaterial 
                    ref={depthMaterialRef} 
                    baseMaterial={MeshDepthMaterial} 
                    vertexShader={vertexShader} 
                    uniforms={uniforms} 
                    silent 
                    depthPacking={RGBADepthPacking} 
                    attach="customDepthMaterial" 
                />
            </mesh>
            
            {/* Enhanced dynamic lighting */}
            <ambientLight 
                color={isAiSpeaking ? "#00bfff" : (isListening ? "#ff69b4" : "#0079ff")} 
                intensity={isListening ? 6 : (isAiSpeaking ? 5 : 4)} 
            />
            <directionalLight 
                color={isAiSpeaking ? "#87ceeb" : (isListening ? "#ff1493" : "#c4fff8")} 
                intensity={isListening ? 7 : (isAiSpeaking ? 6 : 5)} 
                position={[-0.33, 2, 3.50]} 
            />
            
            {/* Enhanced point light for extra glow when active */}
            {(isListening || isAiSpeaking) && (
                <pointLight 
                    color={isAiSpeaking ? "#00bfff" : "#ff69b4"} 
                    intensity={isListening ? 3 : 2} 
                    position={[0, 0, 2]} 
                />
            )}
            
            {/* Extra pulsing light when listening for maximum visibility */}
            {isListening && (
                <pointLight 
                    color="#ff1493" 
                    intensity={2 + Math.sin((window.orbClock?.getElapsedTime() || 0) * 5) * 0.5} 
                    position={[0, 0, -2]} 
                />
            )}
        </>
    );
};

const AiOrbEnhanced = ({ analyser, isListening, isAiSpeaking, className = '' }) => {
    const isTablet = useMediaQuery('(max-width: 1199px)');
    const isMobile = useMediaQuery('(max-width: 767px)');
    
    return (
        <div className={`relative ${className}`}>
            <div className="w-[200px] h-[200px] bg-transparent relative">
                {/* Enhanced glow effect background */}
                <div 
                    className={`absolute inset-0 rounded-full transition-all duration-300 ${
                        isAiSpeaking 
                            ? 'bg-cyan-400/25 animate-pulse shadow-[0_0_80px_rgba(0,191,255,0.8)]' 
                            : isListening 
                                ? 'bg-pink-400/30 animate-pulse shadow-[0_0_100px_rgba(255,105,180,0.9)]'
                                : 'bg-white/5'
                    }`}
                />
                
                {/* Additional inner glow for listening state */}
                {isListening && (
                    <div className="absolute inset-4 rounded-full bg-pink-300/20 animate-ping" />
                )}
                
                {/* Canvas */}
                <Canvas 
                    camera={{ position: [0, 0, 5], fov: 45, near: 0.1, far: 1000 }} 
                    gl={{ alpha: true, antialias: true }} 
                    className='bg-transparent'
                >
                    <Suspense fallback={null}>
                        <AiOrbGeometry 
                            shouldReduceQuality={isTablet} 
                            isMobile={isMobile} 
                            analyser={analyser}
                            isListening={isListening}
                            isAiSpeaking={isAiSpeaking}
                        />
                    </Suspense>
                </Canvas>
            </div>
            
            {/* Enhanced status text with visual indicator */}
            <div className="absolute -bottom-10 left-0 right-0 text-center">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full transition-all duration-300 ${
                    isAiSpeaking 
                        ? 'bg-cyan-500/20 border border-cyan-400/30' 
                        : isListening 
                            ? 'bg-pink-500/20 border border-pink-400/30'
                            : 'bg-gray-500/10 border border-gray-400/20'
                }`}>
                    {/* Animated status dot */}
                    <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        isAiSpeaking 
                            ? 'bg-cyan-400 animate-pulse' 
                            : isListening 
                                ? 'bg-pink-400 animate-bounce'
                                : 'bg-gray-400'
                    }`} />
                    
                    <p className={`text-xs font-medium transition-all duration-300 ${
                        isAiSpeaking 
                            ? 'text-cyan-300' 
                            : isListening 
                                ? 'text-pink-300'
                                : 'text-gray-400'
                    }`}>
                        {isAiSpeaking ? 'AI Speaking' : isListening ? 'Listening...' : 'Ready'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AiOrbEnhanced;