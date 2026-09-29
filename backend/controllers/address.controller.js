import {
  getMyAddressesService,
  createAddressService,
  updateAddressService,
  deleteAddressService,
  setDefaultAddressService,
} from "../services/address.service.js";

export const getMyAddresses = async (req, res) => {
  try {
    const addresses = await getMyAddressesService(req.user._id);

    return res.status(200).json({
      success: true,
      message: "Lấy địa chỉ thành công",
      data: addresses,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const createAddress = async (req, res) => {
  try {
    const address = await createAddressService(req.user._id, req.body);

    return res.status(201).json({
      success: true,
      message: "Thêm địa chỉ thành công",
      data: address,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateAddress = async (req, res) => {
  try {
    const address = await updateAddressService(req.user._id, req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: "Cập nhật địa chỉ thành công",
      data: address,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    await deleteAddressService(req.user._id, req.params.id);

    return res.status(200).json({
      success: true,
      message: "Xóa địa chỉ thành công",
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

export const setDefaultAddress = async (req, res) => {
  try {
    const address = await setDefaultAddressService(req.user._id, req.params.id);

    return res.status(200).json({
      success: true,
      message: "Đặt làm địa chỉ mặc định thành công",
      data: address,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};
