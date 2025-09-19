import React, { useState } from 'react';

const Profile = ({ user, onComplete, onLogout }) => {
  // Example fields; can be extended as needed
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    address: '',
    age: '',
    department: '', // gov only
    organization: '' // gov only
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Basic validation
    if (!form.fullName || !form.phone || !form.address || (user.type === 'gov' && (!form.department || !form.organization))) {
      setError('Please fill all required fields.');
      return;
    }
    setError('');
    try {
      await window.axios.patch('http://localhost:5000/api/users/${user.username}', form);
      onComplete(form);
    } catch (err) {
      setError('Failed to save profile');
    }
  };

  return (
    <div className="profile-form-container">
      <button style={{ float: 'right', margin: 10 }} onClick={onLogout} type="button">Logout</button>
      <h2>Complete Your Profile</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Full Name:</label>
          <input name="fullName" value={form.fullName} onChange={handleChange} required />
        </div>
        <div>
          <label>Phone:</label>
          <input name="phone" value={form.phone} onChange={handleChange} required />
        </div>
        <div>
          <label>Address:</label>
          <input name="address" value={form.address} onChange={handleChange} required />
        </div>
        <div>
          <label>Age:</label>
          <input name="age" type="number" value={form.age} onChange={handleChange} />
        </div>
        {user.type === 'gov' && (
          <>
            <div>
              <label>Department:</label>
              <input name="department" value={form.department} onChange={handleChange} required />
            </div>
            <div>
              <label>Organization:</label>
              <input name="organization" value={form.organization} onChange={handleChange} required />
            </div>
          </>
        )}
        {error && <div style={{ color: 'red' }}>{error}</div>}
        <button type="submit">Save Profile</button>
      </form>
    </div>
  );
};

export default Profile;
