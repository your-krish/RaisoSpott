// js/config.js
const SUPABASE_URL = 'https://kechmfekacwpplzogjue.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_p1lITBsEZxM7tCUdO42ShA_FAIvo57F';

const MAX_IMAGES_PER_POST = 2;
const MAX_POSTS_PER_DAY = 4;
const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;

// Use var to avoid redeclaration errors if script is loaded twice
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
