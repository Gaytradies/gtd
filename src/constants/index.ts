// --- CONSTANTS ---
export const TRADES = [
    'Electrician', 'Plumber', 'Carpenter', 'Bricklayer', 'Landscaper', 'Roofer',
    'Painter & Decorator', 'Labourer', 'Other'
];

export const PRIMARY_COLOR_TAILWIND = 'orange';
export const MAX_VERIFICATION_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
export const BASE64_SIZE_RATIO = 0.75; // Base64 encoding increases size by ~33%, so actual size ≈ 75% of base64 length

// Admin email - only this user can access admin panel
export const ADMIN_EMAIL = 'ranson.samsung@gmail.com';

// Default cover photos - reduces hosting costs by using same image for all users of each type
export const DEFAULT_COVER_PHOTOS = {
    admin: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&h=200&fit=crop', // Admin: Gradient business/tech theme
    tradie: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=200&fit=crop', // Tradies: Tools and construction theme
    admirer: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=200&fit=crop' // Admirers: Modern professional theme
};
