import { AnimatePresence } from "motion/react";
import React, { useEffect, useRef } from 'react';

import "@tensorflow/tfjs";
import * as tf from "@tensorflow/tfjs";

export default function AiQus(props) {
    const localStreamRef = useRef();

    const init = async () => {
        await tf.ready();
        await tf.setBackend("webgl");
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current.srcObject = stream;
    }

    useEffect(() => {
        if (parseInt(props.step) === 11) {
            init();
        }
    }, [props.step]);

    return (
        <AnimatePresence initial={false}>
            {
                (parseInt(props.step) >= 11 && parseInt(props.step) <= 15) && <div className='w-[80%] h-[60vh] absolute left-[10%] mt-[10%]'>
                    <div className='flex items-center justify-between'>
                        {/* <div className='w-[40%]'>
                            <div className='w-full pt-[80%] relative border-[6px] border-primeLight rounded-tl-[60px] rounded-tr-[2px] rounded-br-[60px] rounded-bl-[2px] overflow-hidden shadow-2xl'>
                                <video ref={localStreamRef} autoPlay playsInline muted className='absolute object-cover inset-0 w-full h-full' />
                                <div className='bg-white w-[40px] h-[40px] absolute rounded-full bottom-[10px] left-[12px] flex items-center justify-center cursor-pointer' >
                                    <Mic size={22} />
                                </div>
                                <div className='bg-white w-[40px] h-[40px] absolute rounded-full bottom-[10px] left-[68px] flex items-center justify-center cursor-pointer' >
                                    <Camera size={22} />
                                </div>
                            </div>
                        </div> */}
                        <div className='w-[50%] h-[60vh] space-y-6 relative'>
                            <div className='space-y-3 flex flex-col items-end questions-list-container'>
                                <div className="question-container">
                                    <p className='bg-chSend px-4 py-2 inline-block shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-base'>
                                        When did your lower back pain start?
                                    </p>
                                    <div className="question-option-container">
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("Today") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            Today
                                        </p>
                                    </div>
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("Within the last week") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            Within the last week
                                        </p>
                                    </div>
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("More than a week ago") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            More than a week ago
                                        </p>
                                    </div>
                                        </div>
                                </div>
                                <div className="question-container">
                                    <p className='bg-chSend px-4 py-2 inline-block shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-base'>
                                        When did your lower back pain start?
                                    </p>
                                    <div className="question-option-container">
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("Today") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            Today
                                        </p>
                                    </div>
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("Within the last week") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            Within the last week
                                        </p>
                                    </div>
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("More than a week ago") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            More than a week ago
                                        </p>
                                    </div>
                                        </div>
                                </div>
                                <div className="question-container">
                                    <p className='bg-chSend px-4 py-2 inline-block shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-base'>
                                        When did your lower back pain start?
                                    </p>
                                    <div className="question-option-container">
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("Today") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            Today
                                        </p>
                                    </div>
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("Within the last week") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            Within the last week
                                        </p>
                                    </div>
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("More than a week ago") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            More than a week ago
                                        </p>
                                    </div>
                                        </div>
                                </div>
                                <div className="question-container">
                                    <p className='bg-chSend px-4 py-2 inline-block shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-base'>
                                        When did your lower back pain start?
                                    </p>
                                    <div className="question-option-container">
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("Today") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            Today
                                        </p>
                                    </div>
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("Within the last week") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            Within the last week
                                        </p>
                                    </div>
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("More than a week ago") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            More than a week ago
                                        </p>
                                    </div>
                                        </div>
                                </div>
                                <div className="question-container">
                                    <p className='bg-chSend px-4 py-2 inline-block shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-base'>
                                        When did your lower back pain start?
                                    </p>
                                    <div className="question-option-container">
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("Today") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            Today
                                        </p>
                                    </div>
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("Within the last week") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            Within the last week
                                        </p>
                                    </div>
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("More than a week ago") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            More than a week ago
                                        </p>
                                    </div>
                                        </div>
                                </div>
                                <div className="question-container">
                                    <p className='bg-chSend px-4 py-2 inline-block shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-base'>
                                        When did your lower back pain start?
                                    </p>
                                    <div className="question-option-container">
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("Today") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            Today
                                        </p>
                                    </div>
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("Within the last week") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            Within the last week
                                        </p>
                                    </div>
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("More than a week ago") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            More than a week ago
                                        </p>
                                    </div>
                                        </div>
                                </div>
                                <div className="question-container">
                                    <p className='bg-chSend px-4 py-2 inline-block shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-base'>
                                        When did your lower back pain start?
                                    </p>
                                    <div className="question-option-container">
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("Today") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            Today
                                        </p>
                                    </div>
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("Within the last week") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            Within the last week
                                        </p>
                                    </div>
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("More than a week ago") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            More than a week ago
                                        </p>
                                    </div>
                                        </div>
                                </div>
                                <div className="question-container">
                                    <p className='bg-chSend px-4 py-2 inline-block shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-base'>
                                        When did your lower back pain start?
                                    </p>
                                    <div className="question-option-container">
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("Today") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            Today
                                        </p>
                                    </div>
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("Within the last week") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            Within the last week
                                        </p>
                                    </div>
                                    <div className='cursor-pointer question-option' onClick={() => { props.send("More than a week ago") }}>
                                        <p className='bg-chSend hover:bg-primeDark inline-block px-4 py-1 shadow-md rounded-t-[14px] rounded-br-[1px] rounded-bl-[14px] text-xs'>
                                            More than a week ago
                                        </p>
                                    </div>
                                        </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            }
        </AnimatePresence>
    )
}
