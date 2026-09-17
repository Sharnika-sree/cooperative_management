const express = require('express');
const soilService = require('../Services/soilService');
const router = express.Router();

// 1. Get Crop Suitability in a District
// Example: GET /api/soil/suitability?crop=groundnut&district=Salem
router.get('/suitability', async (req, res) => {
  try {
    const { crop, district } = req.query;
    if (!crop || !district) {
      return res.status(400).json({ error: 'Both "crop" and "district" query parameters are required.' });
    }

    const result = await soilService.getCropSuitability(crop, district);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('Error in /api/soil/suitability:', error);
    res.status(500).json({ error: 'Failed to retrieve soil suitability data.' });
  }
});

// 2. Get Water Requirement for a Crop
// Example: GET /api/soil/water?crop=rice&district=Thanjavur
router.get('/water', async (req, res) => {
  try {
    const { crop, district } = req.query;
    if (!crop) {
      return res.status(400).json({ error: '"crop" query parameter is required.' });
    }

    const result = await soilService.getWaterRequirement(crop, district);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('Error in /api/soil/water:', error);
    res.status(500).json({ error: 'Failed to retrieve water requirement data.' });
  }
});

// 3. Get Climate Requirement & District Recorded Climate
// Example: GET /api/soil/climate?crop=rice&district=Thanjavur
router.get('/climate', async (req, res) => {
  try {
    const { crop, district } = req.query;
    if (!crop) {
      return res.status(400).json({ error: '"crop" query parameter is required.' });
    }

    const result = await soilService.getCropClimate(crop, district);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('Error in /api/soil/climate:', error);
    res.status(500).json({ error: 'Failed to retrieve climate requirements.' });
  }
});

// 4. Get Recommended Crops for a District
// Example: GET /api/soil/crops?district=Thanjavur
router.get('/crops', async (req, res) => {
  try {
    const { district } = req.query;
    if (!district) {
      return res.status(400).json({ error: '"district" query parameter is required.' });
    }

    const result = await soilService.getSuitableCrops(district);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('Error in /api/soil/crops:', error);
    res.status(500).json({ error: 'Failed to retrieve crop recommendations.' });
  }
});

// 5. Check Manual / IoT Soil Suitability
// Example: POST /api/soil/check
router.post('/check', async (req, res) => {
  try {
    const {
      district,
      soilType,
      crop,
      nitrogen,
      phosphorus,
      potassium,
      temperature,
      humidity,
      moisture
    } = req.body;

    if (!crop) {
      return res.status(400).json({ error: 'Crop name is required.' });
    }

    const result = await soilService.checkManualSoilSuitability({
      district,
      soilType,
      crop,
      nitrogen,
      phosphorus,
      potassium,
      temperature,
      humidity,
      moisture
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in /api/soil/check:', error);
    res.status(500).json({ error: 'Failed to evaluate soil suitability.' });
  }
});

// 6. Get Available Crops & Districts Metadata for UI Form
router.get('/meta', async (req, res) => {
  try {
    await soilService.ensureLoaded();
    res.json({
      districts: Array.from(soilService.districtsSet).sort(),
      crops: Array.from(soilService.cropsSet).sort()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch soil metadata.' });
  }
});

module.exports = router;
