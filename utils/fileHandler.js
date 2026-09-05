
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Create badges directory if it doesn't exist
const badgesDir = path.join(__dirname, '..', 'badges');
if (!fs.existsSync(badgesDir)) {
  fs.mkdirSync(badgesDir, { recursive: true });
}

/**
 * Save a Discord attachment to local storage
 * @param {Attachment} attachment - Discord attachment object
 * @returns {Promise<string>} - Local file path
 */
async function saveAttachment(attachment) {
  return new Promise((resolve, reject) => {
    // Generate unique filename
    const timestamp = Date.now();
    const extension = path.extname(attachment.name);
    const filename = `badge_${timestamp}${extension}`;
    const filepath = path.join(badgesDir, filename);

    // Determine protocol
    const protocol = attachment.url.startsWith('https') ? https : http;

    // Download file
    const file = fs.createWriteStream(filepath);
    
    protocol.get(attachment.url, (response) => {
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        // Return relative path for storage
        resolve(`badges/${filename}`);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {}); // Delete incomplete file
      reject(err);
    });
  });
}

/**
 * Get absolute path for a badge image
 * @param {string} relativePath - Relative path stored in database
 * @returns {string} - Absolute file path
 */
function getBadgeImagePath(relativePath) {
  return path.join(__dirname, '..', relativePath);
}

/**
 * Check if badge image file exists
 * @param {string} relativePath - Relative path stored in database
 * @returns {boolean} - Whether file exists
 */
function badgeImageExists(relativePath) {
  const absolutePath = getBadgeImagePath(relativePath);
  return fs.existsSync(absolutePath);
}

/**
 * Delete a badge image file
 * @param {string} relativePath - Relative path stored in database
 * @returns {boolean} - Whether deletion was successful
 */
function deleteBadgeImage(relativePath) {
  try {
    const absolutePath = getBadgeImagePath(relativePath);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting badge image:', error);
    return false;
  }
}

module.exports = {
  saveAttachment,
  getBadgeImagePath,
  badgeImageExists,
  deleteBadgeImage
};
