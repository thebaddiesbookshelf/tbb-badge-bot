

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Badge = require('../models/Badge');
const Category = require('../models/Category');
const UserBadge = require('../models/UserBadge');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../badges');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `badge_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create category
router.post('/categories', async (req, res) => {
  try {
    const { name, description, emoji } = req.body;
    
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({ error: 'Category already exists' });
    }
    
    const category = await Category.create({ name, description, emoji });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete category
router.delete('/categories/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Check if any badges use this category
    const badgeCount = await Badge.countDocuments({ category: category._id });
    if (badgeCount > 0) {
      return res.status(400).json({ error: `Cannot delete category with ${badgeCount} badges` });
    }
    
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all badges
router.get('/badges', async (req, res) => {
  try {
    const badges = await Badge.find().populate('category').sort({ createdAt: -1 });
    res.json(badges);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create badge
router.post('/badges', upload.single('image'), async (req, res) => {
  try {
    const { name, description, category } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }
    
    const existingBadge = await Badge.findOne({ name });
    if (existingBadge) {
      // Delete uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Badge with this name already exists' });
    }
    
    const badge = await Badge.create({
      name,
      description,
      imageUrl: `badges/${req.file.filename}`,
      category,
      createdBy: req.user.id
    });
    
    const populatedBadge = await Badge.findById(badge._id).populate('category');
    res.json(populatedBadge);
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

// Update badge
router.put('/badges/:id', upload.single('image'), async (req, res) => {
  try {
    const { name, description, category } = req.body;
    const badge = await Badge.findById(req.params.id);
    
    if (!badge) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Badge not found' });
    }
    
    const updates = {};
    if (name) updates.name = name;
    if (description) updates.description = description;
    if (category) updates.category = category;
    
    if (req.file) {
      // Delete old image
      const oldImagePath = path.join(__dirname, '../../', badge.imageUrl);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
      updates.imageUrl = `badges/${req.file.filename}`;
    }
    
    await Badge.findByIdAndUpdate(req.params.id, updates);
    const updatedBadge = await Badge.findById(req.params.id).populate('category');
    res.json(updatedBadge);
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
});

// Delete badge
router.delete('/badges/:id', async (req, res) => {
  try {
    const badge = await Badge.findById(req.params.id);
    if (!badge) {
      return res.status(404).json({ error: 'Badge not found' });
    }
    
    // Delete image file
    const imagePath = path.join(__dirname, '../../', badge.imageUrl);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
    
    // Delete all user badges
    await UserBadge.deleteMany({ badgeId: badge._id });
    
    // Delete badge
    await Badge.findByIdAndDelete(req.params.id);
    res.json({ message: 'Badge deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

