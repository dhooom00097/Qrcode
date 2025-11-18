// ⚙️ إعدادات الاتصال بالـ API
// غير الرابط هنا فقط عند رفع المشروع على السيرفر

const API_CONFIG = {
    // للتطوير المحلي (localhost)
    LOCAL: 'http://localhost:3000/api',
    
    // للإنتاج (Production) - رابط Railway
    PRODUCTION: 'https://qrcode-production-c4e9.up.railway.app/api',
    
    // تحديد البيئة الحالية - معدل للإنتاج
    CURRENT: 'PRODUCTION'  // ✅ الآن يستخدم Railway
};

// رابط الـ API الذي سيتم استخدامه
const API_URL = API_CONFIG[API_CONFIG.CURRENT];