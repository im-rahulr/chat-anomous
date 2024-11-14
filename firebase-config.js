// Initialize Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    orderBy, 
    query,
    doc,
    setDoc,
    deleteDoc,
    serverTimestamp,
    getDoc
} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyAF2KE_3JSoDHvie72zrHaUsCE5aQdlcdk",
    authDomain: "anomouse-87b9a.firebaseapp.com",
    projectId: "anomouse-87b9a",
    storageBucket: "anomouse-87b9a.appspot.com",
    messagingSenderId: "886910904250",
    appId: "1:886910904250:web:68f2ca1a2ab99c35669f83",
    measurementId: "G-29B4L74EJQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper function to generate/get user ID
function getUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userId', userId);
    }
    return userId;
}

export const dbOperations = {
    addTweet: async (tweetData) => {
        try {
            const docRef = await addDoc(collection(db, 'tweets'), {
                content: tweetData.content,
                tweetNumber: tweetData.tweetNumber,
                timestamp: serverTimestamp(),
                userId: getUserId()
            });
            return docRef.id;
        } catch (error) {
            console.error("Error adding tweet: ", error);
            throw error;
        }
    },

    getTweets: async () => {
        try {
            const tweetsRef = collection(db, 'tweets');
            const q = query(tweetsRef, orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error getting tweets: ", error);
            throw error;
        }
    },

    addComment: async (tweetId, comment) => {
        try {
            const commentRef = await addDoc(
                collection(db, 'tweets', tweetId, 'comments'),
                {
                    text: comment.text,
                    isAuthor: comment.isAuthor,
                    userId: getUserId(),
                    timestamp: serverTimestamp()
                }
            );
            return {
                id: commentRef.id,
                ...comment,
                timestamp: new Date()
            };
        } catch (error) {
            console.error("Error adding comment: ", error);
            throw error;
        }
    },

    getComments: async (tweetId) => {
        try {
            const commentsRef = collection(db, 'tweets', tweetId, 'comments');
            const q = query(commentsRef, orderBy('timestamp', 'desc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error getting comments: ", error);
            throw error;
        }
    },

    addLike: async (tweetId) => {
        try {
            const userId = getUserId();
            const likeRef = doc(db, 'tweets', tweetId, 'likes', userId);
            
            // Check if like already exists
            const likeDoc = await getDoc(likeRef);
            if (!likeDoc.exists()) {
                await setDoc(likeRef, {
                    userId: userId,
                    timestamp: serverTimestamp()
                });
                console.log('Like added successfully');
            }
        } catch (error) {
            console.error("Error adding like:", error);
            throw error;
        }
    },

    removeLike: async (tweetId) => {
        try {
            const userId = getUserId();
            const likeRef = doc(db, 'tweets', tweetId, 'likes', userId);
            await deleteDoc(likeRef);
            console.log('Like removed successfully');
        } catch (error) {
            console.error("Error removing like:", error);
            throw error;
        }
    },

    getLikes: async (tweetId) => {
        try {
            const likesRef = collection(db, 'tweets', tweetId, 'likes');
            const snapshot = await getDocs(likesRef);
            const likes = snapshot.docs.map(doc => doc.id);
            console.log('Likes retrieved:', likes);
            return likes;
        } catch (error) {
            console.error("Error getting likes:", error);
            throw error;
        }
    },

    addReaction: async (tweetId, userId, emoji) => {
        try {
            const reactionRef = doc(db, 'tweets', tweetId, 'reactions', userId);
            await setDoc(reactionRef, {
                emoji: emoji,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("Error adding reaction:", error);
            throw error;
        }
    },

    getReactions: async (tweetId) => {
        try {
            const reactionsRef = collection(db, 'tweets', tweetId, 'reactions');
            const snapshot = await getDocs(reactionsRef);
            const reactions = {};
            snapshot.forEach(doc => {
                const emoji = doc.data().emoji;
                reactions[emoji] = (reactions[emoji] || 0) + 1;
            });
            return reactions;
        } catch (error) {
            console.error("Error getting reactions:", error);
            throw error;
        }
    },

    // Add comment to a tweet
    addComment: async function(tweetId, commentText) {
        try {
            const commentRef = await addDoc(collection(db, 'tweets', tweetId, 'comments'), {
                text: commentText,
                userId: getUserId(),
                timestamp: serverTimestamp(),
                isAuthor: true // This will be true for the comment creator
            });
            return commentRef.id;
        } catch (error) {
            console.error("Error adding comment: ", error);
            throw error;
        }
    },

    // Get comments for a tweet
    getComments: async function(tweetId) {
        try {
            const commentsRef = collection(db, 'tweets', tweetId, 'comments');
            const q = query(commentsRef, orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                isAuthor: doc.data().userId === getUserId()
            }));
        } catch (error) {
            console.error("Error getting comments: ", error);
            throw error;
        }
    }
};

export { getUserId }; 