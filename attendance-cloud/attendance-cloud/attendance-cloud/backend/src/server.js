const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { User, Attendance } = require('./models');
const { sign, requireAuth } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

const THRESHOLD = 75;

// ---------- helpers ----------
// Attendance % per student per subject
async function summary(match = {}) {
  return Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: { student: '$student', subject: '$subject' },
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
      },
    },
    { $lookup: { from: 'users', localField: '_id.student', foreignField: '_id', as: 'u' } },
    { $unwind: '$u' },
    {
      $project: {
        _id: 0,
        studentId: '$_id.student',
        name: '$u.name',
        rollNo: '$u.rollNo',
        subject: '$_id.subject',
        total: 1,
        present: 1,
        percent: { $round: [{ $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 1] },
      },
    },
    { $sort: { rollNo: 1, subject: 1 } },
  ]);
}

// ---------- health (used by AWS load balancer / docker) ----------
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ---------- auth ----------
// NOTE: open registration is for demo only. In production, only admins should create faculty/admin accounts.
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, rollNo } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
    const user = await User.create({
      name, email, rollNo,
      role: ['admin', 'faculty', 'student'].includes(role) ? role : 'student',
      password: await bcrypt.hash(password, 10),
    });
    res.json({ token: sign(user), user: { name: user.name, role: user.role } });
  } catch (e) {
    res.status(400).json({ error: e.code === 11000 ? 'That email is already registered.' : e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const user = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  res.json({ token: sign(user), user: { name: user.name, role: user.role } });
});

// ---------- students ----------
app.get('/api/students', requireAuth('faculty', 'admin'), async (_req, res) => {
  res.json(await User.find({ role: 'student' }).select('name rollNo').sort('rollNo'));
});

// ---------- attendance ----------
// body: { subject, date, period, records: [{ student, status }] }
app.post('/api/attendance/mark', requireAuth('faculty', 'admin'), async (req, res) => {
  const { subject, date, period, records } = req.body;
  if (!subject || !date || !period || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Subject, date, period and records are required.' });
  }
  await Attendance.bulkWrite(
    records.map((r) => ({
      updateOne: {
        filter: { student: r.student, date, subject, period: Number(period) },
        update: { $set: { status: r.status, markedBy: req.user.id } },
        upsert: true,
      },
    }))
  );
  res.json({ saved: records.length });
});

// student: own summary
app.get('/api/attendance/me', requireAuth('student'), async (req, res) => {
  const rows = await summary({ student: new mongoose.Types.ObjectId(req.user.id) });
  res.json(rows);
});

// faculty/admin: everyone below threshold
app.get('/api/attendance/low', requireAuth('faculty', 'admin'), async (_req, res) => {
  const rows = await summary();
  res.json(rows.filter((r) => r.percent < THRESHOLD));
});

// faculty/admin: CSV report
app.get('/api/attendance/report.csv', requireAuth('faculty', 'admin'), async (_req, res) => {
  const rows = await summary();
  const csv = ['Roll No,Name,Subject,Present,Total,Percent']
    .concat(rows.map((r) => [r.rollNo, r.name, r.subject, r.present, r.total, r.percent].join(',')))
    .join('\n');
  res.header('Content-Type', 'text/csv').attachment('attendance-report.csv').send(csv);
});

// ---------- start (retry until MongoDB is up) ----------
async function start() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/attendance';
  for (let i = 0; i < 20; i++) {
    try { await mongoose.connect(uri); break; }
    catch { console.log('Waiting for MongoDB...'); await new Promise((r) => setTimeout(r, 3000)); }
  }
  app.listen(process.env.PORT || 5000, () => console.log('API running'));
}
start();
