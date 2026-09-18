import dayjs from 'dayjs';
import Image from 'next/image';
import Link from 'next/link'
import { getRandomInterviewCover } from "@/lib/utils"
import { Button } from '@/components/ui/button';
import DisplayTechIcons from './DisplayTechIcon';
import { getFeedbackByInterviewId } from '@/lib/actions/general.action';

const InterviewCard = async ({
    id,
    viewerId,
    type,
    role,
    techstack,
    createdAt,
    coverImage,
}: InterviewCardProps) => {
    const feedback = await getFeedbackByInterviewId({ interviewId: id, userId: viewerId });
    const normalizedType = /mix/gi.test(type) ? 'Mixed' : type;
    const interviewDate = feedback?.createdAt || createdAt;
    const formattedDate = interviewDate ? dayjs(interviewDate).format('MMM D, YYYY') : 'Date unavailable';

    return (
        <div className='card-border w-[360px] max-sm:w-full min-h-96'>
            <div className='card-interview'>
                <div>
                    <div className='absolute top-0 right-0 w-fit px-4 py-2 rounded-bl-lg bg-light-600'>
                        <p className='badge-text'>{normalizedType}</p>
                    </div>

                    <Image
                        src={coverImage ?? getRandomInterviewCover()}
                        alt={`${role} interview cover`}
                        width={90}
                        height={90}
                        className='rounded-full object-cover size-[90px]'
                    />

                    <h3 className='mt-5 capitalize'>
                        {role} Interview
                    </h3>

                    <div className='flex flex-row gap-5 mt-3'>
                        <div className='flex flex-row gap-2'>
                            <Image src="/calendar.svg" alt='calendar' width={22} height={22} />

                            <p>{formattedDate}</p>
                        </div>

                        <div className='flex flex-row gap-2 items-center'>
                            <Image src='/star.svg' alt='star' width={22} height={22} />
                            <p>
                                {feedback?.totalScore ?? '---'}/100
                            </p>
                        </div>
                    </div>
                    <p className='line-clamp-2 mt-5'>
                        {feedback?.finalAssessment || "You haven't taken the interview yet. Take it now to improve your skills."}
                    </p>
                </div>
                <div className='flex flex-row justify-between'>
                    <DisplayTechIcons techStack={techstack} />

                    <Button
                        render={<Link href={feedback
                            ? `/interview/${id}/feedback`
                            : `/interview/${id}`
                        } />}
                        nativeButton={false}
                        className='btn-primary'
                    >
                        {feedback ? 'Check Feedback' : 'View Interview'}
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default InterviewCard
