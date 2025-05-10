# Firebase Setup for Folder Feature

Follow these steps to set up the Firebase Realtime Database with the proper security rules:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project: "clip-10953"
3. Navigate to "Realtime Database" from the left sidebar
4. Click on the "Rules" tab
5. Replace the current rules with the following:

```json
{
  "rules": {
    ".read": "auth == null",
    ".write": "auth == null",
    "folders": {
      ".read": true,
      ".write": true,
      "$folderId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

6. Click "Publish" to save the rules

## Explanation

These rules allow:

- Read and write access to anyone (no authentication required)
- Specific permissions for the "folders" path to ensure the folder feature works properly

## Testing

To verify that the rules are working:

1. Open the application
2. Try creating a new folder
3. Verify that the folder appears in the list
4. Check the Firebase Realtime Database console to confirm the data is being saved

If you encounter any issues with permissions, check the browser console for error messages and verify that the rules have been properly set up in the Firebase console. 