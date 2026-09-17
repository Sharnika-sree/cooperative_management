const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all service requests
router.get('/', auth, async (req, res) => {
  try {
    const { status, farmerId } = req.query;
    const where = {};

    if (req.user.role === 'FARMER') {
      const farmer = await prisma.farmer.findUnique({
        where: { userId: req.user.id }
      });
      if (farmer) {
        where.farmerId = farmer.id;
      } else {
        return res.json([]);
      }
    } else if (farmerId) {
      where.farmerId = farmerId;
    }

    if (status) {
      where.status = status;
    }

    const requests = await prisma.serviceRequest.findMany({
      where,
      include: { farmer: { select: { name: true, membershipId: true, village: true } } },
      orderBy: { createdAt: 'desc' }
    });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching service requests:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get statistics (ADMIN only)
router.get('/statistics', auth, authorize('ADMIN'), async (req, res) => {
  try {
    const total = await prisma.serviceRequest.count();
    const pending = await prisma.serviceRequest.count({ where: { status: 'PENDING' } });
    const approved = await prisma.serviceRequest.count({ where: { status: 'APPROVED' } });
    const rejected = await prisma.serviceRequest.count({ where: { status: 'REJECTED' } });
    const completed = await prisma.serviceRequest.count({ where: { status: 'COMPLETED' } });

    const byType = await prisma.serviceRequest.groupBy({
      by: ['type'],
      _count: { id: true }
    });

    res.json({
      total,
      pending,
      approved,
      rejected,
      completed,
      byType: byType.map(item => ({ type: item.type, count: item._count.id }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single request
router.get('/:id', auth, async (req, res) => {
  try {
    const request = await prisma.serviceRequest.findUnique({
      where: { id: req.params.id },
      include: { farmer: true }
    });

    if (!request) {
      return res.status(404).json({ error: 'Service request not found' });
    }

    if (req.user.role === 'FARMER') {
      const farmer = await prisma.farmer.findUnique({
        where: { userId: req.user.id }
      });
      if (farmer && request.farmerId !== farmer.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    res.json(request);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit service request (FARMER only)
router.post('/', auth, authorize('FARMER'), [
  body('type').notEmpty().withMessage('Service type required'),
  body('description').notEmpty().withMessage('Description required'),
  body('quantity').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const farmer = await prisma.farmer.findUnique({
      where: { userId: req.user.id }
    });

    if (!farmer) {
      return res.status(400).json({ error: 'Farmer profile not found. Please contact staff.' });
    }

    const { type, description, quantity } = req.body;

    const request = await prisma.serviceRequest.create({
      data: {
        farmerId: farmer.id,
        type,
        description,
        quantity: quantity || null,
        status: 'PENDING'
      }
    });

    res.status(201).json(request);
  } catch (error) {
    console.error('Error creating service request:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update request status (Staff or Admin)
router.put('/:id/status', auth, authorize('ADMIN', 'STAFF'), [
  body('status').isIn(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const request = await prisma.serviceRequest.update({
      where: { id: req.params.id },
      data: { status: req.body.status }
    });

    res.json(request);
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete request
router.delete('/:id', auth, authorize('ADMIN'), async (req, res) => {
  try {
    await prisma.serviceRequest.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Service request deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
