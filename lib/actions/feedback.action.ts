"use server";

import { feedbackSchema } from "@/constants";
import { db } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";

const transcriptEntrySchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().trim().min(1).max(4000),
});

const createFeedbackInputSchema = z
  .object({
    interviewId: z.string().trim().min(1).max(200).refine((id) => !id.includes("/")),
    transcript: z.array(transcriptEntrySchema).min(1).max(100),
  })
  .refine(
    ({ transcript }) =>
      transcript.reduce((length, entry) => length + entry.content.length, 0) <= 50_000,
    { message: "Transcript is too long.", path: ["transcript"] },
  );

type CreateFeedbackInput = {
  interviewId: string;
  transcript: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
};

const getFeedbackDocumentId = (interviewId: string, userId: string) =>
  `${userId}_${interviewId}`;

export async function createFeedback(params: CreateFeedbackInput) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, feedbackId: null, message: "Unauthorized." };
    }

    const input = createFeedbackInputSchema.safeParse(params);

    if (!input.success) {
      return { success: false, feedbackId: null, message: "Invalid feedback data." };
    }

    const { interviewId, transcript } = input.data;
    const interview = await db.collection("Interview").doc(interviewId).get();

    if (!interview.exists) {
      return { success: false, feedbackId: null, message: "Interview not found." };
    }

    const formattedTranscript = transcript
      .map(({ role, content }) => `${role}: ${content}`)
      .join("\n");

    const { output: generatedFeedback } = await generateText({
      model: google(process.env.GOOGLE_GENERATIVE_AI_MODEL?.trim() || "gemini-3.6-flash"),
      output: Output.object({
        schema: feedbackSchema,
        name: "interview_feedback",
        description: "A structured evaluation of a completed mock interview.",
      }),
      system:
        "You are a professional interviewer evaluating a mock interview. Follow the requested schema exactly and base every score and comment only on the transcript.",
      prompt: `Evaluate this mock interview. Be specific, fair, and candid.

Use exactly these five categories in this exact order:
1. Communication Skills
2. Technical Knowledge
3. Problem Solving
4. Cultural Fit
5. Confidence and Clarity

Give every category and the total score a number from 0 through 100. Include concrete strengths, concrete areas for improvement, and a concise final assessment.

Transcript:
<transcript>
${formattedTranscript}
</transcript>`,
    });

    const feedbackId = getFeedbackDocumentId(interviewId, user.id);
    const now = new Date().toISOString();

    await db.collection("feedback").doc(feedbackId).set({
      interviewId,
      userId: user.id,
      ...generatedFeedback,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, feedbackId, message: "Feedback created." };
  } catch (error) {
    console.error("Failed to create interview feedback", error);
    return { success: false, feedbackId: null, message: "Could not create feedback." };
  }
}
