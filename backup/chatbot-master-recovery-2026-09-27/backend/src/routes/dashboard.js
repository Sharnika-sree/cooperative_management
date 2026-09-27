const express = require('express');
const prisma = require('../config/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const role = req.user.role;

    if (role === 'ADMIN') {
      const totalFarmers = await prisma.farmer.count();
      const totalStaff = await prisma.user.count({ where: { role: 'STAFF' } });
      const inventory = await prisma.inventory.findMany();
      const activeSchemes = await prisma.scheme.count({ where: { isActive: true } });
      const pendingServiceRequests = await prisma.serviceRequest.count({ where: { status: 'PENDING' } });
      
      const warehouse = await prisma.warehouseData.findFirst({
        orderBy: { timestamp: 'desc' }
      });

      // Aggregate distributions for charts
      const distributions = await prisma.distribution.findMany({
        include: { inventory: true }
      });
      const inventoryUsageMap = {};
      distributions.forEach(d => {
        if (d.inventory) {
          const name = d.inventory.name;
          inventoryUsageMap[name] = (inventoryUsageMap[name] || 0) + d.quantity;
        }
      });
      const inventoryUsage = Object.keys(inventoryUsageMap).map(name => ({
        name,
        totalQuantity: inventoryUsageMap[name]
      }));

      // Service requests chart data
      const requestsByStatus = await prisma.serviceRequest.groupBy({
        by: ['status'],
        _count: { id: true }
      });
      const requestsByType = await prisma.serviceRequest.groupBy({
        by: ['type'],
        _count: { id: true }
      });

      return res.json({
        role,
        totalFarmers,
        totalStaff,
        availableInventory: inventory.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit, type: i.type })),
        activeSchemes,
        pendingServiceRequests,
        warehouse: warehouse ? {
          temperature: warehouse.temperature,
          humidity: warehouse.humidity,
          timestamp: warehouse.timestamp,
          alert: warehouse.humidity > 70
        } : null,
        charts: {
          inventoryUsage,
          requestsByStatus: requestsByStatus.map(r => ({ status: r.status, count: r._count.id })),
          requestsByType: requestsByType.map(r => ({ type: r.type, count: r._count.id }))
        }
      });
    }

    if (role === 'STAFF') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayFarmers = await prisma.farmer.count({
        where: { createdAt: { gte: todayStart } }
      });

      const inventory = await prisma.inventory.findMany();
      const inventoryAvailable = inventory.length;

      // Pending distributions (pending service requests of type fertilizer/seed)
      const pendingDistributions = await prisma.serviceRequest.count({
        where: {
          status: 'PENDING',
          OR: [
            { type: { contains: 'Fertilizer' } },
            { type: { contains: 'Seed' } },
            { type: { contains: 'fertilizer' } },
            { type: { contains: 'seed' } }
          ]
        }
      });

      const pendingServiceRequests = await prisma.serviceRequest.count({
        where: { status: 'PENDING' }
      });

      return res.json({
        role,
        todayFarmers,
        inventoryAvailable,
        pendingDistributions,
        pendingServiceRequests
      });
    }

    if (role === 'FARMER') {
      const farmer = await prisma.farmer.findUnique({
        where: { userId: req.user.id },
        include: { crops: true }
      });

      if (!farmer) {
        return res.json({
          role,
          farmerProfile: null,
          eligibleSchemes: [],
          availableFertilizers: [],
          recentAnnouncements: []
        });
      }

      // Rule-based eligibility filtering
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

      const fertilizers = await prisma.inventory.findMany({});

      const announcements = await prisma.announcement.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      const warehouse = await prisma.warehouseData.findFirst({
        orderBy: { timestamp: 'desc' }
      });

      return res.json({
        role,
        farmerProfile: {
          id: farmer.id,
          name: farmer.name,
          membershipId: farmer.membershipId,
          village: farmer.village,
          landSize: farmer.landSize,
          mobileNumber: farmer.mobileNumber,
          age: farmer.age,
          gender: farmer.gender,
          address: farmer.address,
          district: farmer.district,
          landUnit: farmer.landUnit || 'Acres',
          farmingType: farmer.farmingType,
          irrigationType: farmer.irrigationType,
          registrationDate: farmer.registrationDate,
          crops: farmer.crops.map(c => c.name)
        },
        eligibleSchemesCount: eligibleSchemes.filter(s => s.isEligible).length,
        eligibleSchemes: eligibleSchemes,
        availableFertilizers: fertilizers.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
        recentAnnouncements: announcements,
        warehouse: warehouse ? {
          temperature: warehouse.temperature,
          humidity: warehouse.humidity,
          timestamp: warehouse.timestamp,
          alert: warehouse.humidity > 70
        } : null
      });
    }

    return 	res.status(400).json({ error: 'Invalid user role' });
  } catch (error) {
    console.error('Dashboard route error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
