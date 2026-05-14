import Address from "../models/Address.js";

export const getMyAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ userId: req.user._id }).sort({ isDefault: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Addresses fetched successfully",
      data: addresses
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const createAddress = async (req, res) => {
  try {
    const { fullName, phoneNumber, province, district, ward, street, isDefault } = req.body;

    if (!fullName || !phoneNumber || !province || !district || !ward || !street) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
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
      isDefault: isDefault || false
    });

    return res.status(201).json({
      success: true,
      message: "Address created successfully",
      data: address
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phoneNumber, province, district, ward, street, isDefault } = req.body;

    const address = await Address.findOne({ _id: id, userId: req.user._id });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found"
      });
    }

    if (fullName !== undefined) address.fullName = fullName;
    if (phoneNumber !== undefined) address.phoneNumber = phoneNumber;
    if (province !== undefined) address.province = province;
    if (district !== undefined) address.district = district;
    if (ward !== undefined) address.ward = ward;
    if (street !== undefined) address.street = street;
    if (isDefault !== undefined) address.isDefault = isDefault;

    await address.save();

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: address
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;

    const address = await Address.findOneAndDelete({ _id: id, userId: req.user._id });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
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
        message: "Address not found"
      });
    }

    address.isDefault = true;
    await address.save();

    return res.status(200).json({
      success: true,
      message: "Default address set successfully",
      data: address
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
