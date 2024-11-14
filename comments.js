// Get references to DOM elements
const commentForms = document.querySelectorAll('.comment-form');
const commentsContainers = document.querySelectorAll('.comments-section');

// Add comment functionality
async function handleCommentSubmit(event, tweetId) {
    event.preventDefault();
    
    const form = event.target;
    const commentInput = form.querySelector('.comment-input');
    const commentText = commentInput.value.trim();
    
    if (!commentText) return;
    
    try {
        // Add comment to Firebase
        await db.collection('comments').add({
            tweetId: tweetId,
            text: commentText,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            author: 'Anonymous' // or user name if you have authentication
        });
        
        // Clear input
        commentInput.value = '';
        
        // Refresh comments
        loadComments(tweetId);
        
    } catch (error) {
        console.error('Error adding comment:', error);
    }
}

// Load comments for a tweet
async function loadComments(tweetId) {
    const commentsContainer = document.querySelector(`#comments-${tweetId}`);
    
    try {
        const snapshot = await db.collection('comments')
            .where('tweetId', '==', tweetId)
            .orderBy('timestamp', 'desc')
            .get();
            
        const comments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Render comments
        renderComments(commentsContainer, comments);
        
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

// Render comments in the container
function renderComments(container, comments) {
    container.innerHTML = comments.map(comment => `
        <div class="comment">
            <div class="comment-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="comment-content">
                <div class="comment-author">
                    ${comment.author}
                    <span class="comment-time">${formatTimestamp(comment.timestamp)}</span>
                </div>
                <div class="comment-text">${comment.text}</div>
            </div>
        </div>
    `).join('');
}

// Format timestamp
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
        .format(Math.round((date - new Date()) / (1000 * 60)), 'minute');
}

// Initialize comments for all tweets
function initializeComments() {
    document.querySelectorAll('.tweet').forEach(tweet => {
        const tweetId = tweet.dataset.tweetId;
        loadComments(tweetId);
        
        // Add submit handler to comment form
        const form = tweet.querySelector('.comment-form');
        form.addEventListener('submit', (e) => handleCommentSubmit(e, tweetId));
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeComments); 