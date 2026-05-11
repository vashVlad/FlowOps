import { create } from "zustand";
import type { DeliveryPhoto } from "@/types";
import { ok, err, logMutationError, type MutationResult } from "@/lib/store";
import {
  fetchPhotosByDelivery,
  uploadDeliveryPhoto as dbUpload,
  deleteDeliveryPhoto as dbDelete,
} from "@/supabase/queries";

interface PhotosStore {
  photos:    Record<string, DeliveryPhoto[]>; // keyed by deliveryId
  uploading: boolean;
  fetchForDelivery: (deliveryId: string) => Promise<void>;
  upload:           (deliveryId: string, file: File, caption?: string) => Promise<MutationResult<DeliveryPhoto>>;
  deletePhoto:      (photoId: string, storagePath: string, deliveryId: string) => Promise<MutationResult<undefined>>;
}

export const usePhotosStore = create<PhotosStore>()((set) => ({
  photos:    {},
  uploading: false,

  fetchForDelivery: async (deliveryId) => {
    try {
      const data = await fetchPhotosByDelivery(deliveryId);
      set((state) => ({ photos: { ...state.photos, [deliveryId]: data } }));
    } catch (e) {
      logMutationError("fetchPhotos:delivery", e);
    }
  },

  upload: async (deliveryId, file, caption) => {
    set({ uploading: true });
    try {
      const photo = await dbUpload(deliveryId, file, caption);
      set((state) => ({
        uploading: false,
        photos: {
          ...state.photos,
          [deliveryId]: [photo, ...(state.photos[deliveryId] ?? [])],
        },
      }));
      return ok(photo);
    } catch (e) {
      set({ uploading: false });
      return err(logMutationError("uploadPhoto", e));
    }
  },

  deletePhoto: async (photoId, storagePath, deliveryId) => {
    try {
      await dbDelete(photoId, storagePath);
      set((state) => ({
        photos: {
          ...state.photos,
          [deliveryId]: (state.photos[deliveryId] ?? []).filter((p) => p.id !== photoId),
        },
      }));
      return ok(undefined);
    } catch (e) {
      return err(logMutationError("deletePhoto", e));
    }
  },
}));
