import Address from "../models/Address.js";

export const getMyAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ userId: req.user._id }).sort({
      isDefault: -1,
      createdAt: -1,
    });

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
    const {
      fullName,
      phoneNumber,
      province,
      district,
      ward,
      street,
      addressDetail,
      isDefault,
      provinceId,
      districtId,
      wardCode,
    } = req.body;

    if (
      !fullName ||
      !phoneNumber ||
      !province ||
      !district ||
      !ward ||
      !street
    ) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ thông tin",
      });
    }

    const address = await Address.create({
      userId: req.user._id,
      fullName,
      phoneNumber,
      province,
      district,
      ward,
      street,
      addressDetail: addressDetail || "",
      isDefault: isDefault || false,
      provinceId: provinceId || null,
      districtId: districtId || null,
      wardCode: wardCode || null,
    });

    return res.status(201).json({
      success: true,
      message: "Thêm địa chỉ thành công",
      data: address,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      phoneNumber,
      province,
      district,
      ward,
      street,
      addressDetail,
      isDefault,
      provinceId,
      districtId,
      wardCode,
    } = req.body;

    const address = await Address.findOne({ _id: id, userId: req.user._id });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy địa chỉ",
      });
    }

    if (fullName !== undefined) address.fullName = fullName;
    if (phoneNumber !== undefined) address.phoneNumber = phoneNumber;
    if (province !== undefined) address.province = province;
    if (district !== undefined) address.district = district;
    if (ward !== undefined) address.ward = ward;
    if (street !== undefined) address.street = street;
    if (addressDetail !== undefined) address.addressDetail = addressDetail;
    if (isDefault !== undefined) address.isDefault = isDefault;
    if (provinceId !== undefined) address.provinceId = provinceId;
    if (districtId !== undefined) address.districtId = districtId;
    if (wardCode !== undefined) address.wardCode = wardCode;

    await address.save();

    return res.status(200).json({
      success: true,
      message: "Cập nhật địa chỉ thành công",
      data: address,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;

    const address = await Address.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy địa chỉ",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Xóa địa chỉ thành công",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const setDefaultAddress = async (req, res) => {
  try {
    const { id } = req.params;

    const address = await Address.findOne({ _id: id, userId: req.user._id });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy địa chỉ",
      });
    }

    address.isDefault = true;
    await address.save();

    return res.status(200).json({
      success: true,
      message: "Đặt làm địa chỉ mặc định thành công",
      data: address,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
