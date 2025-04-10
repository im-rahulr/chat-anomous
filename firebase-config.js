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
    getDoc,
    onSnapshot,
    where,
    updateDoc,
    arrayUnion,
    increment
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

    addReaction: async (tweetId, emoji) => {
        try {
            const userId = getUserId();
            const reactionRef = doc(db, 'tweets', tweetId, 'reactions', userId);
            
            // First check if user already reacted
            const reactionDoc = await getDoc(reactionRef);
            
            if (reactionDoc.exists()) {
                // Update existing reaction
                await updateDoc(reactionRef, {
                    emoji: emoji,
                    timestamp: serverTimestamp()
                });
            } else {
                // Create new reaction
                await setDoc(reactionRef, {
                    emoji: emoji,
                    userId: userId,
                    timestamp: serverTimestamp()
                });
            }
            
            // Update reaction count in the tweet document
            const tweetRef = doc(db, 'tweets', tweetId);
            await updateDoc(tweetRef, {
                [`reactionCounts.${emoji}`]: increment(1)
            });
            
            return true;
        } catch (error) {
            console.error("Error adding reaction:", error);
            throw error;
        }
    },

    removeReaction: async (tweetId, emoji) => {
        try {
            const userId = getUserId();
            const reactionRef = doc(db, 'tweets', tweetId, 'reactions', userId);
            
            // Check if reaction exists
            const reactionDoc = await getDoc(reactionRef);
            if (reactionDoc.exists()) {
                // Update reaction count in the tweet document
                const tweetRef = doc(db, 'tweets', tweetId);
                await updateDoc(tweetRef, {
                    [`reactionCounts.${emoji}`]: increment(-1)
                });
                
                // Delete the reaction
                await deleteDoc(reactionRef);
            }
            
            return true;
        } catch (error) {
            console.error("Error removing reaction:", error);
            throw error;
        }
    },

    getReactions: async (tweetId) => {
        try {
            const reactionsRef = collection(db, 'tweets', tweetId, 'reactions');
            const snapshot = await getDocs(reactionsRef);
            
            // Group reactions by emoji
            const reactions = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                const emoji = data.emoji;
                reactions[emoji] = (reactions[emoji] || 0) + 1;
            });
            
            // Check if current user has reacted
            const userId = getUserId();
            const userReactionRef = doc(db, 'tweets', tweetId, 'reactions', userId);
            const userReactionDoc = await getDoc(userReactionRef);
            
            return {
                counts: reactions,
                userReaction: userReactionDoc.exists() ? userReactionDoc.data().emoji : null
            };
        } catch (error) {
            console.error("Error getting reactions:", error);
            throw error;
        }
    },

    // Enhanced comment methods with thread support
    addComment: async function(tweetId, commentText, parentCommentId = null) {
        try {
            // Determine if this is a top-level comment or a reply
            const commentData = {
                text: commentText,
                userId: getUserId(),
                timestamp: serverTimestamp(),
                parentId: parentCommentId,
                isAuthor: true,
                replies: []
            };
            
            let commentRef;
            if (parentCommentId) {
                // This is a reply to another comment
                commentRef = await addDoc(
                    collection(db, 'tweets', tweetId, 'comments'), 
                    commentData
                );
                
                // Update the parent comment to reference this reply
                const parentRef = doc(db, 'tweets', tweetId, 'comments', parentCommentId);
                await updateDoc(parentRef, {
                    replies: arrayUnion(commentRef.id)
                });
            } else {
                // This is a top-level comment
                commentRef = await addDoc(
                    collection(db, 'tweets', tweetId, 'comments'), 
                    commentData
                );
            }
            
            // Update comment count on the tweet
            const tweetRef = doc(db, 'tweets', tweetId);
            await updateDoc(tweetRef, {
                commentCount: increment(1)
            });
            
            return commentRef.id;
        } catch (error) {
            console.error("Error adding comment: ", error);
            throw error;
        }
    },

    getComments: async function(tweetId) {
        try {
            const commentsRef = collection(db, 'tweets', tweetId, 'comments');
            const q = query(commentsRef, orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            
            const comments = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                isAuthor: doc.data().userId === getUserId()
            }));
            
            // Organize into threads
            const threadedComments = [];
            const commentMap = {};
            
            // First, create a map of comments by ID
            comments.forEach(comment => {
                commentMap[comment.id] = comment;
            });
            
            // Then separate top-level comments and replies
            comments.forEach(comment => {
                if (!comment.parentId) {
                    // This is a top-level comment
                    threadedComments.push(comment);
                }
            });
            
            return threadedComments;
        } catch (error) {
            console.error("Error getting comments: ", error);
            throw error;
        }
    },
    
    // Get replies to a specific comment
    getReplies: async function(tweetId, commentId) {
        try {
            const commentsRef = collection(db, 'tweets', tweetId, 'comments');
            const q = query(commentsRef, where('parentId', '==', commentId), orderBy('timestamp', 'asc'));
            const querySnapshot = await getDocs(q);
            
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                isAuthor: doc.data().userId === getUserId()
            }));
        } catch (error) {
            console.error("Error getting replies: ", error);
            throw error;
        }
    },
    
    // Real-time listeners for tweets, comments, and reactions
    onTweetsUpdate: (callback) => {
        try {
            const tweetsRef = collection(db, 'tweets');
            const q = query(tweetsRef, orderBy('timestamp', 'desc'));
            
            return onSnapshot(q, (snapshot) => {
                const tweets = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                callback(tweets);
            });
        } catch (error) {
            console.error("Error setting up tweet listener:", error);
            throw error;
        }
    },
    
    onCommentsUpdate: (tweetId, callback) => {
        try {
            const commentsRef = collection(db, 'tweets', tweetId, 'comments');
            const q = query(commentsRef, orderBy('timestamp', 'desc'));
            
            return onSnapshot(q, (snapshot) => {
                const comments = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    isAuthor: doc.data().userId === getUserId()
                }));
                callback(comments);
            });
        } catch (error) {
            console.error("Error setting up comment listener:", error);
            throw error;
        }
    },
    
    onReactionsUpdate: (tweetId, callback) => {
        try {
            const reactionsRef = collection(db, 'tweets', tweetId, 'reactions');
            
            return onSnapshot(reactionsRef, async (snapshot) => {
                // Group reactions by emoji
                const reactions = {};
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const emoji = data.emoji;
                    reactions[emoji] = (reactions[emoji] || 0) + 1;
                });
                
                // Check if current user has reacted
                const userId = getUserId();
                const userReactionRef = doc(db, 'tweets', tweetId, 'reactions', userId);
                const userReactionDoc = await getDoc(userReactionRef);
                
                callback({
                    counts: reactions,
                    userReaction: userReactionDoc.exists() ? userReactionDoc.data().emoji : null
                });
            });
        } catch (error) {
            console.error("Error setting up reaction listener:", error);
            throw error;
        }
    },
    
    // Add these new methods for notification support
    getTweetsAfterTimestamp: async (timestamp) => {
        try {
            const tweetsRef = collection(db, 'tweets');
            const q = query(
                tweetsRef, 
                where('timestamp', '>', timestamp),
                orderBy('timestamp', 'desc')
            );
            const querySnapshot = await getDocs(q);
            
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error getting new tweets:", error);
            throw error;
        }
    }
};

export { getUserId }; 