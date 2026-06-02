import admin from 'firebase-admin';

// Khởi tạo Firebase Admin SDK
// Có 2 cách để cấu hình:
// 1. Sử dụng Service Account Key (file JSON) - Khuyên dùng cho production
// 2. Sử dụng Application Default Credentials - Dùng cho development

let firebaseAdmin = null;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    // Cách 1: Sử dụng Service Account Key file
    const serviceAccount = await import(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, {
      assert: { type: 'json' }
    });

    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount.default)
    });
  } else if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    // Cách 2: Sử dụng environment variables
    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Private key phải decode newline characters
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
  } else {
    console.warn('Firebase Admin not configured. Phone authentication will not work.');
  }
} catch (error) {
  console.error('Error initializing Firebase Admin:', error.message);
}

/**
 * Xác thực Firebase ID Token
 * @param {string} idToken - Firebase ID Token từ client
 * @returns {Promise<DecodedIdToken>} - Decoded token chứa uid, phoneNumber, etc.
 */
export const verifyFirebaseToken = async (idToken) => {
  if (!firebaseAdmin) {
    throw new Error('Firebase Admin is not initialized');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    throw new Error('Invalid Firebase token');
  }
};

export default firebaseAdmin;
