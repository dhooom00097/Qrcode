const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const DB_DIR = path.join(__dirname, 'database');
const SESSIONS_FILE = path.join(DB_DIR, 'sessions.json');
const ATTENDANCE_FILE = path.join(DB_DIR, 'attendance.json');
const USERS_FILE = path.join(DB_DIR, 'users.json');
const SETTINGS_FILE = path.join(DB_DIR, 'settings.json');

function initDatabase() {
    if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
    }
    
    if (!fs.existsSync(SESSIONS_FILE)) {
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
    }
    
    if (!fs.existsSync(ATTENDANCE_FILE)) {
        fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify([]));
    }
    
    if (!fs.existsSync(USERS_FILE)) {
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        const defaultUsers = [
            { id: 1, username: 'admin', password: hashedPassword, role: 'admin', name: 'المسؤول' }
        ];
        fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers));
    }
    
    if (!fs.existsSync(SETTINGS_FILE)) {
        const defaultSettings = {
            locationRadius: 100,
            requireLocation: true,
            preventDuplicate: true,
            allowManualLocationEdit: true
        };
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings));
    }
}

function readJSON(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`Error reading ${file}:`, error);
        return [];
    }
}

function writeJSON(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing ${file}:`, error);
        return false;
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = readJSON(USERS_FILE);
    
    const user = users.find(u => u.username === username);
    
    if (user && bcrypt.compareSync(password, user.password)) {
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name
            }
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'اسم المستخدم أو كلمة السر غير صحيحة'
        });
    }
});

// Sessions
app.post('/api/sessions', (req, res) => {
    const { teacherId, sessionName, location } = req.body;
    const sessions = readJSON(SESSIONS_FILE);
    
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    
    const newSession = {
        id: Date.now(),
        pin: pin,
        teacherId: teacherId,
        sessionName: sessionName || 'جلسة جديدة',
        location: location,
        createdAt: new Date().toISOString(),
        isOpen: true,
        attendanceCount: 0
    };
    
    sessions.push(newSession);
    writeJSON(SESSIONS_FILE, sessions);
    
    res.json({ success: true, session: newSession });
});

app.get('/api/sessions', (req, res) => {
    const sessions = readJSON(SESSIONS_FILE);
    res.json({ success: true, sessions });
});

app.get('/api/sessions/:id', (req, res) => {
    const { id } = req.params;
    const sessions = readJSON(SESSIONS_FILE);
    const session = sessions.find(s => s.id == id);
    
    if (session) {
        res.json({ success: true, session });
    } else {
        res.status(404).json({ success: false, message: 'الجلسة غير موجودة' });
    }
});

app.put('/api/sessions/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const sessions = readJSON(SESSIONS_FILE);
    
    const sessionIndex = sessions.findIndex(s => s.id == id);
    
    if (sessionIndex !== -1) {
        sessions[sessionIndex] = { ...sessions[sessionIndex], ...updates };
        writeJSON(SESSIONS_FILE, sessions);
        res.json({ success: true, session: sessions[sessionIndex] });
    } else {
        res.status(404).json({ success: false, message: 'الجلسة غير موجودة' });
    }
});

app.delete('/api/sessions/:id', (req, res) => {
    const { id } = req.params;
    let sessions = readJSON(SESSIONS_FILE);
    let attendance = readJSON(ATTENDANCE_FILE);
    
    sessions = sessions.filter(s => s.id != id);
    writeJSON(SESSIONS_FILE, sessions);
    
    attendance = attendance.filter(a => a.sessionId != id);
    writeJSON(ATTENDANCE_FILE, attendance);
    
    res.json({ success: true, message: 'تم حذف الجلسة بنجاح' });
});

// Attendance
app.post('/api/attendance', (req, res) => {
    const { sessionPin, studentName, studentId, location } = req.body;
    
    const sessions = readJSON(SESSIONS_FILE);
    const attendance = readJSON(ATTENDANCE_FILE);
    const settings = readJSON(SETTINGS_FILE);
    
    const session = sessions.find(s => s.pin === sessionPin);
    
    if (!session) {
        return res.status(404).json({ success: false, message: 'رقم الجلسة غير صحيح' });
    }
    
    if (!session.isOpen) {
        return res.status(403).json({ success: false, message: 'عذراً، الجلسة مغلقة حالياً' });
    }
    
    if (settings.preventDuplicate) {
        const duplicate = attendance.find(
            a => a.sessionId === session.id && 
                 (a.studentId === studentId || 
                  a.studentName.toLowerCase() === studentName.toLowerCase())
        );
        
        if (duplicate) {
            return res.status(409).json({ success: false, message: 'لقد قمت بالتسجيل مسبقاً' });
        }
    }
    
    if (settings.requireLocation && session.location && location) {
        const distance = calculateDistance(
            session.location.latitude,
            session.location.longitude,
            location.latitude,
            location.longitude
        );
        
        if (distance > settings.locationRadius) {
            return res.status(403).json({ 
                success: false, 
                message: `أنت خارج نطاق الموقع المسموح (${Math.round(distance)} متر)` 
            });
        }
    }
    
    const newAttendance = {
        id: Date.now(),
        sessionId: session.id,
        sessionPin: sessionPin,
        studentName: studentName,
        studentId: studentId,
        location: location,
        timestamp: new Date().toISOString()
    };
    
    attendance.push(newAttendance);
    writeJSON(ATTENDANCE_FILE, attendance);
    
    const sessionIndex = sessions.findIndex(s => s.id === session.id);
    sessions[sessionIndex].attendanceCount = (sessions[sessionIndex].attendanceCount || 0) + 1;
    writeJSON(SESSIONS_FILE, sessions);
    
    res.json({ success: true, attendance: newAttendance });
});

app.get('/api/attendance/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const attendance = readJSON(ATTENDANCE_FILE);
    
    const sessionAttendance = attendance.filter(a => a.sessionId == sessionId);
    
    res.json({ success: true, attendance: sessionAttendance });
});

app.put('/api/attendance/:id', (req, res) => {
    const { id } = req.params;
    const { location } = req.body;
    const attendance = readJSON(ATTENDANCE_FILE);
    
    const attendanceIndex = attendance.findIndex(a => a.id == id);
    
    if (attendanceIndex !== -1) {
        attendance[attendanceIndex].location = location;
        attendance[attendanceIndex].locationEdited = true;
        attendance[attendanceIndex].editedAt = new Date().toISOString();
        writeJSON(ATTENDANCE_FILE, attendance);
        res.json({ success: true, attendance: attendance[attendanceIndex] });
    } else {
        res.status(404).json({ success: false, message: 'السجل غير موجود' });
    }
});

app.get('/api/qrcode/:pin', async (req, res) => {
    const { pin } = req.params;
    
    try {
        const qrCodeDataURL = await QRCode.toDataURL(pin, {
            width: 300,
            margin: 2,
            color: { dark: '#2563eb', light: '#ffffff' }
        });
        
        res.json({ success: true, qrCode: qrCodeDataURL });
    } catch (error) {
        res.status(500).json({ success: false, message: 'خطأ في توليد QR Code' });
    }
});

app.get('/api/settings', (req, res) => {
    const settings = readJSON(SETTINGS_FILE);
    res.json({ success: true, settings });
});

app.put('/api/settings', (req, res) => {
    const newSettings = req.body;
    writeJSON(SETTINGS_FILE, newSettings);
    res.json({ success: true, settings: newSettings });
});

app.get('/api/stats', (req, res) => {
    const sessions = readJSON(SESSIONS_FILE);
    const attendance = readJSON(ATTENDANCE_FILE);
    
    const stats = {
        totalSessions: sessions.length,
        activeSessions: sessions.filter(s => s.isOpen).length,
        totalAttendance: attendance.length
    };
    
    res.json({ success: true, stats });
});

// Change Password
app.post('/api/change-password', (req, res) => {
    const { userId, oldPassword, newPassword } = req.body;
    const users = readJSON(USERS_FILE);
    
    const userIndex = users.findIndex(u => u.id == userId);
    
    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }
    
    // التحقق من كلمة السر القديمة
    if (!bcrypt.compareSync(oldPassword, users[userIndex].password)) {
        return res.status(401).json({ success: false, message: 'كلمة السر القديمة غير صحيحة' });
    }
    
    // تشفير كلمة السر الجديدة
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    users[userIndex].password = hashedPassword;
    
    writeJSON(USERS_FILE, users);
    
    res.json({ success: true, message: 'تم تغيير كلمة السر بنجاح' });
});

// Add new user
app.post('/api/users', (req, res) => {
    const { username, password, name, role } = req.body;
    const users = readJSON(USERS_FILE);
    
    // التحقق من عدم تكرار اسم المستخدم
    if (users.find(u => u.username === username)) {
        return res.status(409).json({ success: false, message: 'اسم المستخدم موجود مسبقاً' });
    }
    
    const newUser = {
        id: Date.now(),
        username: username,
        password: bcrypt.hashSync(password, 10),
        name: name,
        role: role || 'teacher'
    };
    
    users.push(newUser);
    writeJSON(USERS_FILE, users);
    
    res.json({ success: true, user: { id: newUser.id, username: newUser.username, name: newUser.name } });
});

initDatabase();

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
