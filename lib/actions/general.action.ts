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

export async function getInterviewsByUserId(userId: string): Promise<Interview[]> {
  if (!userId) return [];

  const interviews = await db
    .collection(INTERVIEW_COLLECTION)
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .get();

  return interviews.docs.map(mapInterview);
}

export async function getLatestInterviews(
  params: GetLatestInterviewsParams,
): Promise<Interview[]> {
  const { userId } = params;
  const requestedLimit = Number.isFinite(params.limit) ? Math.floor(params.limit ?? 20) : 20;
  const limit = Math.min(Math.max(requestedLimit, 1), 50);

  // Firestore requires an inequality field to be the first orderBy field.
  // Fetch a larger latest set and remove the current user's interviews on the
  // server so the result can remain ordered by createdAt.
  const interviews = await db
    .collection(INTERVIEW_COLLECTION)
    .where("finalized", "==", true)
    .orderBy("createdAt", "desc")
    .limit(Math.min(limit * 3, 100))
    .get();

  return interviews.docs
    .map(mapInterview)
    .filter((interview) => interview.userId !== userId)
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
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (legacyFeedback.empty) return null;

  return mapFeedback(legacyFeedback.docs[0]);
}
