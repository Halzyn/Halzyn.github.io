import type { SupabaseClient } from '@supabase/supabase-js'


export const AVATAR_PIXEL_SIZE = 150
const MAX_AVATAR_BYTES = 12 * 1024 * 1024

export function avatarPublicUrl(supabase: SupabaseClient, path: string | null | undefined): string | null {
  const cleanedPath = path?.trim()
  if (!cleanedPath) return null
  const { data } = supabase.storage.from('avatars').getPublicUrl(cleanedPath)
  return data.publicUrl
}

export async function resizeImageFileToAvatarJpeg(file: File, size = AVATAR_PIXEL_SIZE): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file.')
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('Max file size is 12 MB')
  }

  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare image.')

    const imageWidth = bitmap.width
    const imageHeight = bitmap.height
    const scale = Math.max(size / imageWidth, size / imageHeight)
    const scaledWidth = size / scale
    const scaledHeight = size / scale
    const cropOriginX = Math.max(0, (imageWidth - scaledWidth) / 2)
    const cropOriginY = Math.max(0, (imageHeight - scaledHeight) / 2)

    context.drawImage(bitmap, cropOriginX, cropOriginY, scaledWidth, scaledHeight, 0, 0, size, size)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image.'))),
        'image/jpeg',
        0.88,
      )
    })
  } finally {
    bitmap.close()
  }
}
