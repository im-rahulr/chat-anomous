// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc,
    getDoc,
    deleteDoc,
    query,
    orderBy,
    onSnapshot,
    runTransaction,
    writeBatch
} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

// Firebase configuration
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

// Global variables
let stats = {
    totalPosts: 0,
    totalComments: 0,
    totalReactions: 0,
    deletedPosts: 0
};

let activeListeners = {};
let postToDelete = null;

// DOM Elements
const postsContainer = document.getElementById('postsContainer');
const loadingOverlay = document.getElementById('loadingOverlay');
const confirmDialog = document.getElementById('confirmDialog');
const cancelDeleteBtn = document.getElementById('cancelDelete');
const confirmDeleteBtn = document.getElementById('confirmDelete');

// Initialize admin panel
document.addEventListener('DOMContentLoaded', () => {
    initializeAdminPanel();
    
    // Set up event listeners
    cancelDeleteBtn.addEventListener('click', closeDeleteDialog);
    confirmDeleteBtn.addEventListener('click', executeDeletePost);
    
    // Handle cleanup when leaving the page
    window.addEventListener('beforeunload', cleanupListeners);
});

// Initialize the admin panel
function initializeAdminPanel() {
    // Show loading overlay
    showLoadingOverlay();
    
    // Set up real-time listeners for tweets
    setupTweetsListener();
}

// Set up real-time listener for tweets
function setupTweetsListener() {
    try {
        const tweetsRef = collection(db, 'tweets');
        const q = query(tweetsRef, orderBy('timestamp', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            // Clear existing posts
            postsContainer.innerHTML = '';
            
            // Reset post count
            stats.totalPosts = snapshot.size;
            updateStatDisplay();
            
            // Process each tweet
            snapshot.forEach(doc => {
                const tweetData = {
                    id: doc.id,
                    ...doc.data()
                };
                
                // Create and add post element
                const postElement = createPostElement(tweetData);
                postsContainer.appendChild(postElement);
                
                // Set up reaction and comment listeners
                setupReactionListener(tweetData.id);
                setupCommentListener(tweetData.id);
            });
            
            // Hide loading overlay
            hideLoadingOverlay();
        }, (error) => {
            console.error("Error setting up tweet listener:", error);
            showNotification('Failed to load posts. Please refresh the page.', 'error');
            hideLoadingOverlay();
        });
        
        // Store the unsubscribe function
        activeListeners.tweets = unsubscribe;
        
    } catch (error) {
        console.error("Error setting up tweet listener:", error);
        showNotification('Failed to load posts. Please refresh the page.', 'error');
        hideLoadingOverlay();
    }
}

// Set up real-time listener for reactions
function setupReactionListener(tweetId) {
    try {
        const reactionsRef = collection(db, 'tweets', tweetId, 'reactions');
        
        const unsubscribe = onSnapshot(reactionsRef, (snapshot) => {
            // Count reactions by emoji
            const reactions = {};
            let totalReactions = 0;
            
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.emoji) {
                    reactions[data.emoji] = (reactions[data.emoji] || 0) + 1;
                    totalReactions++;
                }
            });
            
            // Update reactions UI
            updateReactionsUI(tweetId, reactions);
            
            // Update total reactions count (across all tweets)
            updateReactionStats();
            
        }, (error) => {
            console.error(`Error setting up reaction listener for tweet ${tweetId}:`, error);
        });
        
        // Store the unsubscribe function
        activeListeners[`reactions_${tweetId}`] = unsubscribe;
        
    } catch (error) {
        console.error(`Error setting up reaction listener for tweet ${tweetId}:`, error);
    }
}

// Set up real-time listener for comments
function setupCommentListener(tweetId) {
    try {
        const commentsRef = collection(db, 'tweets', tweetId, 'comments');
        const q = query(commentsRef, orderBy('timestamp', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            // Update comment count
            const commentCount = snapshot.size;
            updateCommentCount(tweetId, commentCount);
            
            // Store comments data for viewing
            const comments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Update comments display if visible
            const commentsSection = document.querySelector(`.post-card[data-tweet-id="${tweetId}"] .comments-section`);
            if (commentsSection && commentsSection.classList.contains('visible')) {
                renderComments(commentsSection, comments);
            }
            
            // Update total comments count (across all tweets)
            updateCommentStats();
            
        }, (error) => {
            console.error(`Error setting up comment listener for tweet ${tweetId}:`, error);
        });
        
        // Store the unsubscribe function
        activeListeners[`comments_${tweetId}`] = unsubscribe;
        
    } catch (error) {
        console.error(`Error setting up comment listener for tweet ${tweetId}:`, error);
    }
}

// Create post element
function createPostElement(tweetData) {
    const postCard = document.createElement('div');
    postCard.className = 'post-card';
    postCard.dataset.tweetId = tweetData.id;
    
    // Format timestamp
    const timestamp = tweetData.timestamp ? formatTimestamp(tweetData.timestamp) : 'No timestamp';
    
    // Anonymous handle
    const anonymousHandle = tweetData.tweetNumber ? `@anonymous${tweetData.tweetNumber}` : '@anonymous';
    
    postCard.innerHTML = `
        <div class="post-header">
            <div class="post-author">
                <div class="post-author-avatar">
                    <i class="fas fa-user-secret"></i>
                </div>
                <div class="post-author-info">
                    <div class="post-author-name">Anonymous</div>
                    <div class="post-author-handle">${anonymousHandle}</div>
                </div>
            </div>
            <div class="post-timestamp">${timestamp}</div>
        </div>
        <div class="post-content">${tweetData.content}</div>
        <div class="reactions-container"></div>
        <div class="post-actions">
            <div class="post-interactions">
                <div class="interaction-item comment-count" data-tweet-id="${tweetData.id}">
                    <i class="far fa-comment"></i>
                    <span>0</span>
                </div>
                <div class="interaction-item">
                    <i class="far fa-smile"></i>
                    <span>Reactions</span>
                </div>
            </div>
            <button class="delete-btn" data-tweet-id="${tweetData.id}">
                <i class="fas fa-trash-alt"></i>
                Delete Post
            </button>
        </div>
        <div class="comments-section">
            <div class="comments-list"></div>
        </div>
    `;
    
    // Add event listener for delete button
    const deleteBtn = postCard.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => {
        showDeleteDialog(tweetData.id);
    });
    
    // Add event listener for comment count to toggle comments
    const commentCount = postCard.querySelector('.comment-count');
    commentCount.addEventListener('click', () => {
        toggleComments(tweetData.id);
    });
    
    return postCard;
}

// Update reactions UI
function updateReactionsUI(tweetId, reactions) {
    const reactionsContainer = document.querySelector(`.post-card[data-tweet-id="${tweetId}"] .reactions-container`);
    if (!reactionsContainer) return;
    
    reactionsContainer.innerHTML = '';
    
    // Add reaction badges
    Object.entries(reactions).forEach(([emoji, count]) => {
        if (count > 0) {
            const reactionBadge = document.createElement('div');
            reactionBadge.className = 'reaction-badge';
            reactionBadge.innerHTML = `
                <span class="reaction-emoji">${emoji}</span>
                <span class="reaction-count">${count}</span>
            `;
            reactionsContainer.appendChild(reactionBadge);
        }
    });
}

// Update comment count display
function updateCommentCount(tweetId, count) {
    const commentCountEl = document.querySelector(`.comment-count[data-tweet-id="${tweetId}"] span`);
    if (commentCountEl) {
        commentCountEl.textContent = count;
    }
}

// Toggle comments section
function toggleComments(tweetId) {
    const postCard = document.querySelector(`.post-card[data-tweet-id="${tweetId}"]`);
    if (!postCard) return;
    
    const commentsSection = postCard.querySelector('.comments-section');
    commentsSection.classList.toggle('visible');
    
    // If opening comments, load them
    if (commentsSection.classList.contains('visible')) {
        loadComments(tweetId, commentsSection);
    }
}

// Load comments for a tweet
async function loadComments(tweetId, commentsSection) {
    // Show loading state
    commentsSection.innerHTML = '<div class="loading-comments">Loading comments...</div>';
    
    try {
        // Use existing listener data, comments are already loaded in memory
        const commentsListEl = document.createElement('div');
        commentsListEl.className = 'comments-list';
        
        // Get comments from Firestore
        const commentsRef = collection(db, 'tweets', tweetId, 'comments');
        const q = query(commentsRef, orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            commentsListEl.innerHTML = '<div class="no-comments">No comments yet</div>';
        } else {
            const comments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            renderComments(commentsListEl, comments);
        }
        
        // Replace loading with comments
        commentsSection.innerHTML = '';
        commentsSection.appendChild(commentsListEl);
        
    } catch (error) {
        console.error("Error loading comments:", error);
        commentsSection.innerHTML = '<div class="error-loading">Error loading comments</div>';
    }
}

// Render comments
function renderComments(container, comments) {
    container.innerHTML = '';
    
    if (comments.length === 0) {
        container.innerHTML = '<div class="no-comments">No comments yet</div>';
        return;
    }
    
    // Group comments by parent ID
    const topLevelComments = comments.filter(comment => !comment.parentId);
    const repliesByParentId = {};
    
    comments.filter(comment => comment.parentId).forEach(reply => {
        if (!repliesByParentId[reply.parentId]) {
            repliesByParentId[reply.parentId] = [];
        }
        repliesByParentId[reply.parentId].push(reply);
    });
    
    // Render top-level comments
    topLevelComments.forEach(comment => {
        const commentEl = createCommentElement(comment);
        
        // Add replies if any
        const replies = repliesByParentId[comment.id] || [];
        if (replies.length > 0) {
            const repliesContainer = document.createElement('div');
            repliesContainer.className = 'replies-container';
            
            replies.forEach(reply => {
                const replyEl = createCommentElement(reply);
                replyEl.classList.add('reply');
                repliesContainer.appendChild(replyEl);
            });
            
            commentEl.appendChild(repliesContainer);
        }
        
        container.appendChild(commentEl);
    });
}

// Create comment element
function createCommentElement(comment) {
    const commentEl = document.createElement('div');
    commentEl.className = 'comment';
    commentEl.dataset.commentId = comment.id;
    
    const timestamp = comment.timestamp ? formatTimestamp(comment.timestamp) : 'Just now';
    
    commentEl.innerHTML = `
        <div class="comment-avatar">
            <i class="fas fa-user-secret"></i>
        </div>
        <div class="comment-content">
            <span class="comment-author">
                Anonymous
                ${comment.isAuthor ? '<span class="author-tag">Author</span>' : ''}
            </span>
            <p class="comment-text">${comment.text}</p>
            <span class="comment-time">${timestamp}</span>
        </div>
    `;
    
    return commentEl;
}

// Show delete confirmation dialog
function showDeleteDialog(tweetId) {
    postToDelete = tweetId;
    confirmDialog.classList.add('visible');
}

// Close delete confirmation dialog
function closeDeleteDialog() {
    confirmDialog.classList.remove('visible');
    postToDelete = null;
}

// Execute post deletion
async function executeDeletePost() {
    if (!postToDelete) {
        closeDeleteDialog();
        return;
    }
    
    const tweetId = postToDelete;
    
    // Show loading state
    confirmDeleteBtn.textContent = 'Deleting...';
    confirmDeleteBtn.disabled = true;
    
    try {
        // Delete the post and its subcollections
        await deleteTweetAndAllSubcollections(tweetId);
        
        // Update stats
        stats.deletedPosts++;
        updateStatDisplay();
        
        // Close dialog
        closeDeleteDialog();
        
        // Show success notification
        showNotification('Post deleted successfully', 'success');
        
    } catch (error) {
        console.error("Error deleting post:", error);
        showNotification('Failed to delete post. Please try again.', 'error');
        
    } finally {
        // Reset button state
        confirmDeleteBtn.textContent = 'Delete';
        confirmDeleteBtn.disabled = false;
    }
}

// Delete tweet and all its subcollections
async function deleteTweetAndAllSubcollections(tweetId) {
    try {
        // Use batch to delete all subcollections
        const batch = writeBatch(db);
        
        // Delete comments
        const commentsSnapshot = await getDocs(collection(db, 'tweets', tweetId, 'comments'));
        commentsSnapshot.forEach(commentDoc => {
            batch.delete(doc(db, 'tweets', tweetId, 'comments', commentDoc.id));
        });
        
        // Delete reactions
        const reactionsSnapshot = await getDocs(collection(db, 'tweets', tweetId, 'reactions'));
        reactionsSnapshot.forEach(reactionDoc => {
            batch.delete(doc(db, 'tweets', tweetId, 'reactions', reactionDoc.id));
        });
        
        // Delete likes
        const likesSnapshot = await getDocs(collection(db, 'tweets', tweetId, 'likes'));
        likesSnapshot.forEach(likeDoc => {
            batch.delete(doc(db, 'tweets', tweetId, 'likes', likeDoc.id));
        });
        
        // Commit the batch
        await batch.commit();
        
        // Delete the tweet document
        await deleteDoc(doc(db, 'tweets', tweetId));
        
        return true;
    } catch (error) {
        console.error("Error deleting tweet and subcollections:", error);
        throw error;
    }
}

// Update stats display
function updateStatDisplay() {
    document.getElementById('totalPosts').textContent = stats.totalPosts;
    document.getElementById('totalComments').textContent = stats.totalComments;
    document.getElementById('totalReactions').textContent = stats.totalReactions;
    document.getElementById('deletedPosts').textContent = stats.deletedPosts;
}

// Update total reactions count across all tweets
async function updateReactionStats() {
    let totalReactions = 0;
    
    try {
        const tweetsRef = collection(db, 'tweets');
        const tweetsSnapshot = await getDocs(tweetsRef);
        
        for (const tweetDoc of tweetsSnapshot.docs) {
            const reactionsRef = collection(db, 'tweets', tweetDoc.id, 'reactions');
            const reactionsSnapshot = await getDocs(reactionsRef);
            totalReactions += reactionsSnapshot.size;
        }
        
        stats.totalReactions = totalReactions;
        updateStatDisplay();
        
    } catch (error) {
        console.error("Error updating reaction stats:", error);
    }
}

// Update total comments count across all tweets
async function updateCommentStats() {
    let totalComments = 0;
    
    try {
        const tweetsRef = collection(db, 'tweets');
        const tweetsSnapshot = await getDocs(tweetsRef);
        
        for (const tweetDoc of tweetsSnapshot.docs) {
            const commentsRef = collection(db, 'tweets', tweetDoc.id, 'comments');
            const commentsSnapshot = await getDocs(commentsRef);
            totalComments += commentsSnapshot.size;
        }
        
        stats.totalComments = totalComments;
        updateStatDisplay();
        
    } catch (error) {
        console.error("Error updating comment stats:", error);
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notificationContainer = document.getElementById('notificationContainer');
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notificationContainer.appendChild(notification);
    
    // Show with animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after delay
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Format timestamp
function formatTimestamp(timestamp) {
    if (!timestamp) return 'Just now';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = (now - date) / 1000; // difference in seconds
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    
    // Format date
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Show loading overlay
function showLoadingOverlay() {
    loadingOverlay.style.display = 'flex';
}

// Hide loading overlay
function hideLoadingOverlay() {
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
        loadingOverlay.style.display = 'none';
        loadingOverlay.style.opacity = '1';
    }, 300);
}

// Cleanup all listeners
function cleanupListeners() {
    Object.values(activeListeners).forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
            unsubscribe();
        }
    });
}

// Initial stats update
updateReactionStats();
updateCommentStats(); 