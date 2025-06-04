import { Canvas, useFrame } from '@react-three/fiber';
import React, { Suspense, useMemo, useRef } from 'react';
import { Color, IcosahedronGeometry, MeshDepthMaterial, MeshPhysicalMaterial, RGBADepthPacking } from 'three';
import CustomShaderMaterial from 'three-custom-shader-material';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { useMediaQuery } from 'usehooks-ts';

const AiOrbGeometry = ({ shouldReduceQuality, isMobile, analyser }) => {
    const materialRef = useRef(null);
    const depthMaterialRef = useRef(null);

    const vertexShader = `
    attribute vec4 tangent;

    varying float vPattern;

    uniform float uTime;
    uniform float uSpeed;
    uniform float uNoiseStrength;
    uniform float uDisplacementStrength;
    uniform float uFractAmount;

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
        pos += cnoise(pos * 1.65) * uNoiseStrength;

        return smoothMod(pos.y * uFractAmount, 1., 1.5) * uDisplacementStrength;
    }    

    void main() {
        vec3 biTangent = cross(csm_Normal, tangent.xyz);
        float shift = 0.01;
        vec3 posA = csm_Position + tangent.xyz * shift;
        vec3 posB = csm_Position + biTangent * shift;

        float pattern = getDisplacement(csm_Position);
        vPattern = pattern;

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

    uniform vec3 uColor;

    void main() {
        vec3 color = vPattern * uColor;

        csm_DiffuseColor = vec4(color, 1.);
    }
    `;

    useFrame(({ clock }) => {
        const elapsedTime = clock.getElapsedTime();

        if (analyser) {
            const dataArray = new Uint8Array(500);
            analyser.getByteFrequencyData(dataArray);
            
            // Calculate average frequency
            const averageVolume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            // Normalize and scale for animation
            const scale = averageVolume / 128;
            
            if (materialRef.current) {
                // Modify uniforms based on audio
                materialRef.current.uniforms.uNoiseStrength.value = 0.90 + (scale * 0.5);
                materialRef.current.uniforms.uDisplacementStrength.value = 0.48 + (scale * 0.2);
                materialRef.current.uniforms.uFractAmount.value = 4 + (scale * 2);
            }

            if (depthMaterialRef.current) {
                depthMaterialRef.current.uniforms.uNoiseStrength.value = materialRef.current.uniforms.uNoiseStrength.value;
                depthMaterialRef.current.uniforms.uDisplacementStrength.value = materialRef.current.uniforms.uDisplacementStrength.value;
                depthMaterialRef.current.uniforms.uFractAmount.value = materialRef.current.uniforms.uFractAmount.value;
            }
        }

        // Update time uniform
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = elapsedTime;
        }
        if (depthMaterialRef.current) {
            depthMaterialRef.current.uniforms.uTime.value = elapsedTime;
        }
    });

    const geometry = useMemo(() => {
        const geometry = mergeVertices(new IcosahedronGeometry(1.3, shouldReduceQuality ? 128 : 200));
        geometry.computeTangents();
        return geometry;
    }, [shouldReduceQuality]);

    const uniforms = {
        uTime: { value: 0 },
        uColor: { value: new Color('#ffeffe') },
        uGradientStrength: { value: 3 },
        uSpeed: { value: 1.10 },
        uNoiseStrength: { value: 0.90 },
        uDisplacementStrength: { value: 0.48 },
        uFractAmount: { value: 4 },
    };

    return (
        <>
            <mesh geometry={geometry} frustumCulled={false} position={[0, isMobile ? -1.3 * 0 : 0, 0]}>
                <CustomShaderMaterial ref={materialRef} baseMaterial={MeshPhysicalMaterial} vertexShader={vertexShader} fragmentShader={fragmentShader} silent roughness={0.54} metalness={0.52} reflectivity={0.74} clearcoat={0} ior={0.29} iridescence={1} uniforms={uniforms} />
                <CustomShaderMaterial ref={depthMaterialRef} baseMaterial={MeshDepthMaterial} vertexShader={vertexShader} uniforms={uniforms} silent depthPacking={RGBADepthPacking} attach="customDepthMaterial" />
            </mesh>
            <ambientLight color="#0079ff" intensity={4} />
            <directionalLight color="#c4fff8" intensity={5} position={[-0.33, 2, 3.50]} />
        </>
    );
};

const AiOrb = (props) => {
    const isTablet = useMediaQuery('(max-width: 1199px)');
    const isMobile = useMediaQuery('(max-width: 767px)');
    return (
        <div className="w-[120px] h-[120px] bg-transparent">
            <Canvas camera={{ position: [0, 0, 5], fov: 45, near: 0.1, far: 1000, }} gl={{ alpha: true }} className='bg-transparent' >
                <Suspense fallback={null}>
                    <AiOrbGeometry shouldReduceQuality={isTablet} isMobile={isMobile} analyser={props.analyser} />
                </Suspense>
            </Canvas>
        </div>
    );
};

export default AiOrb;