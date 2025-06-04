import React, { useEffect, useRef, useState } from 'react';



import './assets/styles/app.css';
// import AiRomSample from './core/components/AiRomSample';
import AiAvatar from './core/components/AiAvatar';
import AiDashboard from './core/components/AiDashboard';
import AiQus from './core/components/AiQus';
import AiRomMain from './core/components/AiRomMain';
import AiVideo from './core/components/AiVideo';
import ServiceChat from './core/services/serviceChat';
export default function App() {

    const [voices, setVoices] = useState([]);
    const [chatHistory, setChatHistory] = useState([]);
    const [QnAHistory, setQnAHistory] = useState([]);
    const [aiSpeaking, setAiSpeaking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [nextQuestion, setNextQuestion] = useState(false);

    const [recognition, setRecognition] = useState(null);
    const [analyser, setAnalyser] = useState(true);

    const [status, setStatus] = useState("");
    const [currentDisplayText, setCurrentDisplayText] = useState("");
    const [stage, setStage] = useState("idle");

    const [isStart, setIsStart] = useState(false);
    const [isOpen, setIsOpen] = useState(true);
    const [isChat, setIsChat] = useState(false);

    const [assessmentId, setAssessmentId] = useState(3);
    // Create a ref to store the current assessmentId
    const assessmentIdRef = useRef(3);
    const [step, setStep] = useState(0);

    const mainService = new ServiceChat();

    const init = async () => {
        const recog = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        setRecognition(recog);
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
    }

    const speakText = (text, isAiSpeaking = false, listenNext = true, step = 0) => {
        if ("speechSynthesis" in window) {
            const audioContext = new AudioContext();
            const analyserNode = audioContext.createAnalyser();
            analyserNode.fftSize = 256;

            const destination = audioContext.createMediaStreamDestination();
            const source = audioContext.createMediaStreamSource(destination.stream);

            source.connect(analyserNode);
            setAnalyser(analyserNode);

            window.speechSynthesis.cancel();
            if(isAiSpeaking){
                setStatus("AI is speaking...");
            }
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.voice = voices.find((voice) => voice.name.includes("Female"));
            utterance.rate = 0.8;
            utterance.onend = () => {
                setStatus("");
                if(listenNext){
                    startListening();
                }
                //video step
                if(step === 8){
                    setTimeout(() => {
                        setCurrentDisplayText(``);
                        setStep(step);
                    }, 5000);
                    //set text from 5 to 1 as seconds so that user can be ready
                    for(let i = 5; i >= 0; i--){
                        setTimeout(() => {
                            if(i === 0){
                                setCurrentDisplayText(``);
                            }else{
                                setCurrentDisplayText(`Please be ready in ${i} seconds`);
                            }
                        }, i * 1000);
                    }

                }
            };
            window.speechSynthesis.speak(utterance);
        } else {
            alert("Text-to-Speech is not supported in this browser.");
        }
    };

    const stopListening = () => {
        if (recognition !== null) {
            recognition.stop();
        }
    }

    const startListening = () => {
        if (recognition !== null) {
            recognition.lang = "en-US";

            recognition.onstart = () => {
                setIsListening(true);
                setStatus("Listening...");
            };
            // Remove the existing handler before adding a new one
            recognition.onresult = null;

            recognition.onresult = (event) => {
                const userSpeech = event.results[0][0].transcript;
                    sendChat(userSpeech, assessmentIdRef.current);
            };

            recognition.onerror = () => {
                setStatus("Error: Please try again.");
                setIsListening(false);
            };

            recognition.onend = () => {
                if (isListening) setStatus("Listening...");
            };

            recognition.start();
        }
    };

    const sendChat = async (message, assID, isImage = false) => {
        if(!isImage){
            setCurrentDisplayText(message);
        }
        setStatus("Talking to the AI...");
        setIsListening(false);
        stopListening();

        // Create new message object
        const newMessage = { user: message };
        // Update chat history
        setChatHistory(prevChats => {
            const updatedChats = [...prevChats, newMessage];
            // Create bodyChat here where we have access to latest chats
            const bodyChat = {
                chat_history: updatedChats
            };
            console.log("bodyChat =>",bodyChat);
             // Add this utility function at the top level of your component

            // Make API call here where we have the latest chats
            mainService.chatWithAI(bodyChat, '', assID)
                .then((res) => {
                    if (res['success']) {
                        if (!isStart) {
                            
                            setStage("chat");
                        }
                        
                        const chatRes = res['data']['response'];
                        
                        setChatHistory(latestChats => {
                            return latestChats.map((chat, index) => {
                                if (index === latestChats.length - 1) {
                                    return { ...chat, response: chatRes };
                                }
                                return chat;
                            });
                        });
                        // Add a specific pattern for "could you" questions if needed
                        // const questionPattern = /(?:could|can)\s+you(?:\s+(?:please|show|tell|help|do|that|this))*/i;
                        const next_action = res['data']['action'];
                        console.log("next_action =>",next_action);
                        if(next_action === "camera_on"){
                            console.log("camera_on");
                            const pain_location_video_step = 8;
                            setCurrentDisplayText(chatRes);
                            speakText(chatRes, true, false, pain_location_video_step);
                            
                        }else if (next_action !== "next_api") {
                            setCurrentDisplayText(chatRes);
                            speakText(chatRes,true);
                        }else {
                            setCurrentDisplayText("");
                            speakText(chatRes, true, false);
                            const QnA_step = 11;
                            setStep(QnA_step);
                            setAnalyser(false);
                            
                        }
                    }
                });
            
            return updatedChats;
        });
        // mainService.chatWithAI(bodyChat, '', assID).then((res) => {
        //     if (res['success']) {
        //         if (!isStart) {
        //             setIsStart(true);
        //             setStage("chat");
        //         }
        //         let tempChat = [...chatHistory];
        //         const chatRes = res['data']['response'];
        //         const lastIndex = tempChat.length - 1;
        //         if (lastIndex >= 0) {
        //             tempChat[lastIndex] = {
        //                 ...tempChat[lastIndex],
        //                 response: chatRes,
        //             };
        //         }
        //         setChatHistory(tempChat);
        //         console.log("chatRes =>",chatHistory);
        //         if (res['data']['action'] === "next_api") {
        //             //Todo: make some changes here
        //         } else {
        //             setCurrentDisplayText(chatRes);
        //             speakText(chatRes);
        //         }
        //     }
        // });
    }

    const sendAnswerToAPI = async (answer, assID, isFinal = false) => {
        // if(!isImage){
        //     // alert(answer);
        //     setCurrentDisplayText(answer);
        // }
        setStatus("Talking to the AI...");
        setIsListening(false);
        stopListening();

        // Create new answer object
        const newMessage = { user: answer };
        // Update chat history
        setQnAHistory(prevQuestions => {
            // Create bodyChat here where we have access to latest chats
            const updatedQuestions = [...prevQuestions, newMessage];
            
            
            const bodyChat = {
                chat_history: updatedQuestions
            };
            console.log("bodyChat =>",bodyChat);
             // Add this utility function at the top level of your component
    
            // Make API call here where we have the latest chats
            mainService.chatWithQnAAI(bodyChat, '', assID).then((res) => {
                console.log("chatWithQnAAI:res =>",res);
                if (res['success']) {
                    if (isStart) {
                        setStage("QnA");
                    }
                    
                    const questionRes = res['data'];
                    console.log("questionRes QnA =>",questionRes);
                    setNextQuestion(questionRes);
                    setQnAHistory(prevQuestions => {
                        console.log("prevQuestions =>",prevQuestions);
                        return prevQuestions.map((chat, index) => {
                            if (index === prevQuestions.length - 1) {
                                return { ...chat, assistant: questionRes.question };
                            }
                            return chat;
                        });
                    });
                    // Add a specific pattern for "could you" questions if needed
                    const questionPattern = /(?:could|can)\s+you(?:\s+(?:please|show|tell|help|do|that|this))*/i;
        
                    // if(questionPattern.test(questionRes) || res['data']['action'] === "camera_on"){
                    //     const pain_location_video_step = 8;
                    //     setCurrentDisplayText(questionRes);
                    //     speakText(questionRes, true, false, pain_location_video_step);
                        
                    // }else if (res['data']['action'] !== "next_api") {
                    //     setCurrentDisplayText(questionRes);
                    //     speakText(questionRes,true);
                    // }else {
                    //     setCurrentDisplayText(questionRes);
                    //     speakText(questionRes, true, false);
                        
                    // }
                }
            });
            return updatedQuestions;
        });
        
        // return res;
    }

    const startAssessment = () => {
        var body = {
            userId: 1,
            anatomyId: 3,
            assessmentType: "PAIN",
        };
        mainService.createAssessment(body, '').then((res) => {
            if (res['success']) {
                const newAssessmentId = res['data']['assessmentId'];
                setAssessmentId(newAssessmentId);
                setIsStart(true);
                sendChat('Hello', newAssessmentId);
            }
        });
    }

    // Keep the ref updated with the latest state value
    useEffect(() => {
        assessmentIdRef.current = assessmentId;
    }, [assessmentId]);

    const reset = () => {
        setStep(0);
        setIsStart(false);
        setIsOpen(true);
    }

    // useEffect(() => {
    //     init();
    //     if (isStart) {
    //         setTimeout(() => {
    //             stepChange();
    //         }, 1000);
    //     }
    // }, [step, isStart]);

    useEffect(() => {
        init();
    }, [isStart]);

    const sendPainPointImage = (base64Image) => {
        // setStep(step+ 1);
        if (base64Image) {
            // Do something with the base64Image
            sendChat(base64Image, assessmentId, true);
            //set step to 11 to show the QnA section
            console.log("proceeding to the QnA section");
            // setStep(11);
        }
      };

    const saveRomData = async (romData) => {
        mainService.saveRomData(romData, '', assessmentId).then((res) => {
            console.log("res =>",res);
            //todo: save the dashboard data
        });
    }

    return (
        <>
            {/* <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} rtl={false} theme="light" /> */}
            <div className='bg-prime w-full h-screen overflow-hidden relative'>
                <div className='absolute top-0 left-0 w-full flex justify-center items-start'>
                    <div>{status}</div>
                </div>
                <AiVideo step={step} next={sendPainPointImage} />
                {/* <AiQus step={step} send={sendChat} />  */}
                <AiQus 
                    step={step}
                    send={async (answer, isFinal = false) => {
                        // Your API call here
                        const response = await sendAnswerToAPI(answer, assessmentId, isFinal);
                        console.log("response =>",response);
                        return response;
                    }}
                    onComplete={() => {
                        // Handle completion/move to next step
                        setStep(prev => prev + 1);
                    }}
                    nextQuestion={nextQuestion}
/>
               {step < 8 && <AiAvatar text={currentDisplayText} isStart={isStart} onStart={startAssessment} isOpen={isOpen} analyser={analyser} step={step} isListening={isListening} isAiSpeaking={aiSpeaking} />}
                {/* <AiChat send={sendChat} isChat={isChat} /> */}
                {/* <AiRomSample send={sendChat} step={step} /> */}
                <AiRomMain step={step} next={()=>{
                    setStep(prev => prev + 1);
                }} 
                saveRomData={saveRomData} 
                />
                <AiDashboard step={step} assessmentId={assessmentId} reset={reset} /> 
            </div>
        </>
    )
}