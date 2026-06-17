-- Allow generated PPTX/ZIP uploads in user-uploads (images were already allowed).
update storage.buckets
set
  allowed_mime_types = array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip'
  ],
  file_size_limit = 52428800
where id = 'user-uploads';
