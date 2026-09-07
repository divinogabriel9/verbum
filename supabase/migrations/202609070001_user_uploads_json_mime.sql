-- Allow JSON metadata objects in user-uploads (saved_media/manifest.json).
update storage.buckets
set allowed_mime_types = array[
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'audio/mpeg',
  'audio/mp3',
  'video/mp4',
  'application/json',
  'text/plain'
]
where id = 'user-uploads';
