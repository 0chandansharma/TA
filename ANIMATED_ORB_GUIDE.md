# Animated Orb Implementation Guide

This guide explains the new Siri-like animated orb components for voice interactions.

## Components Created

### 1. **AiOrbEnhanced** (3D Version)
A 3D animated orb with advanced shaders and audio reactivity, similar to Apple's Siri.

**Features:**
- Color transitions: Purple when listening, Blue when AI speaks, White when idle
- Audio-reactive animations that respond to voice volume and frequency
- Smooth particle effects and glow
- WebGL-based for high performance

**Usage:**
```jsx
<AiOrbEnhanced 
    analyser={audioAnalyser}
    isListening={isUserSpeaking}
    isAiSpeaking={isAISpeaking}
    className="custom-class"
/>
```

### 2. **AiOrb2D** (2D Canvas Version)
A lighter 2D version for devices with limited GPU capabilities.

**Features:**
- Canvas-based rendering for better compatibility
- Waveform visualization during speech
- Particle effects
- Status indicator with text

**Usage:**
```jsx
<AiOrb2D 
    analyser={audioAnalyser}
    isListening={isUserSpeaking}
    isAiSpeaking={isAISpeaking}
    className="custom-class"
/>
```

## Integration Steps

### 1. Update Your App Component

The orbs are already integrated into `AiAvatar.js`. The component automatically uses the enhanced orb when voice states are provided:

```jsx
// In your app.js or app-fixed.js
<AiAvatar 
    text={currentDisplayText} 
    isStart={isStart} 
    onStart={startAssessment} 
    isOpen={isOpen} 
    analyser={analyser} 
    step={step}
    isListening={isListening}      // Pass listening state
    isAiSpeaking={aiSpeaking}       // Pass AI speaking state
/>
```

### 2. Audio Analyser Setup

The orbs use the Web Audio API analyser for visualizations. This is created in the `speakText` function:

```javascript
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const analyserNode = audioContext.createAnalyser();
analyserNode.fftSize = 256;
```

## Visual States

### Idle State
- Color: White/Light gray
- Animation: Gentle breathing effect
- Particles: Minimal, slow movement

### Listening State (User Speaking)
- Color: Purple (#9333ea)
- Animation: Audio-reactive expansion
- Particles: Active, purple tint
- Glow: Purple shadow effect

### AI Speaking State
- Color: Blue (#007aff)
- Animation: Audio-reactive with AI voice
- Particles: Active, blue tint
- Glow: Blue shadow effect

## Performance Considerations

### Use 3D Version When:
- Device has dedicated GPU
- Desktop or high-end mobile
- Need premium visual experience

### Use 2D Version When:
- Low-end devices
- Battery conservation needed
- Compatibility is priority

### Switching Between Versions

You can manually control which version to use:

```jsx
// In AiAvatar.js
const use2DOrb = useMediaQuery('(max-width: 768px)'); // Use 2D on mobile

{use2DOrb ? (
    <AiOrb2D ... />
) : (
    <AiOrbEnhanced ... />
)}
```

## Customization

### Colors
Edit the color values in the components:

```javascript
// In AiOrbEnhanced.js
uColorListening: { value: new Color('#9333ea') }, // Change listening color
uColorSpeaking: { value: new Color('#007aff') },  // Change speaking color
```

### Animation Speed
Adjust the animation parameters:

```javascript
// In vertex shader
uSpeed: { value: 1.10 }, // Overall animation speed
uNoiseStrength: { value: 0.90 }, // Turbulence intensity
```

### Size
The orb size can be controlled via CSS classes or inline styles:

```jsx
<AiOrbEnhanced className="scale-150" /> // 150% size
```

## Browser Support

- **3D Version**: Requires WebGL support (all modern browsers)
- **2D Version**: Works on all browsers with Canvas support
- **Audio Features**: Requires Web Audio API support

## Troubleshooting

### Orb Not Animating
- Check if `analyser` prop is being passed correctly
- Ensure audio context is not suspended
- Verify `isListening` and `isAiSpeaking` states are updating

### Performance Issues
- Switch to 2D version on low-end devices
- Reduce quality setting in 3D version
- Check for memory leaks in audio context

### Color Not Changing
- Verify state props are being passed
- Check console for WebGL errors
- Ensure proper cleanup of previous states

## Example Implementation

See `app-fixed.js` for a complete implementation with proper state management and cleanup.