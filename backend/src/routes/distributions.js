const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Get distributions list
router.get('/', auth, async (req, res) => {
  try {
    const { farmerId, inventoryId } = req.query;
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

    if (inventoryId) {
      where.inventoryId = inventoryId;
    }

    const distributions = await prisma.distribution.findMany({
      where,
      include: {
        farmer: { select: { name: true, membershipId: true, village: true } },
        inventory: { select: { name: true, type: true, unit: true } }
      },
      orderBy: { distributedAt: 'desc' }
    });

    res.json(distributions);
  } catch (error) {
    console.error('Error fetching distributions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get statistics (ADMIN or STAFF)
router.get('/statistics', auth, authorize('ADMIN', 'STAFF'), async (req, res) => {
  try {
    const total = await prisma.distribution.count();
    const today = await prisma.distribution.count({
      where: {
        distributedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    });

    const byItem = await prisma.distribution.groupBy({
      by: ['inventoryId'],
      _sum: { quantity: true },
      _count: { id: true }
    });

    const itemsWithNames = await Promise.all(
      byItem.map(async (item) => {
        const inventory = await prisma.inventory.findUnique({
          where: { id: item.inventoryId },
          select: { name: true, unit: true }
        });
        return {
          name: inventory?.name,
          unit: inventory?.unit,
          totalQuantity: item._sum.quantity,
          count: item._count.id
        };
      })
    );

    res.json({
      total,
      today,
      byItem: itemsWithNames
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit a new distribution (STAFF and ADMIN)
router.post('/', auth, authorize('ADMIN', 'STAFF'), [
  body('farmerId').notEmpty().withMessage('Farmer ID required'),
  body('inventoryId').notEmpty().withMessage('Inventory ID required'),
  body('quantity').isFloat({ min: 0.01 }).withMessage('Quantity must be greater than zero')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { farmerId, inventoryId, quantity } = req.body;

    // 1. Validate Farmer
    const farmer = await prisma.farmer.findUnique({
      where: { id: farmerId }
    });
    if (!farmer) {
      return res.status(404).json({ error: 'Invalid farmer. Farmer profile not found.' });
    }

    // 2. Validate Inventory Item
    const inventory = await prisma.inventory.findUnique({
      where: { id: inventoryId }
    });
    if (!inventory) {
      return res.status(404).json({ error: 'Invalid inventory item. Item not found.' });
    }

    // 3. Prevent Negative / Zero values
    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }

    // 4. Validate quantity does not exceed available stock
    if (inventory.quantity < quantity) {
      return res.status(400).json({ error: `Requested quantity exceeds available stock (${inventory.quantity} ${inventory.unit} available)` });
    }

    // 5. Decrement inventory and log distribution record
    await prisma.$transaction([
      prisma.inventory.update({
        where: { id: inventoryId },
        data: { quantity: { decrement: quantity } }
      }),
      prisma.distribution.create({
        data: {
          farmerId,
          inventoryId,
          quantity,
          distributedBy: req.user.name || 'Staff Member',
          status: 'COMPLETED'
        }
      })
    ]);

    // Fetch the completed distribution to return
    const distribution = await prisma.distribution.findFirst({
      where: {
        farmerId,
        inventoryId,
        distributedBy: req.user.name || 'Staff Member'
      },
      orderBy: { distributedAt: 'desc' },
      include: {
        farmer: { select: { name: true, membershipId: true } },
        inventory: { select: { name: true, unit: true } }
      }
    });

    res.status(201).json(distribution);
  } catch (error) {
    console.error('Error logging distribution:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
