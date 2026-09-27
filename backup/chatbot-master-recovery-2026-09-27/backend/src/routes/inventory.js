const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const { type } = req.query;
    const where = type ? { type: type.toUpperCase() } : {};

    const inventory = await prisma.inventory.findMany({
      where,
      include: {
        transactions: {
          take: 10,
          orderBy: { date: 'desc' },
          include: { farmer: { select: { name: true, membershipId: true } } }
        }
      },
      orderBy: { name: 'asc' }
    });

    const lowStock = inventory.filter(item => item.quantity <= item.minStock);

    res.json({ inventory, lowStock });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const inventory = await prisma.inventory.findUnique({
      where: { id: req.params.id },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
          include: { farmer: { select: { name: true, membershipId: true } } }
        }
      }
    });

    if (!inventory) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', auth, authorize('ADMIN', 'STAFF'), [
  body('name').notEmpty().withMessage('Name required'),
  body('type').isIn(['SEED', 'FERTILIZER', 'PESTICIDE', 'OTHER']).withMessage('Invalid type').optional(),
  body('quantity').isFloat({ min: 0 }).withMessage('Valid quantity required'),
  body('unit').notEmpty().withMessage('Unit required'),
  body('minStock').isFloat({ min: 0 }).withMessage('Valid minimum stock required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const inventory = await prisma.inventory.create({
      data: req.body
    });

    res.status(201).json(inventory);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', auth, authorize('ADMIN', 'STAFF'), [
  body('name').optional().notEmpty(),
  body('type').optional(),
  body('quantity').optional().isFloat({ min: 0 }),
  body('unit').optional().notEmpty(),
  body('minStock').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const inventory = await prisma.inventory.update({
      where: { id: req.params.id },
      data: req.body
    });

    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id', auth, authorize('ADMIN', 'STAFF'), [
  body('name').optional().notEmpty().withMessage('Item name cannot be empty'),
  body('type').optional().isIn(['SEED', 'FERTILIZER', 'PESTICIDE', 'OTHER']).withMessage('Invalid type'),
  body('unit').optional().notEmpty().withMessage('Unit cannot be empty'),
  body('minStock').optional().isFloat({ min: 0 }).withMessage('Minimum stock must be a non-negative number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { action, quantity, name, type, unit, minStock } = req.body;
    const inventoryId = req.params.id;

    const inventory = await prisma.inventory.findUnique({
      where: { id: inventoryId }
    });

    if (!inventory) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    let updateData = {};

    if (action && quantity !== undefined) {
      const qty = parseFloat(quantity);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ error: 'Quantity must be a positive number' });
      }

      let newQuantity = inventory.quantity;
      if (action === 'ADD') {
        newQuantity += qty;
      } else if (action === 'REDUCE') {
        if (inventory.quantity < qty) {
          return res.status(400).json({ error: 'Insufficient stock available.' });
        }
        newQuantity -= qty;
      } else {
        return res.status(400).json({ error: 'Invalid action. Must be ADD or REDUCE' });
      }

      updateData.quantity = newQuantity;
    }

    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (unit !== undefined) updateData.unit = unit;
    if (minStock !== undefined) updateData.minStock = parseFloat(minStock);

    const updated = await prisma.inventory.update({
      where: { id: inventoryId },
      data: updateData
    });

    res.json(updated);
  } catch (error) {
    console.error('Error patching inventory:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', auth, authorize('ADMIN', 'STAFF'), async (req, res) => {
  try {
    await prisma.inventory.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/transaction', auth, authorize('ADMIN', 'STAFF'), [
  body('farmerId').notEmpty().withMessage('Farmer ID required'),
  body('quantity').isFloat({ min: 0 }).withMessage('Valid quantity required'),
  body('type').isIn(['IN', 'OUT']).withMessage('Type must be IN or OUT')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { farmerId, quantity, type } = req.body;
    const inventoryId = req.params.id;

    const inventory = await prisma.inventory.findUnique({ where: { id: inventoryId } });
    
    if (type === 'OUT' && inventory.quantity < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    const newQuantity = type === 'IN' 
      ? inventory.quantity + quantity 
      : inventory.quantity - quantity;

    await prisma.$transaction([
      prisma.inventory.update({
        where: { id: inventoryId },
        data: { quantity: newQuantity }
      }),
      prisma.inventoryTransaction.create({
        data: { inventoryId, farmerId, quantity, type }
      })
    ]);

    res.json({ message: 'Transaction recorded successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
