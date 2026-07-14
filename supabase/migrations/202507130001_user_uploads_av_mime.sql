-- Allow parish-shared audio/video in user-uploads (service-role paths under parishes/).
update storage.buckets
set
  allowed_mime_types = array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'audio/mpeg',
    'audio/mp3',
    'video/mp4'
  ],
  file_size_limit = 104857600
where id = 'user-uploads';
