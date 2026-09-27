const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const schemes = await prisma.scheme.findMany({
      where: { isActive: true },
      orderBy: { deadline: 'asc' }
    });

    res.json(schemes);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/eligible/:farmerId', auth, async (req, res) => {
  try {
    const farmer = await prisma.farmer.findUnique({
      where: { id: req.params.farmerId },
      include: { crops: true }
    });

    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    const allSchemes = await prisma.scheme.findMany({
      where: { isActive: true }
    });

    const eligibleSchemes = allSchemes.map(scheme => {
      try {
        const rules = JSON.parse(scheme.eligibilityRules || '{}');
        
        if (rules.minLandSize && farmer.landSize < rules.minLandSize) {
          return { ...scheme, isEligible: false, reason: `Land size must be at least ${rules.minLandSize} ${farmer.landUnit || 'Acres'}` };
        }
        if (rules.maxLandSize && farmer.landSize > rules.maxLandSize) {
          return { ...scheme, isEligible: false, reason: `Land size must be less than ${rules.maxLandSize} ${farmer.landUnit || 'Acres'}` };
        }
        if (rules.requiredCrops && Array.isArray(rules.requiredCrops)) {
          const farmerCropNames = farmer.crops.map(c => c.name.toLowerCase());
          const hasRequiredCrop = rules.requiredCrops.some(rc => farmerCropNames.includes(rc.toLowerCase()));
          if (!hasRequiredCrop) {
            return { ...scheme, isEligible: false, reason: `Requires cultivating crop(s): ${rules.requiredCrops.join(', ')}` };
          }
        }
        
        return { ...scheme, isEligible: true, reason: 'All requirements satisfied' };
      } catch (e) {
        return { ...scheme, isEligible: true, reason: 'Eligible by default' };
      }
    });

    res.json(eligibleSchemes);
  } catch (error) {
    console.error('Error checking eligible schemes:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const scheme = await prisma.scheme.findUnique({
      where: { id: req.params.id }
    });

    if (!scheme) {
      return res.status(404).json({ error: 'Scheme not found' });
    }

    res.json(scheme);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', auth, authorize('ADMIN'), [
  body('title').notEmpty().withMessage('Title required'),
  body('description').notEmpty().withMessage('Description required'),
  body('eligibilityRules').notEmpty().withMessage('Eligibility rules required'),
  body('deadline').isISO8601().withMessage('Valid deadline required'),
  body('benefits').notEmpty().withMessage('Benefits required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const payload = {
      ...req.body,
      eligibilityRules: typeof req.body.eligibilityRules === 'string' 
        ? req.body.eligibilityRules 
        : JSON.stringify(req.body.eligibilityRules),
      requiredDocuments: Array.isArray(req.body.requiredDocuments)
        ? req.body.requiredDocuments.join(', ')
        : req.body.requiredDocuments
    };

    const scheme = await prisma.scheme.create({
      data: payload
    });

    res.status(201).json(scheme);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', auth, authorize('ADMIN'), async (req, res) => {
  try {
    const { title, description, eligibilityRules, requiredDocuments, deadline, benefits, isActive } = req.body;
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (eligibilityRules !== undefined) {
      updateData.eligibilityRules = typeof eligibilityRules === 'string' 
        ? eligibilityRules 
        : JSON.stringify(eligibilityRules);
    }
    if (requiredDocuments !== undefined) {
      updateData.requiredDocuments = Array.isArray(requiredDocuments)
        ? requiredDocuments.join(', ')
        : (requiredDocuments || '');
    }
    if (deadline !== undefined) updateData.deadline = new Date(deadline);
    if (benefits !== undefined) updateData.benefits = benefits;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const scheme = await prisma.scheme.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json(scheme);
  } catch (error) {
    console.error('Error updating scheme:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', auth, authorize('ADMIN'), async (req, res) => {
  try {
    await prisma.scheme.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Scheme deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
