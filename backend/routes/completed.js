const express = require('express');
const router = express.Router();
const Completed = require('../models/Completed');
const User = require('../models/User');

// POST: Add a completed complaint
router.post('/', async (req, res) => {
  try {
    const { description, category, location, status, by } = req.body;
    if (!by) return res.status(400).json({ message: 'Missing "by" field (gov username)' });
    const completed = new Completed({
      description,
      category,
      location,
      status: status || 'success',
      by
    });
    await completed.save();
    // Add this completed task to the user's completedTasks array
    const user = await User.findOneAndUpdate(
      { username: by },
      { $push: { completedTasks: completed._id.toString() } },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found for "by"' });
    res.status(201).json(completed);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET: Retrieve completed complaints
router.get('/', async (req, res) => {
  try {
    const { by } = req.query; // Filter by government employee
    const query = by ? { by } : {};
    const completed = await Completed.find(query);
    res.json(completed);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
