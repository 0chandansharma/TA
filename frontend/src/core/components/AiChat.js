import React, { useRef } from 'react';

import { AnimatePresence, motion } from "motion/react";

import { Mic, SendHorizonal } from 'lucide-react';

export default function AiChat(props) {

    const chatRef = useRef('');

    return (
        <AnimatePresence initial={false}>
            {
                props.isChat && <motion.div initial={{ opacity: 0, translateY: '80px' }} animate={{ opacity: 1, translateY: 0 }} exit={{ opacity: 0, translateY: '80px' }} transition={{ duration: 1 }} className='w-[60%] h-[48px] bg-white absolute bottom-10 left-[20%] rounded border border-black border-dashed flex items-center'>
                    <input type='text' placeholder='Response' className='w-full h-full outline-none px-2' ref={chatRef} />
                    <div className='w-[8px]'></div>
                    <div className='flex items-center justify-center w-[32px] h-[32px] bg-red-600 text-white rounded-full cursor-pointer'>
                        <Mic size={16} />
                    </div>
                    <div className='w-[8px]'></div>
                    <div className='flex items-center justify-center w-[32px] h-[32px] bg-blue-600 text-white rounded-full cursor-pointer' onClick={() => {
                        let msg = chatRef.current.value;
                        if (msg.length !== '') {
                            props.send(msg);
                        }
                        chatRef.current.value = "";
                    }}>
                        <SendHorizonal size={16} />
                    </div>
                    <div className='w-[8px]'></div>
                </motion.div>
            }
        </AnimatePresence>
    )
}
