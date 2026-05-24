import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'fashionstore',
    resource_type: 'auto',
    allowedFormats: ['jpg', 'png', 'jpeg', 'webp', 'mp4', 'mov', 'webm'],
    public_id: (req, file) => {
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);
      const originalName = file.originalname.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
      return `${originalName}_${timestamp}_${randomString}`;
    },
  },
});

export const upload = multer({ storage: storage });

export const deleteImageFromCloudinary = async (imageUrl) => {
  if (!imageUrl) return;
  try {
    const urlParts = imageUrl.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    const folder = urlParts[urlParts.length - 2];
    const fileNameWithoutExt = lastPart.split('.')[0];
    const publicId = `${folder}/${fileNameWithoutExt}`;
    const resourceType = imageUrl.includes('/video/upload/') ? 'video' : 'image';
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
  }
};

export { cloudinary };
