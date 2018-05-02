'use strict';

// import packages
const functions = require('firebase-functions');
const gcs = require('@google-cloud/storage')();
const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');

exports.generateThumbnail = functions.storage.object().onFinalize((image) => {
    // Bucket that contains file
    const fileBucket = image.bucket;
    // Path of file in firebase
    const filePath = image.name;
    // Type of file ex: image
    const contentType = image.contentType; // File content type.
    // The resourceState is 'exists' or 'not_exists' (for file/folder deletions).
    const resourceState = image.resourceState;
    // Metadata: info like name, size, etc.
    const metageneration = image.metageneration;
    // Check if file is an image
    if (!contentType.startsWith('image/')) {
        console.log('This is not an image.');
        return null;
    }

    // Get the file name.
    const fileName = path.basename(filePath);
    // Exit if image is already a thumbnail
    if (fileName.startsWith('thumb_')) {
        console.log('Already a Thumbnail.');
        return null;
    }

    // Download file from bucket.
    const bucket = gcs.bucket(fileBucket);
    const tempFilePath = path.join(os.tmpdir(), fileName);
    const metadata = {
        contentType: contentType,
    };
    return bucket.file(filePath).download({
        destination: tempFilePath,
    }).then(() => {
        console.log('Image downloaded locally to', tempFilePath);
        // ImageMagick converts picture into a thumbnail
        return spawn('convert', [tempFilePath, '-thumbnail', '200x200>', tempFilePath]);
    }).then(() => {
        console.log('Thumbnail created at', tempFilePath);
        // Add 'thumb_' prefix to name
        const thumbFileName = `thumb_${fileName}`;
        const thumbFilePath = path.join(path.dirname(filePath), thumbFileName);
        // Upload thumbnail
        return bucket.upload(tempFilePath, {
            destination: thumbFilePath,
            metadata: metadata,
        });
        // Once the thumbnail has been uploaded delete the local file to free up disk space.
    }).then(() => fs.unlinkSync(tempFilePath));
});