import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, writeBatch } from "firebase/firestore";
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env' }); // Make sure we hit the frontend root env

const stripQuotes = (str: string | undefined) => str ? str.replace(/^["']|["']$/g, '') : '';

const firebaseConfig = {
    apiKey: stripQuotes(process.env.VITE_FIREBASE_API_KEY),
    authDomain: stripQuotes(process.env.VITE_FIREBASE_AUTH_DOMAIN),
    projectId: stripQuotes(process.env.VITE_FIREBASE_PROJECT_ID),
    storageBucket: stripQuotes(process.env.VITE_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: stripQuotes(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
    appId: stripQuotes(process.env.VITE_FIREBASE_APP_ID)
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function repairPartnerCounts() {
    console.log("Starting partner count repair...");
    try {
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);

        const partnershipsRef = collection(db, 'partnerships');
        const partnershipsSnapshot = await getDocs(partnershipsRef);

        // 1. Tally true partners
        const realCounts: Record<string, number> = {};

        partnershipsSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'accepted') {
                realCounts[data.user1] = (realCounts[data.user1] || 0) + 1;
                realCounts[data.user2] = (realCounts[data.user2] || 0) + 1;
            }
        });

        console.log("True Partner Tally:", realCounts);

        // 2. Batch write the corrected counts
        const batch = writeBatch(db);
        let count = 0;

        usersSnapshot.forEach((docSnap) => {
            const uid = docSnap.id;
            const currentData = docSnap.data();
            const correctCount = realCounts[uid] || 0;

            if (currentData.partnersCount !== correctCount) {
                console.log(`Fixing User ${uid}: ${currentData.partnersCount} -> ${correctCount}`);
                batch.update(docSnap.ref, { partnersCount: correctCount });
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
            console.log(`Successfully repaired ${count} user profiles.`);
        } else {
            console.log("No profiles needed repairing.");
        }

        process.exit(0);

    } catch (error) {
        console.error("Error repairing counts:", error);
        process.exit(1);
    }
}

repairPartnerCounts();
