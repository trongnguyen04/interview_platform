import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const getRequiredEnvironmentVariable = (name: string) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value;
};

const normalizePrivateKey = (value: string) => {
  const unquoted =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
      ? value.slice(1, -1)
      : value;
  const privateKey = unquoted.replace(/\\n/g, "\n").trim();

  if (
    !privateKey.startsWith("-----BEGIN PRIVATE KEY-----") ||
    !privateKey.endsWith("-----END PRIVATE KEY-----")
  ) {
    throw new Error(
      "FIREBASE_PRIVATE_KEY must contain a complete PEM private key with BEGIN and END markers.",
    );
  }

  return privateKey;
};

const existingApp = getApps().find((app) => app.name === "[DEFAULT]");

const adminApp =
  existingApp ??
  initializeApp({
    credential: cert({
      projectId: getRequiredEnvironmentVariable("FIREBASE_PROJECT_ID"),
      clientEmail: getRequiredEnvironmentVariable("FIREBASE_CLIENT_EMAIL"),
      privateKey: normalizePrivateKey(
        getRequiredEnvironmentVariable("FIREBASE_PRIVATE_KEY"),
      ),
    }),
  });

export const auth = getAuth(adminApp);
export const db = getFirestore(adminApp);
