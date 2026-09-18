"use client";

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation';
import { vapi } from '@/lib/vapi.sdk';
import { toast } from 'sonner';
import { z } from 'zod';
import { interviewGenerator, interviewer } from '@/constants';
import { createFeedback } from '@/lib/actions/feedback.action';

enum CallStatus {
    INACTIVE = 'INACTIVE',
    CONNECTING = 'CONNECTING',
    ACTIVE = 'ACTIVE',
    FINISHED = 'FINISHED'
}

interface SavedMessage {
    role: 'user' | 'system' | 'assistant';
    content: string;
}

interface VapiMessage {
    type: string;
    transcriptType?: 'partial' | 'final';
    role?: SavedMessage['role'];
    transcript?: string;
    toolCallList?: VapiToolCall[];
}

interface VapiToolCall {
    function?: {
        name?: string;
        arguments?: string | Record<string, unknown>;
    };
}

const interviewGenerationSchema = z.object({
    role: z.string().trim().min(1),
    level: z.string().trim().min(1),
    techstack: z.string().trim().min(1),
    type: z.enum(['technical', 'behavioral', 'mixed']),
    amount: z.coerce.number().int().min(1).max(10),
});

const parseToolArguments = (toolCall: VapiToolCall) => {
    const args = toolCall.function?.arguments;

    if (typeof args === 'string') {
        return JSON.parse(args) as unknown;
    }

    return args;
}

const Agent = ({ userName, userId, type, interviewId, questions }: AgentProps) => {
    const router = useRouter();
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
    const [messages, setMessages] = useState<SavedMessage[]>([]);
    const isGeneratingInterview = useRef(false);
    const feedbackStarted = useRef(false);
    const messagesRef = useRef<SavedMessage[]>([]);

    const showCallError = useCallback(() => {
        toast.error('Could not start the call. Please try again.', {
            id: 'vapi-call-error',
        });
    }, []);

    useEffect(() => {
        const onCallStart = () => {
            toast.dismiss('vapi-call-error');
            setCallStatus(CallStatus.ACTIVE);
        };
        const onCallEnd = () => {
            setIsSpeaking(false);
            setCallStatus(CallStatus.FINISHED);
        };

        const onMessage = (message: VapiMessage) => {
            if (
                message.type === 'transcript' &&
                message.transcriptType === 'final' &&
                message.role &&
                message.transcript
            ) {
                const newMessage = { role: message.role, content: message.transcript };
                const nextMessages = [...messagesRef.current, newMessage];

                messagesRef.current = nextMessages;
                setMessages(nextMessages);
            }

            if (message.type === 'tool-calls' && message.toolCallList) {
                const generateInterviewCall = message.toolCallList.find(
                    (toolCall) => toolCall.function?.name === 'generateInterview'
                );

                if (generateInterviewCall && !isGeneratingInterview.current) {
                    isGeneratingInterview.current = true;

                    void (async () => {
                        try {
                            const interviewData = interviewGenerationSchema.parse(
                                parseToolArguments(generateInterviewCall)
                            );
                            const response = await fetch('/api/vapi/generate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(interviewData),
                            });
                            const result = await response.json().catch(() => null);

                            if (!response.ok || !result?.success) {
                                throw new Error('Interview generation request failed.');
                            }

                            toast.success('Interview created successfully.');
                            try {
                                await vapi.stop();
                            } catch (stopError) {
                                console.error('Interview was created, but the call could not be stopped', stopError);
                                setCallStatus(CallStatus.FINISHED);
                            }
                        } catch (error) {
                            console.error('Failed to generate interview', error);
                            isGeneratingInterview.current = false;
                            toast.error('Could not create the interview. Please try again.');
                            vapi.send({
                                type: 'say',
                                message: 'I could not create the interview. Please check the details and try again.',
                                interruptionsEnabled: false,
                            });
                        }
                    })();
                }
            }
        }

        const onSpeechStart = () => setIsSpeaking(true);
        const onSpeechEnd = () => setIsSpeaking(false);
        const onError = (error: Error) => {
            console.error('Vapi error', error);
            setIsSpeaking(false);
            setCallStatus((currentStatus) =>
                currentStatus === CallStatus.FINISHED
                    ? CallStatus.FINISHED
                    : CallStatus.INACTIVE
            );
            showCallError();
        };
        const onCallStartFailed = () => {
            setIsSpeaking(false);
            setCallStatus(CallStatus.INACTIVE);
            showCallError();
        };

        vapi.on('call-start', onCallStart);
        vapi.on('call-end', onCallEnd);
        vapi.on('message', onMessage);
        vapi.on('speech-start', onSpeechStart);
        vapi.on('speech-end', onSpeechEnd);
        vapi.on('error', onError);
        vapi.on('call-start-failed', onCallStartFailed);

        return () => {
            vapi.off('call-start', onCallStart);
            vapi.off('call-end', onCallEnd);
            vapi.off('message', onMessage);
            vapi.off('speech-start', onSpeechStart);
            vapi.off('speech-end', onSpeechEnd);
            vapi.off('error', onError);
            vapi.off('call-start-failed', onCallStartFailed);
        }
    }, [showCallError]);

    const handleGenerateFeedback = useCallback(async (transcript: SavedMessage[]) => {
        if (feedbackStarted.current) return;

        if (!interviewId || !userId) {
            toast.error('Could not save feedback because the interview information is missing.');
            router.push('/');
            return;
        }

        if (transcript.length === 0) {
            toast.error('No interview transcript was captured.', {
                id: 'missing-interview-transcript',
            });
            return;
        }

        feedbackStarted.current = true;

        try {
            const { success, feedbackId } = await createFeedback({
                interviewId,
                transcript,
            });

            if (!success || !feedbackId) {
                throw new Error('Feedback was not saved.');
            }

            router.push(`/interview/${interviewId}/feedback`);
        } catch (error) {
            console.error('Failed to generate feedback', error);
            toast.error('Could not generate feedback. Please try again.');
            router.push('/');
        }
    }, [interviewId, router, userId]);

    useEffect(() => {
        if (callStatus === CallStatus.FINISHED) {
            if (type === 'generate') {
                router.push('/');
                return;
            }

            // Vapi can emit the final transcript shortly after call-end. Restarting
            // this timer when messages change captures it without creating feedback twice.
            const feedbackTimer = window.setTimeout(() => {
                void handleGenerateFeedback(messagesRef.current);
            }, 1000);

            return () => window.clearTimeout(feedbackTimer);
        }
    }, [callStatus, handleGenerateFeedback, messages, router, type]);

    const handleCall = async () => {
        feedbackStarted.current = false;
        isGeneratingInterview.current = false;
        messagesRef.current = [];
        setMessages([]);
        setCallStatus(CallStatus.CONNECTING);

        try {
            let call;

            if (type === 'generate') {
                call = await vapi.start(interviewGenerator, {
                    variableValues: {
                        username: userName,
                    },
                });
            } else {
                if (!questions?.length) {
                    throw new Error('No interview questions were provided.');
                }

                const formattedQuestions = questions
                    .map((question) => `-${question}`)
                    .join('\n');

                call = await vapi.start(interviewer, {
                    variableValues: {
                        questions: formattedQuestions,
                    },
                });
            }

            if (!call) {
                throw new Error('Vapi did not create a call.');
            }
        } catch (error) {
            console.error('Failed to start Vapi call', error);
            setIsSpeaking(false);
            setCallStatus(CallStatus.INACTIVE);
            showCallError();
        }
    }

    const handleDisconnect = async () => {
        try {
            await vapi.stop();
        } catch (error) {
            console.error('Failed to stop Vapi call', error);
            setIsSpeaking(false);
            setCallStatus(CallStatus.INACTIVE);
            toast.error('Could not end the call. Please try again.');
        }
    }

    const latestMessage = messages[messages.length - 1]?.content;
    const isCallInactiveOrFinished = callStatus === CallStatus.INACTIVE || callStatus === CallStatus.FINISHED;

    return (
        <>

            <div className='call-view'>
                <div className='card-interviewer'>
                    <div className='avatar'>
                        <Image src="/ai-avatar.png" alt="vapi" width={65} height={54} className='object-cover' />
                        {isSpeaking && <span className='animate-speak' />}
                    </div>
                    <h3>AI Interview</h3>
                </div>

                <div className='card-border'>
                    <div className='card-content'>
                        <Image src="/user-avatar.png" alt='user avatar' width={540} height={540} className='rounded-full object-cover' />
                        <h3>{userName}</h3>
                    </div>
                </div>
            </div>
            {messages.length > 0 && (
                <div className='transcript-border'>
                    <div className='transcript'>
                        <p key={latestMessage} className='transition-opacity duration-500 animate-fadeIn opacity-100'>
                            {latestMessage}
                        </p>
                    </div>
                </div>
            )}
            <div className='w-full flex justify-center'>
                {callStatus !== CallStatus.ACTIVE ? (
                    <button
                        className='relative btn-call'
                        onClick={handleCall}
                        disabled={callStatus === CallStatus.CONNECTING}
                    >
                        <span className={cn('absolute animate-ping rounded-full opacity-75', callStatus !== CallStatus.CONNECTING && 'hidden')} />

                        <span>
                            {isCallInactiveOrFinished ? 'Call' : '...'}
                        </span>
                    </button>
                ) : (
                    <button className='btn-disconnect' onClick={handleDisconnect}>
                        End
                    </button>
                )}
            </div>
        </>
    )
}

export default Agent
