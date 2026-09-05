

const ALLOWED_IMAGE_HOSTS = [
  'imgur.com',
  'i.imgur.com',
  'cdn.discordapp.com',
  'media.discordapp.net',
  'i.postimg.cc',
  'postimg.cc',
  'imagehost.com',
  'ibb.co',
  'i.ibb.co',
  'imgbb.com',
  'i.imgbb.com'
];

function isValidImageUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    
    // Check if the hostname matches any allowed hosts
    const isAllowed = ALLOWED_IMAGE_HOSTS.some(host => 
      hostname === host || hostname.endsWith(`.${host}`)
    );
    
    if (!isAllowed) {
      return { 
        valid: false, 
        error: `Image must be hosted on: ${ALLOWED_IMAGE_HOSTS.join(', ')}` 
      };
    }
    
    // Check if URL ends with image extension
    const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const hasValidExtension = validExtensions.some(ext => 
      parsedUrl.pathname.toLowerCase().endsWith(ext)
    );
    
    if (!hasValidExtension) {
      return { 
        valid: false, 
        error: 'URL must end with a valid image extension (.png, .jpg, .jpeg, .gif, .webp)' 
      };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

module.exports = { isValidImageUrl };

