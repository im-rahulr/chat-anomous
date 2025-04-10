# Anonymous Messages Admin Panel

This is the admin panel for the Anonymous Messages application. It provides a way to monitor and moderate the content posted on the platform.

## Features

- Real-time monitoring of all posts
- View reaction counts and comment threads
- Delete inappropriate content
- Dashboard with key statistics

## Setup

The admin panel is accessible at the `/admin` path of your deployed site (e.g., `https://your-site.com/admin`).

### Firebase Hosting Configuration

The application uses Firebase Hosting rewrites to make the admin panel accessible. The configuration is already set up in the `firebase.json` file:

```json
{
  "hosting": {
    "rewrites": [
      {
        "source": "/admin",
        "destination": "/admin-panel.html"
      },
      {
        "source": "/admin/**",
        "destination": "/admin-panel.html"
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### Deployment

To deploy the application with Firebase Hosting:

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login to Firebase: `firebase login`
3. Initialize your project: `firebase init`
4. Deploy: `firebase deploy`

## Security Considerations

**Important Note:** This admin panel does not have authentication. It is accessible to anyone who knows the URL. For production use, consider adding authentication to restrict access.

## Usage

The admin panel provides a simple interface to:

1. **View Posts**: All posts are displayed in reverse chronological order.
2. **See Reactions**: Each post shows reactions with emoji counts.
3. **View Comments**: Click on the comment count to expand and view all comments and replies.
4. **Delete Content**: Each post has a "Delete" button. Clicking it will prompt for confirmation before deletion.

## Dashboard Statistics

The dashboard shows:
- Total number of posts
- Total number of comments
- Total number of reactions
- Number of deleted posts in this session
