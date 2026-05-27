import {
  getProvinces,
  getDistricts,
  getWards,
  calculateShippingFee
} from "../services/ghn.service.js";

export const getGHNProvinces = async (_req, res) => {
  try {
    const data = await getProvinces();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getGHNDistricts = async (req, res) => {
  try {
    const provinceId = req.query.province_id;
    if (!provinceId) {
      return res.status(400).json({ success: false, message: "province_id is required" });
    }
    const data = await getDistricts(provinceId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getGHNWards = async (req, res) => {
  try {
    const districtId = req.query.district_id;
    if (!districtId) {
      return res.status(400).json({ success: false, message: "district_id is required" });
    }
    const data = await getWards(districtId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getShippingFee = async (req, res) => {
  try {
    const { toDistrictId, toWardCode, weight, insuranceValue } = req.body;

    if (!toDistrictId || !toWardCode) {
      return res.status(400).json({
        success: false,
        message: "toDistrictId and toWardCode are required"
      });
    }

    const data = await calculateShippingFee({
      toDistrictId,
      toWardCode,
      weight: weight || 300,
      insuranceValue: insuranceValue || 0
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
