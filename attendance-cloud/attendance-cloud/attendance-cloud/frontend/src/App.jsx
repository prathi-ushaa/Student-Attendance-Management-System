import React, { useEffect, useState } from 'react';
import { api, setToken } from './api.js';

const today = () => new Date().toISOString().slice(0, 10);

/* ---------- Login / Register ---------- */
function Auth({ onDone }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'student', rollNo: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const d = await api('/auth/' + mode, { method: 'POST', body: f });
      setToken(d.token);
      localStorage.setItem('user', JSON.stringify(d.user));
      onDone(d.user);
    } catch (x) { setErr(x.message); }
  };

  return (
    <form className="panel auth" onSubmit={submit}>
      <h1>{mode === 'login' ? 'Log in' : 'Create account'}</h1>
      {mode === 'register' && (
        <>
          <input placeholder="Full name" value={f.name} onChange={set('name')} required />
          <input placeholder="Roll number (students)" value={f.rollNo} onChange={set('rollNo')} />
          <select value={f.role} onChange={set('role')}>
            <option value="student">Student</option>
            <option value="faculty">Faculty</option>
            <option value="admin">Admin</option>
          </select>
        </>
      )}
      <input type="email" placeholder="Email" value={f.email} onChange={set('email')} required />
      <input type="password" placeholder="Password" value={f.password} onChange={set('password')} required />
      {err && <p className="error">{err}</p>}
      <button className="primary">{mode === 'login' ? 'Log in' : 'Create account'}</button>
      <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
      </button>
    </form>
  );
}

/* ---------- Faculty: mark attendance ---------- */
function Mark() {
  const [students, setStudents] = useState([]);
  const [status, setStatus] = useState({});
  const [meta, setMeta] = useState({ subject: '', date: today(), period: 1 });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api('/students').then((s) => {
      setStudents(s);
      setStatus(Object.fromEntries(s.map((x) => [x._id, 'present'])));
    });
  }, []);

  const toggle = (id) => setStatus({ ...status, [id]: status[id] === 'present' ? 'absent' : 'present' });

  const save = async () => {
    setMsg('');
    try {
      const records = students.map((s) => ({ student: s._id, status: status[s._id] }));
      const d = await api('/attendance/mark', { method: 'POST', body: { ...meta, records } });
      setMsg(`Saved attendance for ${d.saved} students.`);
    } catch (x) { setMsg(x.message); }
  };

  return (
    <section className="panel">
      <h2>Mark attendance</h2>
      <div className="row">
        <input placeholder="Subject" value={meta.subject} onChange={(e) => setMeta({ ...meta, subject: e.target.value })} />
        <input type="date" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} />
        <input type="number" min="1" max="8" value={meta.period} onChange={(e) => setMeta({ ...meta, period: e.target.value })} />
      </div>
      {students.length === 0 && <p className="muted">No students yet. Ask students to create an account first.</p>}
      <ul className="roll">
        {students.map((s) => (
          <li key={s._id}>
            <span>{s.rollNo || '-'} &nbsp; {s.name}</span>
            <button className={'chip ' + status[s._id]} onClick={() => toggle(s._id)}>{status[s._id]}</button>
          </li>
        ))}
      </ul>
      <button className="primary" onClick={save} disabled={!meta.subject || !students.length}>Save attendance</button>
      {msg && <p className="muted">{msg}</p>}
    </section>
  );
}

/* ---------- Table used by both views ---------- */
function Table({ rows, showName }) {
  if (!rows.length) return <p className="muted">Nothing to show yet.</p>;
  return (
    <table>
      <thead><tr>{showName && <th>Student</th>}<th>Subject</th><th>Present</th><th>Total</th><th>Attendance</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={r.percent < 75 ? 'low' : ''}>
            {showName && <td>{r.rollNo} {r.name}</td>}
            <td>{r.subject}</td><td>{r.present}</td><td>{r.total}</td><td>{r.percent}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Low() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api('/attendance/low').then(setRows); }, []);
  const download = async () => {
    const blob = await api('/attendance/report.csv', { raw: true });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'attendance-report.csv';
    a.click();
  };
  return (
    <section className="panel">
      <div className="row between">
        <h2>Below 75%</h2>
        <button onClick={download}>Download CSV report</button>
      </div>
      <Table rows={rows} showName />
    </section>
  );
}

function Mine() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api('/attendance/me').then(setRows); }, []);
  return (
    <section className="panel">
      <h2>My attendance</h2>
      <Table rows={rows} />
    </section>
  );
}

/* ---------- App shell ---------- */
export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const logout = () => { setToken(''); localStorage.removeItem('user'); setUser(null); };

  if (!user) return <main><Auth onDone={setUser} /></main>;
  return (
    <main>
      <header>
        <strong>Class Attendance</strong>
        <span>{user.name} ({user.role}) <button className="link" onClick={logout}>Log out</button></span>
      </header>
      {user.role === 'student' ? <Mine /> : <><Mark /><Low /></>}
    </main>
  );
}
