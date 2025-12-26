import { ADMIN_EMAIL, DEFAULT_COVER_PHOTOS } from '../constants';

// Get default cover photo based on user role and email
export function getDefaultCoverPhoto(userEmail: string, userRole: string): string {
    if (userEmail === ADMIN_EMAIL) {
        return DEFAULT_COVER_PHOTOS.admin;
    }
    if (userRole === 'tradie') {
        return DEFAULT_COVER_PHOTOS.tradie;
    }
    return DEFAULT_COVER_PHOTOS.admirer;
}
