const allowedTypes = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
]);

const maxBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 50 * 1024 * 1024);
const maxImageBytes = Number(process.env.MAX_IMAGE_UPLOAD_BYTES ?? 5 * 1024 * 1024);
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function uploadObject(file: File, prefix: string) {
  if (file.size > maxBytes) {
    throw new Error("文件超过大小上限");
  }
  if (!allowedTypes.has(file.type) && !file.name.toLowerCase().endsWith(".zip")) {
    throw new Error("仅支持 zip、pdf、doc、docx 等作业文件");
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!supabaseUrl || !serviceKey || !bucket) {
    throw new Error("对象存储未配置，请设置 Supabase Storage 环境变量");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${prefix}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "false",
    },
    body: await file.arrayBuffer(),
  });

  if (!res.ok) {
    throw new Error(`文件上传失败：${await res.text()}`);
  }

  return {
    url: `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`,
    path,
  };
}

export async function uploadImageObject(file: File, prefix: string) {
  if (file.size > maxImageBytes) {
    throw new Error("单张图片超过大小上限");
  }
  if (!allowedImageTypes.has(file.type)) {
    throw new Error("图片仅支持 jpg、png、webp 格式");
  }

  return uploadObjectWithType(file, prefix, file.type);
}

async function uploadObjectWithType(file: File, prefix: string, contentType: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!supabaseUrl || !serviceKey || !bucket) {
    throw new Error("对象存储未配置，请设置 Supabase Storage 环境变量");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${prefix}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": contentType,
      "x-upsert": "false",
    },
    body: await file.arrayBuffer(),
  });

  if (!res.ok) {
    throw new Error(`文件上传失败：${await res.text()}`);
  }

  return {
    url: `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`,
    path,
  };
}
