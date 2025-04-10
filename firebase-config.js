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
    // Helper function to get Firestore instance
    getFirestoreInstance: () => {
        return db;
    },

    addTweet: async (tweetData) => {
        try {
            // Generate a username and profile for this tweet
            const username = tweetData.username || null;
            const profileImage = tweetData.profileImage || null;
            
            const docRef = await addDoc(collection(db, 'tweets'), {
                content: tweetData.content,
                tweetNumber: tweetData.tweetNumber,
                timestamp: serverTimestamp(),
                userId: getUserId(),
                username: username,
                profileImage: profileImage,
                isAdmin: tweetData.isAdmin || false
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
            // Handle both object with text property and direct string
            const text = typeof commentText === 'object' ? commentText.text : commentText;
            const username = typeof commentText === 'object' ? commentText.username : null;
            const profileImage = typeof commentText === 'object' ? commentText.profileImage : null;
            
            const commentData = {
                text: text,
                userId: getUserId(),
                timestamp: serverTimestamp(),
                parentId: parentCommentId,
                isAuthor: false, // Default, will be updated when checking author
                username: username,
                profileImage: profileImage
            };
            
            // Check if user is the author of the tweet
            const tweetRef = doc(db, 'tweets', tweetId);
            const tweetDoc = await getDoc(tweetRef);
            if (tweetDoc.exists() && tweetDoc.data().userId === getUserId()) {
                commentData.isAuthor = true;
            }
            
            const commentRef = await addDoc(collection(db, 'tweets', tweetId, 'comments'), commentData);
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
    },

    checkLike: async (tweetId, userId) => {
        try {
            if (!userId) userId = getUserId();
            const likeRef = doc(db, 'tweets', tweetId, 'likes', userId);
            const likeDoc = await getDoc(likeRef);
            return likeDoc.exists();
        } catch (error) {
            console.error("Error checking like:", error);
            return false;
        }
    },
    
    // Admin panel functions
    getStats: async () => {
        try {
            // Get total posts
            const tweetsRef = collection(db, 'tweets');
            const tweetsSnapshot = await getDocs(tweetsRef);
            const totalPosts = tweetsSnapshot.size;
            
            // Get unique users
            const userIds = new Set();
            tweetsSnapshot.forEach(doc => {
                const userData = doc.data();
                if (userData.userId) {
                    userIds.add(userData.userId);
                }
            });
            
            // Get total likes
            let totalLikes = 0;
            for (const tweetDoc of tweetsSnapshot.docs) {
                const likesRef = collection(db, 'tweets', tweetDoc.id, 'likes');
                const likesSnapshot = await getDocs(likesRef);
                totalLikes += likesSnapshot.size;
            }
            
            // Get recent activity
            const recentActivity = [];
            const q = query(tweetsRef, orderBy('timestamp', 'desc'));
            const recentTweetsSnapshot = await getDocs(q);
            
            recentTweetsSnapshot.docs.slice(0, 5).forEach(doc => {
                const data = doc.data();
                recentActivity.push({
                    action: `New post created by user ${data.userId?.substring(0, 5)}...`,
                    timestamp: data.timestamp
                });
            });
            
            return {
                totalPosts,
                totalLikes,
                uniqueUsers: userIds.size,
                recentActivity
            };
        } catch (error) {
            console.error("Error getting stats:", error);
            throw error;
        }
    },
    
    clearAllPosts: async () => {
        try {
            const tweetsRef = collection(db, 'tweets');
            const querySnapshot = await getDocs(tweetsRef);
            
            // Delete each tweet document
            const deletePromises = querySnapshot.docs.map(async (tweetDoc) => {
                // First delete all subcollections (likes, comments, reactions)
                const likesRef = collection(db, 'tweets', tweetDoc.id, 'likes');
                const likesSnapshot = await getDocs(likesRef);
                likesSnapshot.forEach(likeDoc => {
                    deleteDoc(doc(db, 'tweets', tweetDoc.id, 'likes', likeDoc.id));
                });
                
                const commentsRef = collection(db, 'tweets', tweetDoc.id, 'comments');
                const commentsSnapshot = await getDocs(commentsRef);
                commentsSnapshot.forEach(commentDoc => {
                    deleteDoc(doc(db, 'tweets', tweetDoc.id, 'comments', commentDoc.id));
                });
                
                const reactionsRef = collection(db, 'tweets', tweetDoc.id, 'reactions');
                const reactionsSnapshot = await getDocs(reactionsRef);
                reactionsSnapshot.forEach(reactionDoc => {
                    deleteDoc(doc(db, 'tweets', tweetDoc.id, 'reactions', reactionDoc.id));
                });
                
                // Finally delete the tweet document itself
                return deleteDoc(doc(db, 'tweets', tweetDoc.id));
            });
            
            await Promise.all(deletePromises);
            return true;
        } catch (error) {
            console.error("Error clearing posts:", error);
            throw error;
        }
    },
    
    exportData: async () => {
        try {
            const tweetsRef = collection(db, 'tweets');
            const querySnapshot = await getDocs(tweetsRef);
            
            const tweetsData = [];
            
            for (const tweetDoc of querySnapshot.docs) {
                const tweetData = {
                    id: tweetDoc.id,
                    ...tweetDoc.data(),
                    likes: [],
                    comments: [],
                    reactions: []
                };
                
                // Get likes
                const likesRef = collection(db, 'tweets', tweetDoc.id, 'likes');
                const likesSnapshot = await getDocs(likesRef);
                tweetData.likes = likesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                // Get comments
                const commentsRef = collection(db, 'tweets', tweetDoc.id, 'comments');
                const commentsSnapshot = await getDocs(commentsRef);
                tweetData.comments = commentsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                // Get reactions
                const reactionsRef = collection(db, 'tweets', tweetDoc.id, 'reactions');
                const reactionsSnapshot = await getDocs(reactionsRef);
                tweetData.reactions = reactionsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                tweetsData.push(tweetData);
            }
            
            return {
                exportDate: new Date().toISOString(),
                tweets: tweetsData
            };
        } catch (error) {
            console.error("Error exporting data:", error);
            throw error;
        }
    },

    // Add functions for reporting/flagging posts
    flagPost: async (tweetId, reason = 'inappropriate content') => {
        try {
            const userId = getUserId();
            const flagRef = doc(db, 'tweets', tweetId, 'flags', userId);
            
            // Create flag document
            await setDoc(flagRef, {
                userId: userId,
                reason: reason,
                timestamp: serverTimestamp()
            });
            
            // Get current flag count or default to 0
            const tweetRef = doc(db, 'tweets', tweetId);
            const tweetDoc = await getDoc(tweetRef);
            const currentFlagCount = tweetDoc.exists() ? (tweetDoc.data().flagCount || 0) : 0;
            
            // Update flag count in the main tweet document
            await updateDoc(tweetRef, {
                flagCount: currentFlagCount + 1
            });
            
            console.log(`Post ${tweetId} flagged successfully. New flag count: ${currentFlagCount + 1}`);
            return true;
        } catch (error) {
            console.error("Error flagging post:", error);
            throw error;
        }
    },
    
    // Get all flags for a post
    getFlags: async (tweetId) => {
        try {
            const flagsRef = collection(db, 'tweets', tweetId, 'flags');
            const snapshot = await getDocs(flagsRef);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error getting flags:", error);
            throw error;
        }
    },
    
    // Check if user has already flagged a post
    hasUserFlagged: async (tweetId) => {
        try {
            const userId = getUserId();
            const flagRef = doc(db, 'tweets', tweetId, 'flags', userId);
            const flagDoc = await getDoc(flagRef);
            return flagDoc.exists();
        } catch (error) {
            console.error("Error checking flag status:", error);
            throw error;
        }
    },
    
    // Get all flagged posts (for admin panel)
    getFlaggedPosts: async () => {
        try {
            const postsRef = collection(db, 'tweets');
            const q = query(postsRef, where('flagCount', '>', 0), orderBy('flagCount', 'desc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error getting flagged posts:", error);
            throw error;
        }
    },

    // Add new function to get a single tweet
    getTweetData: async (tweetId) => {
        try {
            const tweetRef = doc(db, 'tweets', tweetId);
            const tweetDoc = await getDoc(tweetRef);
            
            if (tweetDoc.exists()) {
                return {
                    id: tweetDoc.id,
                    ...tweetDoc.data()
                };
            } else {
                return null;
            }
        } catch (error) {
            console.error("Error getting tweet data:", error);
            throw error;
        }
    }
};

export { getUserId, collection, doc, onSnapshot }; 