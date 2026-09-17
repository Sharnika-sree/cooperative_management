const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Get unregistered farmer users
router.get('/unregistered-users', auth, authorize('ADMIN', 'STAFF'), async (req, res) => {
  try {
    const unregistered = await prisma.user.findMany({
      where: {
        role: 'FARMER',
        farmerProfile: null
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    });
    res.json(unregistered);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all farmers with filters
router.get('/', auth, async (req, res) => {
  try {
    const { search, village, crop } = req.query;
    
    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { membershipId: { contains: search, mode: 'insensitive' } },
        { mobileNumber: { contains: search } }
      ];
    }
    if (village) where.village = { contains: village, mode: 'insensitive' };
    if (crop) {
      where.crops = {
        some: {
          name: { contains: crop, mode: 'insensitive' }
        }
      };
    }

    const farmers = await prisma.farmer.findMany({
      where,
      include: { 
        user: { select: { email: true, role: true } },
        crops: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(farmers);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single farmer by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const farmer = await prisma.farmer.findUnique({
      where: { id: req.params.id },
      include: { 
        user: { select: { email: true, role: true } },
        crops: true
      }
    });

    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    res.json(farmer);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new farmer profile
router.post('/', auth, authorize('ADMIN', 'STAFF'), [
  body('userId').notEmpty().withMessage('User ID required'),
  body('membershipId').notEmpty().withMessage('Membership ID required'),
  body('name').notEmpty().withMessage('Name required'),
  body('mobileNumber').notEmpty().withMessage('Mobile number required'),
  body('village').notEmpty().withMessage('Village required'),
  body('landSize').isFloat().withMessage('Valid land size required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      userId, membershipId, name, mobileNumber, village, landSize,
      crops, crop, age, gender, address, district, landUnit, farmingType, irrigationType 
    } = req.body;

    // Check if profile already exists for user
    const existing = await prisma.farmer.findUnique({ where: { userId } });
    if (existing) {
      return res.status(400).json({ error: 'Farmer profile already exists for this user' });
    }

    // Check if membership ID is unique
    const existingMem = await prisma.farmer.findUnique({ where: { membershipId } });
    if (existingMem) {
      return res.status(400).json({ error: 'Membership ID already in use' });
    }

    // Parse crops
    let cropsArray = [];
    if (Array.isArray(crops)) {
      cropsArray = crops;
    } else if (typeof crops === 'string') {
      cropsArray = crops.split(',').map(c => c.trim()).filter(Boolean);
    } else if (typeof crop === 'string') {
      cropsArray = crop.split(',').map(c => c.trim()).filter(Boolean);
    }

    const farmer = await prisma.farmer.create({
      data: {
        userId,
        membershipId,
        name,
        mobileNumber,
        village,
        landSize: parseFloat(landSize),
        crop: cropsArray.join(', '), // fallback legacy column
        age: age ? parseInt(age) : null,
        gender,
        address,
        district,
        landUnit: landUnit || 'Acres',
        farmingType,
        irrigationType,
        crops: {
          create: cropsArray.map(name => ({ name }))
        }
      },
      include: { crops: true }
    });

    res.status(201).json(farmer);
  } catch (error) {
    console.error('Error creating farmer:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update farmer profile
router.put('/:id', auth, [
  body('name').optional().notEmpty(),
  body('mobileNumber').optional().notEmpty(),
  body('village').optional().notEmpty(),
  body('landSize').optional().isFloat(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Authorization check: Staff can update anyone; Farmers can only update their own profile
    const farmerToUpdate = await prisma.farmer.findUnique({ where: { id: req.params.id } });
    if (!farmerToUpdate) {
      return res.status(404).json({ error: 'Farmer profile not found' });
    }

    if (req.user.role === 'FARMER' && farmerToUpdate.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this profile' });
    }

    // Do not allow farmer to modify system-protected values
    if (req.user.role === 'FARMER') {
      delete req.body.userId;
      delete req.body.membershipId;
      delete req.body.createdAt;
      delete req.body.registrationDate;
    }

    const { 
      crops, crop, landSize, age, ...farmerData 
    } = req.body;

    let cropsArray = null;
    if (crops !== undefined) {
      if (Array.isArray(crops)) {
        cropsArray = crops;
      } else if (typeof crops === 'string') {
        cropsArray = crops.split(',').map(c => c.trim()).filter(Boolean);
      }
    } else if (crop !== undefined && typeof crop === 'string') {
      cropsArray = crop.split(',').map(c => c.trim()).filter(Boolean);
    }

    const updateData = {
      ...farmerData,
    };

    if (landSize !== undefined) updateData.landSize = parseFloat(landSize);
    if (age !== undefined) updateData.age = age ? parseInt(age) : null;

    // Use Prisma transaction to replace old crops
    if (cropsArray !== null) {
      updateData.crop = cropsArray.join(', ');
      updateData.crops = {
        deleteMany: {},
        create: cropsArray.map(name => ({ name }))
      };
    }

    const farmer = await prisma.farmer.update({
      where: { id: req.params.id },
      data: updateData,
      include: { crops: true }
    });

    res.json(farmer);
  } catch (error) {
    console.error('Error updating farmer:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete farmer profile
router.delete('/:id', auth, authorize('ADMIN', 'STAFF'), async (req, res) => {
  try {
    const farmer = await prisma.farmer.findUnique({
      where: { id: req.params.id },
      include: { user: true }
    });

    if (!farmer) {
      return res.status(404).json({ error: 'Farmer profile not found' });
    }

    // Do NOT allow a user to delete their own account
    if (farmer.userId === req.user.id) {
      return res.status(403).json({ error: 'You cannot delete your own account' });
    }

    // Do NOT allow Staff/Admin to delete Admin or Staff accounts
    if (farmer.user.role === 'ADMIN' || farmer.user.role === 'STAFF') {
      return res.status(403).json({ error: 'Cannot delete Admin or Staff accounts' });
    }

    // Perform cascading deletions in a transaction to prevent database foreign key constraint errors
    await prisma.$transaction([
      prisma.crop.deleteMany({ where: { farmerId: farmer.id } }),
      prisma.serviceRequest.deleteMany({ where: { farmerId: farmer.id } }),
      prisma.distribution.deleteMany({ where: { farmerId: farmer.id } }),
      prisma.inventoryTransaction.deleteMany({ where: { farmerId: farmer.id } }),
      prisma.farmer.delete({ where: { id: farmer.id } }),
      prisma.user.delete({ where: { id: farmer.userId } })
    ]);

    res.json({ message: 'Farmer deleted successfully' });
  } catch (error) {
    console.error('Error deleting farmer:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
