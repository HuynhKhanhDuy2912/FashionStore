import { Client, handle_file } from "@gradio/client";
import axios from "axios";
import { cloudinary } from "../config/cloudinary.js";

const AI_TRY_ON_TIMEOUT_MS = Number(process.env.AI_TRY_ON_TIMEOUT_MS || 180000);
const MAX_REMOTE_IMAGE_BYTES = Number(
  process.env.VIRTUAL_TRY_ON_MAX_REMOTE_IMAGE_MB || 10,
) * 1024 * 1024;

function ensureImageFile(file, fieldName) {
  if (!file) {
    const error = new Error(`${fieldName} is required`);
    error.statusCode = 400;
    throw error;
  }

  if (!file.mimetype?.startsWith("image/")) {
    const error = new Error(`${fieldName} must be an image`);
    error.statusCode = 400;
    throw error;
  }
}

function assertSafeImageUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    const error = new Error("garmentImageUrl is invalid");
    error.statusCode = 400;
    throw error;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    const error = new Error("garmentImageUrl must use http or https");
    error.statusCode = 400;
    throw error;
  }
}

async function downloadImageAsFile(url) {
  assertSafeImageUrl(url);

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    maxContentLength: MAX_REMOTE_IMAGE_BYTES,
  });

  const contentType = response.headers["content-type"] || "";
  if (!contentType.startsWith("image/")) {
    const error = new Error("garmentImageUrl does not point to an image");
    error.statusCode = 400;
    throw error;
  }

  return {
    buffer: Buffer.from(response.data),
    mimetype: contentType,
    originalname: "garment-from-url.jpg",
  };
}

async function uploadTryOnResult(buffer, userId, productId) {
  const hasCloudinaryConfig =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;
  const shouldUpload =
    hasCloudinaryConfig &&
    process.env.VIRTUAL_TRY_ON_UPLOAD_TO_CLOUDINARY !== "false";

  if (!shouldUpload) {
    return {
      resultImageUrl: `data:image/jpeg;base64,${buffer.toString("base64")}`,
      storage: "inline",
    };
  }

  const dataUri = `data:image/jpeg;base64,${buffer.toString("base64")}`;
  const uploadResult = await cloudinary.uploader.upload(dataUri, {
    folder: "fashionstore/virtual-try-on",
    public_id: `${userId || "guest"}_${productId || "product"}_${Date.now()}`,
    resource_type: "image",
  });

  return {
    resultImageUrl: uploadResult.secure_url,
    storage: "cloudinary",
    publicId: uploadResult.public_id,
  };
}

/**
 * Chuyển buffer ảnh thành Blob để gửi cho Gradio API.
 */
function bufferToBlob(file) {
  const mime = file.mimetype || "image/jpeg";
  return new Blob([file.buffer], { type: mime });
}

export async function createVirtualTryOn({
  personImage,
  garmentImage,
  garmentImageUrl,
  category = "upper_body",
  productId,
  userId,
}) {
  ensureImageFile(personImage, "personImage");

  const resolvedGarmentImage =
    garmentImage || (garmentImageUrl ? await downloadImageAsFile(garmentImageUrl) : null);
  ensureImageFile(resolvedGarmentImage, "garmentImage");

  // HF_TOKEN là tùy chọn - giúp tăng rate limit khi gọi HF Spaces
  // Lấy token miễn phí tại: https://huggingface.co/settings/tokens
  const hfToken = process.env.HF_TOKEN || undefined;

  const startedAt = Date.now();

  try {
    // Kết nối tới Hugging Face Space yisol/IDM-VTON (miễn phí)
    const app = await Client.connect("yisol/IDM-VTON", {
      hf_token: hfToken,
    });

    // Chuyển buffer ảnh thành Blob cho Gradio
    const personBlob = bufferToBlob(personImage);
    const garmentBlob = bufferToBlob(resolvedGarmentImage);

    // Gọi API /tryon trên Hugging Face Space
    const result = await app.predict("/tryon", {
      dict: {
        background: personBlob,
        layers: [],
        composite: null,
      },
      garm_img: garmentBlob,
      garment_des: "",        // Mô tả quần áo (để trống, model tự detect)
      is_checked: true,       // Bật auto-masking
      is_checked_crop: false,  // Tắt auto-crop
      denoise_steps: 30,       // Số bước denoise (mặc định)
      seed: 42,                // Seed (mặc định)
    });

    // Gradio trả về: result.data[0] = ảnh kết quả, result.data[1] = ảnh mask
    const resultData = result?.data?.[0];
    const resultUrl = resultData?.url || resultData?.path;

    if (!resultUrl) {
      const serviceError = new Error("Hugging Face API trả về dữ liệu không hợp lệ");
      serviceError.statusCode = 502;
      throw serviceError;
    }

    // Tải ảnh kết quả về buffer
    const imgDownloadRes = await axios.get(resultUrl, { responseType: "arraybuffer", timeout: 30000 });
    const resultBuffer = Buffer.from(imgDownloadRes.data);

    // Đẩy lên Cloudinary (hoặc trả về inline base64)
    const stored = await uploadTryOnResult(resultBuffer, userId, productId);
    const elapsedMs = Date.now() - startedAt;

    return {
      ...stored,
      modelProvider: "huggingface-spaces",
      inferenceTimeMs: elapsedMs,
    };
  } catch (error) {
    // Nếu đã có statusCode (lỗi từ logic ở trên), throw lại
    if (error.statusCode) {
      throw error;
    }

    // Xử lý các lỗi từ Hugging Face Spaces
    let errorMessage = "Lỗi khi gọi Hugging Face Spaces API";
    const statusCode = error.response?.status || 502;

    if (error.message?.includes("exceeded your GPU quota")) {
      errorMessage = "Đã vượt quá giới hạn GPU miễn phí trên Hugging Face. Vui lòng thử lại sau vài phút.";
    } else if (error.message?.includes("Queue is full")) {
      errorMessage = "Hàng đợi xử lý đang đầy. Vui lòng thử lại sau ít phút.";
    } else if (error.message?.includes("Connection errored out")) {
      errorMessage = "Không thể kết nối tới Hugging Face Space. Space có thể đang khởi động lại.";
    } else if (error.message) {
      errorMessage = `Hugging Face Error: ${error.message}`;
    }

    const serviceError = new Error(errorMessage);
    serviceError.statusCode = statusCode;
    throw serviceError;
  }
}