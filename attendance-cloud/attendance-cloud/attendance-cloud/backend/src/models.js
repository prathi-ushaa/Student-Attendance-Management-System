const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'faculty', 'student'], default: 'student' },
  rollNo: String,
});

const attendanceSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },            // YYYY-MM-DD
  subject: { type: String, required: true },
  period: { type: Number, required: true },
  status: { type: String, enum: ['present', 'absent'], required: true },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});
attendanceSchema.index({ student: 1, date: 1, subject: 1, period: 1 }, { unique: true });

module.exports = {
  User: mongoose.model('User', userSchema),
  Attendance: mongoose.model('Attendance', attendanceSchema),
};
