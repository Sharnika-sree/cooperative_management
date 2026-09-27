const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/latest', auth, async (req, res) => {
  try {
    const latestData = await prisma.warehouseData.findFirst({
      orderBy: { timestamp: 'desc' }
    });

    if (!latestData) {
      return res.json({ temperature: 0, humidity: 0, timestamp: null });
    }

    res.json(latestData);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/history', auth, async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const history = await prisma.warehouseData.findMany({
      where: { timestamp: { gte: since } },
      orderBy: { timestamp: 'desc' },
      take: 100
    });

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', auth, authorize('ADMIN', 'STAFF'), [
  body('temperature').isFloat().withMessage('Valid temperature required'),
  body('humidity').isFloat({ min: 0, max: 100 }).withMessage('Valid humidity (0-100) required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { temperature, humidity } = req.body;

    const data = await prisma.warehouseData.create({
      data: { temperature, humidity }
    });

    const alert = humidity > 70 ? { 
      type: 'HIGH_HUMIDITY', 
      message: `Humidity ${humidity}% exceeds threshold`,
      timestamp: data.timestamp 
    } : null;

    res.status(201).json({ data, alert });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
