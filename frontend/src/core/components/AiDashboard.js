import {
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip
} from 'chart.js';
import { AnimatePresence, motion } from "motion/react";
import React, { useEffect, useState } from 'react';
import ServiceChat from '../services/serviceChat';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);


export default function AiDashboard(props) {

    const [summary, setSummary] = useState({});

    const mainService = new ServiceChat();
    const [assessmentId, setAssessmentId] = useState(props.assessmentId);

    const loadData = async (assessmentId) => {
        const result = await mainService.getDashboardSummery(assessmentId)
        console.log("result =>", result.data);
        setSummary(result.data);
    }

    useEffect(() => {
        if (parseInt(props.step) === 24) {
            loadData(assessmentId);
        }
    }, [props.step]);

    const renderAngleChart = (angle, label) => {
        const radius = 110;
        const angleInRadians = (angle * Math.PI) / 180;
        const endX = radius * Math.cos(angleInRadians);
        const endY = -radius * Math.sin(angleInRadians);
        
        const textAngle = angleInRadians / 2;
        const textRadius = radius * 0.5;
        const textX = textRadius * Math.cos(textAngle);
        const textY = -35;
    
        return (
            <div className="flex flex-col items-center w-[220px]">
                <svg width="220" height="120" viewBox="-100 -100 200 200" style={{"position": "absolute", "top": "0", "left": "-20px", "bottom": "-60px", "right": "0", "margin": "auto"}}>
                    {/* Mint green fill for the angle */}
                    <path
                        d={`M 0,0 L ${endX},${endY} A ${radius},${radius} 0 0,1 100,0 Z`}
                        fill="#C2F7E1"  // Light mint green
                        opacity="0.5"   
                    />
                    
                    {/* Base line (horizontal) */}
                    <line 
                        x1="-120" 
                        y1="0" 
                        x2="100" 
                        y2="0" 
                        stroke="#C2F7A0" 
                        strokeWidth="4"
                    />
                    
                    {/* Angle line */}
                    <line 
                        x1="0" 
                        y1="0" 
                        x2={endX} 
                        y2={endY} 
                        stroke="#C2F7A0" 
                        strokeWidth="4"
                    />
                    
                    {/* Dot at the vertex */}
                    <circle 
                        cx="0" 
                        cy="0" 
                        r="5"
                        fill="#C2F7B2"
                    />
    
                    {/* Dot at the end of angle line */}
                    <circle 
                        cx={endX}
                        cy={endY}
                        r="6"
                        fill="#C2F7E1"
                    />
    
                    {/* Angle text */}
                    <text 
                        x={textX} 
                        y={textY} 
                        textAnchor="middle" 
                        dominantBaseline="middle"
                        className="text-sm font-bold"
                        style={{
                            fontSize: "18px"
                        }}
                    >
                        {angle}°
                    </text>
                </svg>
            </div>
        );
    };

    return (
        <AnimatePresence initial={false}>
            {
                parseInt(props.step) === 24 && summary && <motion.div className='w-[90%] mx-auto h-[90vh] mt-[2%]'>
                    <div className='flex items-center justify-between px-2 h-[60px]'>
                        <div className='w-[240px] bg-white text-center p-2 rounded-r-full rounded-tl-full font-sm cursor-pointer' onClick={() => { props.reset(); }}>
                            <div>+ New Assessment</div>
                        </div>
                        <div className='flex items-center'>
                            <div className='text-xl font-medium mr-4'>Screening Summary</div>
                            {/* <div className='w-[54px] h-[54px] bg-primeLight rounded-tl-[22px] rounded-br-[22px]'></div> */}
                        </div>
                    </div>
                    <div className='p-2 grid grid-cols-2 gap-8 mt-8'>
                        <div className='col-span-1'>
                            <div className='w-full rounded-tr-[54px] rounded-bl-[54px] bg-white p-8 flex items-center space-x-4'>
                                <img src="https://storage.googleapis.com/fabdemo/alia/SSA1.png" alt="back image" className='w-[40%]' />
                                <div className='flex flex-col items-end'>
                                    <h3 className='text-lg text-assent font-medium'>Your Symptoms</h3>
                                    <div className='h-[40px]'></div>
                                    <div className='space-y-3 flex flex-col items-end'>
                                        {summary.analysedResults && summary.analysedResults.symptoms && 
                                            summary.analysedResults.symptoms.map((sym) => {
                                                return <div>
                                                    <p className='text-sm font-normal'>{sym}</p>
                                                    <div className='bg-gray-200 w-[400px] h-[1px]'></div>
                                                </div>
                                            })
                                        }
                                    </div>
                                </div>
                            </div>
                            {/* <div className='w-full rounded-tr-[54px] rounded-bl-[54px] bg-white p-8 flex items-center space-x-4 mt-10'>
                                <div className='w-[40%] space-y-2 flex flex-col items-center'>
                                    <div className='flex flex-row items-center justify-evenly text-gray-800 w-full'>
                                        <p className='font-sans'>Expected</p>
                                        <p className='font-sans'>Achieved</p>
                                    </div>
                                    <img src="https://storage.googleapis.com/fabdemo/alia/SSA2.png" alt="back image" className='' />
                                </div>
                                <div className='flex flex-col items-end'>
                                    <h3 className='text-2xl text-assent font-medium'>Range of Motion</h3>
                                    <div className='h-[100px]'></div>
                                    <div className='space-y-3 flex flex-col items-end'>
                                        <p className='text-2xl font-medium'>Back Bend</p>
                                        <div className='bg-gray-400 w-[400px] h-[1px]'></div>
                                        <p className='text-2xl font-medium'>Fowrward Bend</p>
                                    </div>
                                </div>
                            </div> */}
                            <div className='w-full rounded-tr-[54px] rounded-bl-[54px] bg-white p-8 flex items-center justify-between space-x-4 mt-10'>
                                <div className='w-[100%] space-y-2 flex flex-col items-center angle-chart-container'>
                                    <div className='flex flex-row items-center justify-evenly text-gray-800 w-full angle-chart-container-header'>
                                        <p className='font-sans angle-chart-container-header-label'>Expected</p>
                                        <p className='font-sans angle-chart-container-header-label'>Achieved</p>
                                        <h3 className='text-lg text-assent font-medium'>Range of Motion</h3>
                                    </div>
                                    <div className='flex flex-row items-center text-gray-800 w-full relative angle-chart-container-row'>
                                        <div className="angle-chart-container-row-item">
                                            <img src="https://storage.googleapis.com/fabdemo/alia/a2.png" alt="back image" className='w-[120px]' />
                                        </div>
                                            <div className='angle-chart-container-row-item'>
                                                {renderAngleChart(160, 'Back Bend')}
                                            </div>
                                        <p className='text-lg font-medium angle-chart-container-row-item-last'>Back Bend</p>
                                    </div>
                                    <div className='bg-gray-200 w-[100%] h-[2px]'></div>
                                    <div className='flex flex-row items-center text-gray-800 w-full relative angle-chart-container-row'>
                                    <div className="angle-chart-container-row-item">
                                            <img src="https://storage.googleapis.com/fabdemo/alia/a2.png" alt="back image" className='w-[120px]' />
                                        </div>
                                            <div className='angle-chart-container-row-item'>
                                                {renderAngleChart(summary.assessmentData?.rangeOfMotion?.minimum || 0, 'Forward Bend')}
                                            </div>
                                            <p className='text-lg font-medium angle-chart-container-row-item-last'>Forward Bend</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className='col-span-1 space-y-8'>
                            <div className='w-full rounded-tl-[54px] rounded-br-[54px] bg-white'>
                                <div className='p-8 space-x-4'>
                                    <h3 className='text-lg text-assent font-medium text-right'>Interview</h3>
                                    <div className='h-[10px]'></div>
                                    <div className='space-y-1 flex flex-col items-start overflow-y-scroll h-[200px]'>
                                        {summary.assessmentData && summary.assessmentData.chat_history && summary.assessmentData.chat_history.map((chat, index) => (
                                            <div key={index} className="w-full">
                                                {chat.assistant && (
                                                    <p className='text-sm font-normal italic'>{chat.assistant}</p>
                                                )}
                                                {chat.user && (
                                                    <p className='text-sm text-gray-400 mb-2'>{chat.user}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* <div className='w-full bg-primeLight text-center text-sm font-medium p-1 text-gray-600'>
                                    <div className='flex items-center justify-center'>See More &nbsp;<ChevronDown size={16} /> </div>
                                </div> */}
                            </div>
                            <div className='w-full rounded-tl-[54px] rounded-br-[54px] bg-white p-8 space-x-4'>
                                <h3 className='text-lg text-assent font-medium text-right'>Possible Conditions</h3>
                                <div className='h-[32px]'></div>
                                <div className='space-y-3 flex flex-col overflow-y-scroll h-[120px] items-start'>
                                    {
                                        summary.analysedResults && summary.analysedResults.possible_diagnosis && summary.analysedResults.possible_diagnosis.map((pd) => {
                                            return   <div className='w-full'>
                                                <p className='text-sm font-normal border-b border-gray-200 pb-2'>{pd}</p>
                                                <div className='bg-gray-100 w-[400px] h-[1px]'></div>
                                            </div>
                                        })
                                    }
                                </div>
                            </div>
                            <div className='w-full rounded-tl-[54px] rounded-br-[54px] bg-white p-8 space-x-4'>
                                <h3 className='text-lg text-assent font-medium text-right'>Next Steps</h3>
                                <div className='space-y-3 flex flex-col items-start'>
                                    <p className='text-xl font-medium'>
                                        {
                                            summary.analysedResults && summary.analysedResults.next_steps
                                        }
                                    </p>
                                    {/* <p className='text-lg bg-primeDark px-6 py-1 rounded-l-full rounded-tr-full'>{summary.next_steps} Options</p> */}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            }
        </AnimatePresence>
    )
}
