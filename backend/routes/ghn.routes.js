import { Router } from "express";
import {
  getGHNProvinces,
  getGHNDistricts,
  getGHNWards,
  getShippingFee
} from "../controllers/ghn.controller.js";

const router = Router();

router.get("/provinces", getGHNProvinces);
router.get("/districts", getGHNDistricts);
router.get("/wards", getGHNWards);
router.post("/shipping-fee", getShippingFee);

export default router;
