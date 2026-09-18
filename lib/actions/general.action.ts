import "server-only";

import { db } from "@/firebase/admin";

const INTERVIEW_COLLECTION = "Interview";
const FEEDBACK_COLLECTION = "feedback";

const getFeedbackDocumentId = (interviewId: string, userId: string) =>
  `${userId}_${interviewId}`;

const mapInterview = (
  document: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
): Interview => ({
  ...document.data(),
  id: document.id,
}) as Interview;

const mapFeedback = (
  document: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
): Feedback => ({
  ...document.data(),
  id: document.id,
}) as Feedback;

const createdAtTime = (value?: string) => {
  const timestamp = Date.parse(value ?? "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const newestFirst = (left: { createdAt?: string }, right: { createdAt?: string }) =>
  createdAtTime(right.createdAt) - createdAtTime(left.createdAt);

export async function getInterviewsByUserId(userId: string): Promise<Interview[]> {
  if (!userId) return [];

  const interviews = await db
    .collection(INTERVIEW_COLLECTION)
    .where("userId", "==", userId)
    .get();

  return interviews.docs.map(mapInterview).sort(newestFirst);
}

export async function getLatestInterviews(
  params: GetLatestInterviewsParams,
): Promise<Interview[]> {
  const { userId } = params;
  const requestedLimit = Number.isFinite(params.limit) ? Math.floor(params.limit ?? 20) : 20;
  const limit = Math.min(Math.max(requestedLimit, 1), 50);

  // Use Firestore's automatic single-field index. Filtering finalized/current
  // user on the server avoids requiring a composite index in every deployment.
  const interviews = await db
    .collection(INTERVIEW_COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(Math.min(limit * 3, 100))
    .get();

  return interviews.docs
    .map(mapInterview)
    .filter((interview) => interview.finalized && interview.userId !== userId)
    .slice(0, limit);
}

export async function getInterviewsById(id: string): Promise<Interview | null> {
  if (!id || id.includes("/")) return null;

  const interview = await db.collection(INTERVIEW_COLLECTION).doc(id).get();

  if (!interview.exists) return null;

  return mapInterview(interview);
}

export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams,
): Promise<Feedback | null> {
  const { interviewId, userId } = params;

  if (!interviewId || !userId || interviewId.includes("/") || userId.includes("/")) {
    return null;
  }

  const feedbackCollection = db.collection(FEEDBACK_COLLECTION);
  const deterministicFeedback = await feedbackCollection
    .doc(getFeedbackDocumentId(interviewId, userId))
    .get();

  if (deterministicFeedback.exists) {
    return mapFeedback(deterministicFeedback);
  }

  // Keep existing feedback records readable while new writes use one stable ID.
  const legacyFeedback = await feedbackCollection
    .where("interviewId", "==", interviewId)
    .where("userId", "==", userId)
    .get();

  if (legacyFeedback.empty) return null;

  return legacyFeedback.docs.map(mapFeedback).sort(newestFirst)[0] ?? null;
}
