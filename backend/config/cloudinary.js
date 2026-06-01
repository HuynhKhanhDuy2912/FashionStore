import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

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

const mediaReferenceQueries = [
  { collection: 'products', fields: ['images', 'videos'] },
  { collection: 'productimages', fields: ['imageUrl'] },
  { collection: 'productvariants', fields: ['image'] },
  { collection: 'banners', fields: ['imageUrl'] },
  { collection: 'categories', fields: ['imageUrl'] },
  { collection: 'collections', fields: ['coverImage', 'bannerImage'] },
  { collection: 'sizeguides', fields: ['measurementImage'] },
  { collection: 'reviews', fields: ['imageUrls', 'videoUrls'] },
  { collection: 'users', fields: ['avatar'] },
];

const getCloudinaryPublicId = (mediaUrl = "") => {
  if (!mediaUrl || !String(mediaUrl).includes("/upload/")) return null;

  try {
    const parsedUrl = new URL(mediaUrl);
    const segments = parsedUrl.pathname.split('/').filter(Boolean);
    const uploadIndex = segments.indexOf('upload');

    if (uploadIndex === -1 || uploadIndex === segments.length - 1) return null;

    const resourceType = segments[uploadIndex - 1] === 'video' ? 'video' : 'image';
    let publicIdParts = segments.slice(uploadIndex + 1);
    const versionIndex = publicIdParts.findIndex((part) => /^v\d+$/i.test(part));

    if (versionIndex >= 0) {
      publicIdParts = publicIdParts.slice(versionIndex + 1);
    }

    const lastIndex = publicIdParts.length - 1;
    publicIdParts[lastIndex] = publicIdParts[lastIndex].replace(/\.[^/.]+$/, '');

    return {
      publicId: publicIdParts.map((part) => decodeURIComponent(part)).join('/'),
      resourceType,
    };
  } catch (error) {
    console.error("Error parsing Cloudinary URL:", error);
    return null;
  }
};

export const countMediaReferences = async (mediaUrl) => {
  if (!mediaUrl || mongoose.connection.readyState !== 1) return 0;

  const counts = await Promise.all(
    mediaReferenceQueries.flatMap(({ collection, fields }) =>
      fields.map((field) =>
        mongoose.connection
          .collection(collection)
          .countDocuments({ [field]: mediaUrl })
          .catch(() => 0),
      ),
    ),
  );

  return counts.reduce((total, count) => total + count, 0);
};

export const deleteImageFromCloudinary = async (imageUrl) => {
  const parsedMedia = getCloudinaryPublicId(imageUrl);
  if (!parsedMedia) return;

  try {
    await cloudinary.uploader.destroy(parsedMedia.publicId, {
      resource_type: parsedMedia.resourceType,
    });
  } catch (error) {
    console.error("Error deleting file from Cloudinary:", error);
  }
};

export const deleteMediaFromCloudinaryIfUnused = async (mediaUrl) => {
  if (!mediaUrl) return;

  try {
    const referenceCount = await countMediaReferences(mediaUrl);
    if (referenceCount === 0) {
      await deleteImageFromCloudinary(mediaUrl);
    }
  } catch (error) {
    console.error("Error deleting unused file from Cloudinary:", error);
  }
};

export { cloudinary };
