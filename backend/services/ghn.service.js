const GHN_BASE_URL = process.env.GHN_BASE_URL || "https://online-gateway.ghn.vn/shiip/public-api/v2";
const GHN_TOKEN = process.env.GHN_TOKEN;
const GHN_SHOP_ID = process.env.GHN_SHOP_ID;
const GHN_FROM_DISTRICT_ID = parseInt(process.env.GHN_FROM_DISTRICT_ID, 10);
const GHN_FROM_WARD_CODE = process.env.GHN_FROM_WARD_CODE;

const ghnFetch = async (endpoint, body = null, method = "POST") => {
  const headers = {
    "Token": GHN_TOKEN,
    "ShopId": GHN_SHOP_ID,
    "Content-Type": "application/json"
  };

  const options = { method, headers };
  if (body && method === "POST") {
    options.body = JSON.stringify(body);
  }

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${GHN_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const res = await fetch(url, options);
  const data = await res.json();

  if (data.code !== 200) {
    throw new Error(data.message || "GHN API error");
  }

  return data.data;
};

// Master Data endpoints use a different base path
const GHN_MASTER_URL = GHN_BASE_URL.replace("/v2", "") + "/master-data";

export const getProvinces = async () => {
  const headers = {
    "Token": GHN_TOKEN,
    "Content-Type": "application/json"
  };

  const res = await fetch(`${GHN_MASTER_URL}/province`, { headers });
  const data = await res.json();

  if (data.code !== 200) throw new Error(data.message || "Failed to get provinces");
  return data.data;
};

export const getDistricts = async (provinceId) => {
  const headers = {
    "Token": GHN_TOKEN,
    "Content-Type": "application/json"
  };

  const res = await fetch(`${GHN_MASTER_URL}/district`, {
    method: "POST",
    headers,
    body: JSON.stringify({ province_id: parseInt(provinceId, 10) })
  });
  const data = await res.json();

  if (data.code !== 200) throw new Error(data.message || "Failed to get districts");
  return data.data;
};

export const getWards = async (districtId) => {
  const headers = {
    "Token": GHN_TOKEN,
    "Content-Type": "application/json"
  };

  const res = await fetch(`${GHN_MASTER_URL}/ward`, {
    method: "POST",
    headers,
    body: JSON.stringify({ district_id: parseInt(districtId, 10) })
  });
  const data = await res.json();

  if (data.code !== 200) throw new Error(data.message || "Failed to get wards");
  return data.data;
};

export const getAvailableServices = async (toDistrictId) => {
  return ghnFetch("/shipping-order/available-services", {
    shop_id: parseInt(GHN_SHOP_ID, 10),
    from_district: GHN_FROM_DISTRICT_ID,
    to_district: parseInt(toDistrictId, 10)
  });
};

export const calculateShippingFee = async ({ toDistrictId, toWardCode, weight = 300, insuranceValue = 0 }) => {
  // Get available services first
  const services = await getAvailableServices(toDistrictId);

  if (!services || services.length === 0) {
    throw new Error("No shipping service available for this address");
  }

  // Pick the cheapest service (usually standard delivery)
  const service = services[0];

  const feeData = await ghnFetch("/shipping-order/fee", {
    service_type_id: service.service_type_id,
    from_district_id: GHN_FROM_DISTRICT_ID,
    from_ward_code: GHN_FROM_WARD_CODE,
    to_district_id: parseInt(toDistrictId, 10),
    to_ward_code: toWardCode.toString(),
    weight: parseInt(weight, 10),
    insurance_value: parseInt(insuranceValue, 10),
    coupon: null
  });

  return {
    total: feeData.total,
    serviceFee: feeData.service_fee,
    insuranceFee: feeData.insurance_fee,
    serviceName: service.short_name,
    serviceTypeId: service.service_type_id
  };
};
