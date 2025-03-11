# Deploying Blizz Share to Render

This guide will help you deploy your Blizz Share application to Render.

## Prerequisites

1. A Render account (https://render.com)
2. A MongoDB Atlas account (https://www.mongodb.com/cloud/atlas)
3. A Cloudinary account (https://cloudinary.com)

## Step 1: Set Up MongoDB Atlas

1. Create a new cluster in MongoDB Atlas
2. Create a database named `blizz-share`
3. Create the following collections:
   - `files` (for storing file metadata)
   - `user-tracking` (for tracking user uploads)
4. Get your MongoDB connection string from Atlas

## Step 2: Set Up Cloudinary

1. Create a Cloudinary account if you don't have one
2. Note your Cloud Name, API Key, and API Secret from the dashboard

## Step 3: Deploy to Render

1. Log in to your Render account
2. Click on "New" and select "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - Name: `blizz-share` (or your preferred name)
   - Environment: `Node`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

5. Add the following environment variables:
   - `MONGODB_URI`: Your MongoDB connection string
   - `CLOUDINARY_CLOUD_NAME`: Your Cloudinary cloud name
   - `CLOUDINARY_API_KEY`: Your Cloudinary API key
   - `CLOUDINARY_API_SECRET`: Your Cloudinary API secret

6. Click "Create Web Service"

## Step 4: Verify Deployment

1. Once deployed, Render will provide you with a URL for your application
2. Visit the URL to ensure your application is running correctly
3. Test file uploads and downloads to verify everything is working

## Troubleshooting

If you encounter any issues:

1. Check the Render logs for error messages
2. Verify your environment variables are set correctly
3. Ensure your MongoDB Atlas cluster is accessible from Render
4. Make sure your Cloudinary credentials are correct
