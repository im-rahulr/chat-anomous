// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    getDocs, 
    getDoc,
    doc, 
    query, 
    orderBy, 
    deleteDoc,
    onSnapshot,
    serverTimestamp,
    writeBatch,
    where,
    updateDoc,
    addDoc,
    limit
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

// App state
let currentPostId = null;
let stats = {
    totalPosts: 0,
    totalComments: 0,
    totalLikes: 0,
    uniqueUsers: 0,
    totalFlagged: 0
};
let currentView = 'posts'; // 'posts' or 'flagged'

// DOM elements
const loadingOverlay = document.getElementById('loadingOverlay');
const postsContainer = document.getElementById('postsContainer');
const flaggedPostsContainer = document.getElementById('flaggedPostsContainer');
const postsSection = document.getElementById('postsSection');
const flaggedSection = document.getElementById('flaggedSection');
const confirmDialog = document.getElementById('confirmDialog');
const cancelDeleteBtn = document.getElementById('cancelDelete');
const confirmDeleteBtn = document.getElementById('confirmDelete');
const refreshBtn = document.getElementById('refreshBtn');
const exportBtn = document.getElementById('exportBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const searchInput = document.getElementById('searchInput');
const viewFlaggedBtn = document.getElementById('viewFlaggedBtn');
const backToPostsBtn = document.getElementById('backToPostsBtn');
const totalFlaggedElement = document.getElementById('totalFlagged');
const adminPostButton = document.getElementById('adminPostButton');
const adminPostInput = document.getElementById('adminPostInput');
const characterCount = document.querySelector('.character-count');
                
// Display loading overlay
function showLoading() {
    loadingOverlay.style.display = 'flex';
}
            
            // Hide loading overlay
function hideLoading() {
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
        loadingOverlay.style.display = 'none';
        loadingOverlay.style.opacity = '1';
    }, 300);
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
        
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Format timestamp
function formatTimestamp(timestamp) {
    if (!timestamp) return 'Recently';
    
    let date;
    try {
        // Handle Firebase timestamp
        if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            date = timestamp.toDate();
        } else if (timestamp.seconds && timestamp.nanoseconds) {
            date = new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000);
        } else {
            date = new Date(timestamp);
            }
            
        // Check if date is valid
        if (isNaN(date.getTime())) {
            return 'Recently';
        }
        
        return date.toLocaleString();
    } catch (error) {
        console.error("Error formatting timestamp:", error);
        return 'Recently';
    }
}

// Create post element
function createPostElement(postData) {
    const postElement = document.createElement('div');
    postElement.className = 'post-card';
    postElement.dataset.postId = postData.id;
    
    // Add classes for admin posts or flagged posts
    if (postData.isAdmin) {
        postElement.classList.add('admin-post');
    }
    
    if (postData.flagCount && postData.flagCount > 0) {
        postElement.classList.add('flagged-post');
    }
    
    // Get username or generate one if not available
    const username = postData.username || 'Anonymous User';
    const profileImage = postData.profileImage || '';
    
    // Create avatar content (initial letter or icon)
    let avatarContent;
    if (username) {
        avatarContent = username.charAt(0).toUpperCase();
    } else {
        avatarContent = '<i class="fas fa-user"></i>';
    }
    
    // Format post content
    let postHeader = `
        <div class="post-header">
            <div class="post-author">
                <div class="post-author-avatar">
                    ${avatarContent}
                </div>
                <div class="post-author-info">
    `;
    
    if (postData.isAdmin) {
        postHeader += `
            <div class="post-author-name">Admin <i class="fas fa-shield-alt"></i></div>
            <div class="post-author-handle">@admin</div>
        `;
    } else {
        postHeader += `
            <div class="post-author-name">${username}</div>
            <div class="post-author-handle">@anonymous${postData.tweetNumber || ''}</div>
        `;
    }
    
    postHeader += `
                </div>
            </div>
            <div class="post-timestamp">${formatTimestamp(postData.timestamp)}</div>
        </div>
    `;
    
    let flagsHtml = '';
    if (postData.flagCount && postData.flagCount > 0) {
        flagsHtml = `
            <div class="flag-count">
                <i class="fas fa-flag"></i>
                <span>Reported ${postData.flagCount} time${postData.flagCount > 1 ? 's' : ''}</span>
            </div>
        `;
    }
    
    postElement.innerHTML = `
        ${postHeader}
        <div class="post-content">${postData.content}</div>
        ${flagsHtml}
        <div class="post-actions">
            <div class="post-interactions">
                <div class="interaction-item comment-count" data-post-id="${postData.id}">
                    <i class="far fa-comment"></i>
                    <span>${postData.commentCount || 0}</span>
                </div>
                <div class="interaction-item">
                    <i class="far fa-heart"></i>
                    <span>${postData.likeCount || 0}</span>
                </div>
                <div class="interaction-item">
                    <i class="far fa-chart-bar"></i>
                    <span>Stats</span>
                </div>
            </div>
            <button class="delete-btn" data-post-id="${postData.id}">
                <i class="fas fa-trash-alt"></i>
                Delete
            </button>
        </div>
        <div class="comments-section" id="comments-${postData.id}">
            <div class="comments-list"></div>
        </div>
    `;
    
    // Add event listener to delete button
    const deleteBtn = postElement.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => {
        currentPostId = postData.id;
        confirmDialog.classList.add('visible');
    });
    
    // Add event listener to comment count to toggle comments
    const commentCount = postElement.querySelector('.comment-count');
    commentCount.addEventListener('click', () => {
        const commentsSection = document.getElementById(`comments-${postData.id}`);
        
        if (commentsSection.classList.contains('visible')) {
            commentsSection.classList.remove('visible');
        } else {
            commentsSection.classList.add('visible');
            loadComments(postData.id);
        }
    });
    
    // If this is a flagged post in the flagged view, add a resolve button
    if (currentView === 'flagged' && postData.flagCount && postData.flagCount > 0) {
        const resolveBtn = document.createElement('button');
        resolveBtn.className = 'resolve-btn';
        resolveBtn.innerHTML = '<i class="fas fa-check"></i> Resolve';
        
        resolveBtn.addEventListener('click', async () => {
            try {
                resolveBtn.disabled = true;
                resolveBtn.textContent = 'Resolving...';
                
                // Update the post to mark as resolved
                const tweetRef = doc(db, 'tweets', postData.id);
                await updateDoc(tweetRef, {
                    flagCount: 0,
                    resolved: true,
                    resolvedAt: serverTimestamp()
                });
                
                // Remove the post from the flagged view
                postElement.style.opacity = '0';
                setTimeout(() => postElement.remove(), 300);
                
                showNotification('Flag resolved successfully', 'success');
                
                // Update stats
                stats.totalFlagged--;
                updateStatsDisplay();
                
            } catch (error) {
                console.error("Error resolving flag:", error);
                resolveBtn.disabled = false;
                resolveBtn.innerHTML = '<i class="fas fa-check"></i> Resolve';
                showNotification('Error resolving flag', 'error');
            }
        });
        
        postElement.querySelector('.post-actions').appendChild(resolveBtn);
    }
    
    return postElement;
}

// Create comment element
function createCommentElement(commentData) {
    const comment = document.createElement('div');
    comment.className = 'comment';
    
    // Get username or generate one
    const username = commentData.username || 'Anonymous';
    let avatarContent;
    if (username) {
        avatarContent = username.charAt(0).toUpperCase();
    } else {
        avatarContent = '<i class="fas fa-user"></i>';
    }
    
    comment.innerHTML = `
        <div class="comment-avatar">
            ${avatarContent}
        </div>
        <div class="comment-content">
            <div class="comment-author">
                ${username}
                ${commentData.isAuthor ? '<span class="author-tag">Author</span>' : ''}
            </div>
            <div class="comment-text">${commentData.text}</div>
            <div class="comment-time">${formatTimestamp(commentData.timestamp)}</div>
        </div>
    `;
    
    return comment;
}

// Load posts from Firebase
async function loadPosts() {
    showLoading();
    
    try {
        // Get posts
        const postsRef = collection(db, 'tweets');
        const q = query(postsRef, orderBy('timestamp', 'desc'));
        
        const querySnapshot = await getDocs(q);
        postsContainer.innerHTML = '';
        
        // Reset stats
        stats.totalPosts = querySnapshot.size;
        stats.totalComments = 0;
        stats.totalLikes = 0;
        stats.totalFlagged = 0;
        const userIds = new Set();
        
        // Process each post
        const postsPromises = querySnapshot.docs.map(async (docSnapshot) => {
            const postData = {
                id: docSnapshot.id,
                ...docSnapshot.data()
            };
            
            // Add user to unique users
            if (postData.userId) {
                userIds.add(postData.userId);
            }
            
            // Count flagged posts
            if (postData.flagCount && postData.flagCount > 0) {
                stats.totalFlagged++;
            }
            
            // Get comments count
            const commentsSnapshot = await getDocs(collection(db, 'tweets', docSnapshot.id, 'comments'));
            postData.commentCount = commentsSnapshot.size;
            stats.totalComments += commentsSnapshot.size;
            
            // Get likes count
            const likesSnapshot = await getDocs(collection(db, 'tweets', docSnapshot.id, 'likes'));
            postData.likeCount = likesSnapshot.size;
            stats.totalLikes += likesSnapshot.size;
            
            // Create and append post element
            const postElement = createPostElement(postData);
            postsContainer.appendChild(postElement);
            
            return postData;
        });
        
        await Promise.all(postsPromises);
        
        // Update stats
        stats.uniqueUsers = userIds.size;
        updateStatsDisplay();
        
        // Update reports badge (only if not currently viewing reports)
        if (currentView !== 'flagged' && stats.totalFlagged > 0) {
            document.getElementById('reportsBadge').textContent = stats.totalFlagged;
        }
        
    } catch (error) {
        console.error('Error loading posts:', error);
        showNotification('Error loading posts. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Load comments for a post
async function loadComments(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    const commentsList = commentsSection.querySelector('.comments-list');
    commentsList.innerHTML = '<div class="loading-text">Loading comments...</div>';
    
    try {
        // Get comments
        const commentsRef = collection(db, 'tweets', postId, 'comments');
        const q = query(commentsRef, orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        
        // Clear comments list
        commentsList.innerHTML = '';
    
        if (querySnapshot.empty) {
            commentsList.innerHTML = '<div class="no-comments-message">No comments yet</div>';
        return;
    }
    
        // Process comments
        const comments = [];
        querySnapshot.forEach(doc => {
            comments.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Sort top-level comments first
    const topLevelComments = comments.filter(comment => !comment.parentId);
        const replies = comments.filter(comment => comment.parentId);
    
        // Add top-level comments
    topLevelComments.forEach(comment => {
            const commentElement = createCommentElement(comment);
        
        // Add replies if any
            const commentReplies = replies.filter(reply => reply.parentId === comment.id);
            if (commentReplies.length > 0) {
            const repliesContainer = document.createElement('div');
            repliesContainer.className = 'replies-container';
            
                commentReplies.forEach(reply => {
                    const replyElement = createCommentElement(reply);
                    replyElement.classList.add('reply');
                    repliesContainer.appendChild(replyElement);
            });
            
                commentElement.appendChild(repliesContainer);
        }
        
            commentsList.appendChild(commentElement);
        });
        
    } catch (error) {
        console.error('Error loading comments:', error);
        commentsList.innerHTML = '<div class="error-message">Error loading comments</div>';
    }
}

// Delete a post
async function deletePost(postId) {
    showLoading();
    
    try {
        // Save current view state
        const wasInFlaggedView = currentView === 'flagged';
        
        // First delete all subcollections
        const batch = writeBatch(db);
        
        // Delete likes
        const likesSnapshot = await getDocs(collection(db, 'tweets', postId, 'likes'));
        likesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Delete comments
        const commentsSnapshot = await getDocs(collection(db, 'tweets', postId, 'comments'));
        commentsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Delete reactions
        const reactionsSnapshot = await getDocs(collection(db, 'tweets', postId, 'reactions'));
        reactionsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Delete flags
        const flagsSnapshot = await getDocs(collection(db, 'tweets', postId, 'flags'));
        flagsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Commit the batch deletes
        await batch.commit();
        
        // Delete the post document
        await deleteDoc(doc(db, 'tweets', postId));
        
        showNotification('Post deleted successfully', 'success');
        
        // If we were in flagged view, refresh flagged posts instead of all posts
        if (wasInFlaggedView) {
            await loadFlaggedPosts();
        } else {
            await loadPosts();
        }
        
    } catch (error) {
        console.error('Error deleting post:', error);
        showNotification('Error deleting post. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Delete all posts
async function deleteAllPosts() {
    showLoading();
    
    try {
        const postsSnapshot = await getDocs(collection(db, 'tweets'));
        
        // Delete each post and its subcollections
        const deletePromises = postsSnapshot.docs.map(async (postDoc) => {
            const postId = postDoc.id;
            
            // Create a batch for subcollections
            const batch = writeBatch(db);
            
            // Delete likes
            const likesSnapshot = await getDocs(collection(db, 'tweets', postId, 'likes'));
            likesSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Delete comments
            const commentsSnapshot = await getDocs(collection(db, 'tweets', postId, 'comments'));
            commentsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Delete reactions
            const reactionsSnapshot = await getDocs(collection(db, 'tweets', postId, 'reactions'));
            reactionsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Commit subcollection deletes
            await batch.commit();
            
            // Delete the post document
            return deleteDoc(doc(db, 'tweets', postId));
        });
        
        await Promise.all(deletePromises);
        
        showNotification('All posts deleted successfully', 'success');
        
        // Refresh posts
        await loadPosts();
        
    } catch (error) {
        console.error('Error deleting all posts:', error);
        showNotification('Error deleting all posts. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Export data as JSON
async function exportData() {
    showLoading();
    
    try {
        const postsSnapshot = await getDocs(collection(db, 'tweets'));
        const exportData = {
            exportDate: new Date().toISOString(),
            posts: []
        };
        
        // Process each post
        for (const postDoc of postsSnapshot.docs) {
            const postData = {
                id: postDoc.id,
                ...postDoc.data(),
                comments: [],
                likes: [],
                reactions: []
            };
            
            // Get comments
            const commentsSnapshot = await getDocs(collection(db, 'tweets', postDoc.id, 'comments'));
            commentsSnapshot.forEach(doc => {
                postData.comments.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Get likes
            const likesSnapshot = await getDocs(collection(db, 'tweets', postDoc.id, 'likes'));
            likesSnapshot.forEach(doc => {
                postData.likes.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Get reactions
            const reactionsSnapshot = await getDocs(collection(db, 'tweets', postDoc.id, 'reactions'));
            reactionsSnapshot.forEach(doc => {
                postData.reactions.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            exportData.posts.push(postData);
        }
        
        // Create and download JSON file
        const dataStr = "data:text/json;charset=utf-8," + 
            encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "anonymous-messages-export.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        
        showNotification('Data exported successfully', 'success');
        
    } catch (error) {
        console.error('Error exporting data:', error);
        showNotification('Error exporting data. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Filter posts based on search input
function filterPosts() {
    const searchText = searchInput.value.toLowerCase();
    const postElements = postsContainer.querySelectorAll('.post-card');
    
    postElements.forEach(post => {
        const content = post.querySelector('.post-content').textContent.toLowerCase();
        const author = post.querySelector('.post-author-name').textContent.toLowerCase();
        
        if (content.includes(searchText) || author.includes(searchText)) {
            post.style.display = 'block';
        } else {
            post.style.display = 'none';
        }
    });
}

// Update stats display
function updateStatsDisplay() {
    document.getElementById('totalPosts').textContent = stats.totalPosts;
    document.getElementById('totalComments').textContent = stats.totalComments;
    document.getElementById('totalLikes').textContent = stats.totalLikes;
    document.getElementById('totalFlagged').textContent = stats.totalFlagged;
    
    // Update the reports badge in the header
    const reportsBadge = document.getElementById('reportsBadge');
    if (reportsBadge) {
        if (currentView !== 'flagged' && stats.totalFlagged > 0) {
            reportsBadge.textContent = stats.totalFlagged;
            reportsBadge.style.display = 'inline-flex'; // Make sure it's visible
        } else {
            reportsBadge.textContent = '';
            reportsBadge.style.display = 'none'; // Hide if zero or viewing flagged
        }
    }
}

// Load flagged posts
async function loadFlaggedPosts() {
    showLoading();
    
    try {
        // Get flagged posts
        const postsRef = collection(db, 'tweets');
        const q = query(postsRef, where('flagCount', '>', 0), orderBy('flagCount', 'desc'));
        
        const querySnapshot = await getDocs(q);
        flaggedPostsContainer.innerHTML = '';
        
        stats.totalFlagged = querySnapshot.size;
        
        if (querySnapshot.empty) {
            flaggedPostsContainer.innerHTML = `
                <div class="no-posts-message">
                    <i class="fas fa-check-circle" style="font-size: 3rem; color: var(--success); margin-bottom: 1rem;"></i>
                    <p>No reported posts found. All clear!</p>
                </div>
            `;
            hideLoading();
            updateStatsDisplay();
            return;
        }
        
        // Debug: Log the data to console to help diagnose issues
        console.log('Found flagged posts:', querySnapshot.size);
        querySnapshot.forEach(doc => {
            console.log('Flagged post data:', doc.id, doc.data());
        });
        
        // Process each flagged post
        const postsPromises = querySnapshot.docs.map(async (docSnapshot) => {
            const postData = {
                id: docSnapshot.id,
                ...docSnapshot.data()
            };
            
            // Get comments count
            const commentsSnapshot = await getDocs(collection(db, 'tweets', docSnapshot.id, 'comments'));
            postData.commentCount = commentsSnapshot.size;
            
            // Get likes count
            const likesSnapshot = await getDocs(collection(db, 'tweets', docSnapshot.id, 'likes'));
            postData.likeCount = likesSnapshot.size;
            
            // Get flags details
            try {
                const flagsRef = collection(db, 'tweets', postData.id, 'flags');
                const flagsSnapshot = await getDocs(flagsRef);
                postData.flags = flagsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                // Debug: Log flags
                console.log(`Flags for post ${postData.id}:`, postData.flags);
            } catch (error) {
                console.error("Error getting flags for post:", error);
                postData.flags = [];
            }
            
            // Create and add post element with special layout for flagged posts
            const postElement = createFlaggedPostElement(postData);
            flaggedPostsContainer.appendChild(postElement);
        });
        
        await Promise.all(postsPromises);
        
        hideLoading();
        updateStatsDisplay();
        
    } catch (error) {
        console.error("Error loading flagged posts:", error);
        hideLoading();
        flaggedPostsContainer.innerHTML = `
            <div class="error-message">
                <p>Error loading flagged posts: ${error.message}</p>
                <button id="retryFlaggedBtn" class="header-button secondary">Retry</button>
            </div>
        `;
        
        // Add retry button functionality
        document.getElementById('retryFlaggedBtn')?.addEventListener('click', () => {
            loadFlaggedPosts();
        });
    }
}

// Create special element for flagged posts with enhanced actions
function createFlaggedPostElement(postData) {
    const postElement = document.createElement('div');
    postElement.className = 'post-card flagged-post';
    postElement.dataset.postId = postData.id;
    
    // Add admin post class if applicable
    if (postData.isAdmin) {
        postElement.classList.add('admin-post');
    }
    
    // Get username or generate one if not available
    const username = postData.username || 'Anonymous User';
    const profileImage = postData.profileImage || '';
    
    // Create avatar content
    let avatarContent;
    if (username) {
        avatarContent = username.charAt(0).toUpperCase();
    } else {
        avatarContent = '<i class="fas fa-user"></i>';
    }
    
    // Create header HTML based on admin status
    let postHeader = `
        <div class="post-header">
            <div class="post-author">
                <div class="post-author-avatar">
                    ${avatarContent}
                </div>
                <div class="post-author-info">
    `;
    
    if (postData.isAdmin) {
        postHeader += `
            <div class="post-author-name">Admin <i class="fas fa-shield-alt"></i></div>
            <div class="post-author-handle">@admin</div>
        `;
    } else {
        postHeader += `
            <div class="post-author-name">${username}</div>
            <div class="post-author-handle">@anonymous${postData.tweetNumber || ''}</div>
        `;
    }
    
    postHeader += `
                </div>
            </div>
            <div class="post-timestamp">${formatTimestamp(postData.timestamp)}</div>
        </div>
    `;
    
    // Create flag count display
    const flagCount = postData.flagCount || 0;
    const flagsHtml = `
        <div class="flag-count">
            <i class="fas fa-flag"></i>
            <span>Reported ${flagCount} time${flagCount !== 1 ? 's' : ''}</span>
        </div>
    `;
    
    // Create base post HTML
    postElement.innerHTML = `
        ${postHeader}
        <div class="post-content">${postData.content}</div>
        ${flagsHtml}
        <div class="post-actions">
            <div class="post-interactions">
                <div class="interaction-item comment-count" data-post-id="${postData.id}">
                    <i class="far fa-comment"></i>
                    <span>${postData.commentCount || 0}</span>
                </div>
                <div class="interaction-item">
                    <i class="far fa-heart"></i>
                    <span>${postData.likeCount || 0}</span>
                </div>
                <div class="interaction-item">
                    <i class="far fa-eye"></i>
                    <span>View Flags</span>
                </div>
            </div>
            <div class="flag-actions">
                <button class="resolve-btn" data-post-id="${postData.id}">
                    <i class="fas fa-check"></i> Resolve
                </button>
                <button class="delete-btn" data-post-id="${postData.id}">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            </div>
        </div>
        <div class="flag-details" style="display: none;">
            <h4>Report Details (${postData.flags?.length || 0})</h4>
        </div>
    `;
    
    // Add flag details
    if (postData.flags && postData.flags.length > 0) {
        const flagDetailsContainer = postElement.querySelector('.flag-details');
        
        postData.flags.forEach((flag, index) => {
            const flagItem = document.createElement('div');
            flagItem.className = 'flag-item';
            flagItem.innerHTML = `
                <strong>Report #${index + 1}</strong>: ${flag.reason || 'Inappropriate content'}
                <div class="flag-time">${formatTimestamp(flag.timestamp)}</div>
            `;
            
            if (index < postData.flags.length - 1) {
                flagItem.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
                flagItem.style.marginBottom = '10px';
                flagItem.style.paddingBottom = '10px';
            }
            
            flagDetailsContainer.appendChild(flagItem);
        });
        
        // Add toggle functionality for flag details
        const viewFlagsBtn = postElement.querySelector('.interaction-item:nth-child(3)');
        viewFlagsBtn.addEventListener('click', () => {
            const flagDetails = postElement.querySelector('.flag-details');
            if (flagDetails.style.display === 'none') {
                flagDetails.style.display = 'block';
                viewFlagsBtn.querySelector('i').className = 'fas fa-eye-slash';
                viewFlagsBtn.querySelector('span').textContent = 'Hide Flags';
            } else {
                flagDetails.style.display = 'none';
                viewFlagsBtn.querySelector('i').className = 'far fa-eye';
                viewFlagsBtn.querySelector('span').textContent = 'View Flags';
            }
        });
    }
    
    // Add resolve button functionality
    const resolveBtn = postElement.querySelector('.resolve-btn');
    resolveBtn.addEventListener('click', async () => {
        try {
            resolveBtn.disabled = true;
            resolveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resolving...';
            
            // Update the post to mark as resolved
            const tweetRef = doc(db, 'tweets', postData.id);
            await updateDoc(tweetRef, {
                flagCount: 0,
                resolved: true,
                resolvedAt: serverTimestamp()
            });
            
            // Remove the post from the flagged view with animation
            postElement.style.opacity = '0';
            postElement.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                postElement.remove();
                
                // Update stats
                stats.totalFlagged--;
                updateStatsDisplay();
                
                // Check if no flags left
                if (stats.totalFlagged === 0) {
                    flaggedPostsContainer.innerHTML = `
                        <div class="no-posts-message">
                            <i class="fas fa-check-circle" style="font-size: 3rem; color: var(--success); margin-bottom: 1rem;"></i>
                            <p>No reported posts found. All clear!</p>
                        </div>
                    `;
                }
            }, 300);
            
            showNotification('Flag resolved successfully', 'success');
            
        } catch (error) {
            console.error("Error resolving flag:", error);
            resolveBtn.disabled = false;
            resolveBtn.innerHTML = '<i class="fas fa-check"></i> Resolve';
            showNotification('Error resolving flag', 'error');
        }
    });
    
    // Add delete button functionality
    const deleteBtn = postElement.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => {
        currentPostId = postData.id;
        confirmDialog.classList.add('visible');
    });
    
    return postElement;
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Load posts on page load
    loadPosts();
    
    // Admin post button handling
    if (adminPostButton && adminPostInput) {
        // Update character count on input
        adminPostInput.addEventListener('input', function() {
            const remaining = 280 - this.value.length;
            characterCount.textContent = remaining;
            
            // Update style based on remaining chars
            if (remaining < 0) {
                characterCount.style.color = 'var(--error)';
                adminPostButton.disabled = true;
            } else if (remaining < 20) {
                characterCount.style.color = 'var(--warning)';
                adminPostButton.disabled = false;
            } else {
                characterCount.style.color = 'var(--text-secondary)';
                adminPostButton.disabled = false;
            }
        });
        
        // Handle post button click
        adminPostButton.addEventListener('click', async function() {
            const content = adminPostInput.value.trim();
            
            if (!content) return;
            
            try {
                // Show loading state
                adminPostButton.disabled = true;
                adminPostButton.classList.add('loading');
                adminPostButton.textContent = 'Posting...';
                
                // Get the current highest tweet number
                const tweetsRef = collection(db, 'tweets');
                const q = query(tweetsRef, orderBy('tweetNumber', 'desc'), limit(1));
                const snapshot = await getDocs(q);
                
                let nextTweetNumber = 1;
                if (!snapshot.empty) {
                    const highestTweet = snapshot.docs[0].data();
                    nextTweetNumber = (highestTweet.tweetNumber || 0) + 1;
                }
                
                // Add the admin tweet
                await addDoc(collection(db, 'tweets'), {
                    content: content,
                    tweetNumber: nextTweetNumber,
                    timestamp: serverTimestamp(),
                    userId: 'admin',
                    username: 'Admin',
                    isAdmin: true,
                    profileImage: 'https://api.dicebear.com/6.x/identicon/svg?seed=admin'
                });
                
                // Clear input and reset UI
                adminPostInput.value = '';
                characterCount.textContent = '280';
                
                showNotification('Admin post published successfully', 'success');
                
                // Refresh posts
                loadPosts();
                
            } catch (error) {
                console.error('Error posting as admin:', error);
                showNotification('Error posting. Please try again.', 'error');
            } finally {
                // Reset button state
                adminPostButton.disabled = false;
                adminPostButton.classList.remove('loading');
                adminPostButton.innerHTML = '<i class="fas fa-paper-plane"></i> Post';
            }
        });
    }
    
    // View all posts button
    document.getElementById('viewAllBtn').addEventListener('click', () => {
        currentView = 'posts';
        flaggedSection.style.display = 'none';
        postsSection.style.display = 'block';
        
        // Update active state
        document.getElementById('viewAllBtn').classList.add('active');
        document.getElementById('viewFlaggedBtn').classList.remove('active');
    });
    
    // View flagged posts button
    document.getElementById('viewFlaggedBtn').addEventListener('click', () => {
        currentView = 'flagged';
        postsSection.style.display = 'none';
        flaggedSection.style.display = 'block';
        loadFlaggedPosts();
        
        // Update active state
        document.getElementById('viewAllBtn').classList.remove('active');
        document.getElementById('viewFlaggedBtn').classList.add('active');
        
        // Clear the badge when viewed
        document.getElementById('reportsBadge').textContent = '';
    });
    
    // Cancel delete button
    cancelDeleteBtn.addEventListener('click', () => {
        confirmDialog.classList.remove('visible');
        currentPostId = null;
    });
    
    // Confirm delete button
    confirmDeleteBtn.addEventListener('click', async () => {
        confirmDialog.classList.remove('visible');
        if (currentPostId) {
            await deletePost(currentPostId);
            currentPostId = null;
        }
    });
    
    // Refresh button
    refreshBtn.addEventListener('click', () => {
        if (currentView === 'posts') {
            loadPosts();
        } else {
            loadFlaggedPosts();
        }
    });
    
    // Export button
    exportBtn.addEventListener('click', () => {
        exportData();
    });
    
    // Clear all button
    clearAllBtn.addEventListener('click', () => {
        currentPostId = 'all';
        confirmDialog.classList.add('visible');
        document.querySelector('.dialog-content').textContent = 
            'Are you sure you want to delete ALL posts? This action cannot be undone.';
            
        // Override confirm button action temporarily
        confirmDeleteBtn.onclick = async () => {
            confirmDialog.classList.remove('visible');
            await deleteAllPosts();
            // Reset to normal delete action
            confirmDeleteBtn.onclick = null;
        };
    });
    
    // Search input
    searchInput.addEventListener('input', filterPosts);
}); 