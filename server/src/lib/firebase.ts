import admin from "firebase-admin";
import { readFileSync } from "node:fs";

function loadCredential(): admin.credential.Credential {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    return admin.credential.cert(JSON.parse(inline));
  }
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path) {
    const json = JSON.parse(readFileSync(path, "utf8"));
    return admin.credential.cert(json);
  }
  throw new Error(
    "Firebase Admin credentials missing. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS."
  );
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: loadCredential() });
}

export const firebaseAuth = admin.auth();
