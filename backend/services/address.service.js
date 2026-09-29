import Address from "../models/Address.js";

export const getMyAddressesService = async (userId) => {
  const addresses = await Address.find({ userId }).sort({
    isDefault: -1,
    createdAt: -1,
  });

  return addresses;
};

export const createAddressService = async (userId, addressData) => {
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
  } = addressData;

  if (
    !fullName ||
    !phoneNumber ||
    !province ||
    !district ||
    !ward ||
    !street
  ) {
    throw Object.assign(new Error("Vui lòng nhập đầy đủ thông tin"), {
      statusCode: 400,
    });
  }

  const address = await Address.create({
    userId,
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

  return address;
};

export const updateAddressService = async (userId, addressId, addressData) => {
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
  } = addressData;

  const address = await Address.findOne({ _id: addressId, userId });

  if (!address) {
    throw Object.assign(new Error("Không tìm thấy địa chỉ"), {
      statusCode: 404,
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

  return address;
};

export const deleteAddressService = async (userId, addressId) => {
  const address = await Address.findOneAndDelete({
    _id: addressId,
    userId,
  });

  if (!address) {
    throw Object.assign(new Error("Không tìm thấy địa chỉ"), {
      statusCode: 404,
    });
  }

  return address;
};

export const setDefaultAddressService = async (userId, addressId) => {
  const address = await Address.findOne({ _id: addressId, userId });

  if (!address) {
    throw Object.assign(new Error("Không tìm thấy địa chỉ"), {
      statusCode: 404,
    });
  }

  address.isDefault = true;
  await address.save();

  return address;
};
