// ⚙️ إعدادات الاتصال بالـ API
// غير الرابط هنا فقط عند رفع المشروع على السيرفر

const API_CONFIG = {
    // للتطوير المحلي (localhost)
    LOCAL: 'http://localhost:3000/api',
    
    // للإنتاج (Production) - ضع رابط السيرفر هنا
    // مثال: 'https://your-app.onrender.com/api'
    PRODUCTION: 'https://your-app.onrender.com/api',
    
    // تحديد البيئة الحالية
    // غير القيمة إلى 'PRODUCTION' عند الرفع على السيرفر
    CURRENT: 'LOCAL'  // يمكن تغييرها إلى 'PRODUCTION'
};

// رابط الـ API الذي سيتم استخدامه
const API_URL = API_CONFIG[API_CONFIG.CURRENT];// ⚙️ إعدادات الاتصال بالـ API
// غير الرابط هنا فقط عند رفع المشروع على السيرفر

const API_CONFIG = {
    // للتطوير المحلي (localhost)
    LOCAL: 'http://localhost:3000/api',
    
    // للإنتاج (Production) - ضع رابط السيرفر هنا
    // مثال: 'https://your-app.onrender.com/api'
    PRODUCTION: 'https://your-app.onrender.com/api',
    
    // تحديد البيئة الحالية
    // غير القيمة إلى 'PRODUCTION' عند الرفع على السيرفر
    CURRENT: 'LOCAL'  // يمكن تغييرها إلى 'PRODUCTION'
};

// رابط الـ API الذي سيتم استخدامه
const API_URL = API_CONFIG[API_CONFIG.CURRENT];