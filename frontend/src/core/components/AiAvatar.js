import React from 'react';

import { AnimatePresence, motion } from "motion/react";
import AiOrb from './AiOrb';
import AiOrbEnhanced from './AiOrbEnhanced';

export default function AiAvatar(props) {
    // Use enhanced orb if voice features are being used
    const useEnhancedOrb = props.isListening !== undefined || props.isAiSpeaking !== undefined;
    
    return (
        <div className={`flex items-center justify-center transition-all duration-500 absolute ${props.isOpen ? 'w-full h-screen' : 'w-[120px] h-[120px] right-[8%]'} p-[20px]`}>
            <div className={`flex flex-col items-center justify-center ${props.isOpen ? 'p-4' : 'p-0'} rounded`} style={{"maxWidth": "1024px"}}>
                {props.step < 8 && (
                    useEnhancedOrb ? (
                        <AiOrbEnhanced 
                            analyser={props.analyser}
                            isListening={props.isListening}
                            isAiSpeaking={props.isAiSpeaking}
                            className={props.isOpen ? '' : 'scale-75'}
                        />
                    ) : (
                        <AiOrb analyser={props.analyser} />
                    )
                )}
                {
                    props.isOpen && <AnimatePresence initial={false}>
                        {
                            props.text.length !== 0 && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1 }} className='mt-16'>
                                <p className='text-2xl font-serif'>
                                    {props.text}
                                </p>
                            </motion.div>
                        }
                        {
                           !props.isStart && <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1 }} className='w-[180px] h-[36px] rounded bg-primeDark text-txtMain font-medium mt-16' onClick={() => { props.onStart(); }}>Start</motion.button>
                        }
                    </AnimatePresence>
                }
            </div>
        </div>
    )
}