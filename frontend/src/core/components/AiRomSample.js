import { RotateCcw } from 'lucide-react'
import React from 'react'

export default function AiRomSample(props) {
    return (
        (parseInt(props.step) >= 18 && parseInt(props.step) < 20) && <div className='w-[80%] h-[60vh] absolute left-[10%] mt-[6%] flex flex-col items-center justify-center'>
            <div className='w-[360px] h-[90%] bg-gray-200 flex items-center justify-center relative rounded-md border border-dashed'>
                <video src="https://storage.googleapis.com/fabdemo/alia/video.mp4" autoPlay playsInline muted className='object-fill absolute inset-0 w-full h-full' />
                <div className='bg-white absolute flex items-center font-medium top-[10px] left-[10px] text-txtMain p-2 rounded-tl-[14px] rounded-tr-[2px] rounded-br-[14px] rounded-bl-[2px] text-sm' >
                    <RotateCcw size={14} /> &nbsp;5 Reps
                </div>
            </div>
            <div className='bg-red-400 rounded-tl-[2px] rounded-tr-[14px] rounded-bl-[14px] px-12 py-3 text-white font-medium mt-6 cursor-pointer' onClick={() => { props.send("Standing forword bend") }}>
                Standing forword bend
            </div>
        </div>
    )
}
