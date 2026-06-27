import Image from "next/image";

export const DEFAULT_AVATAR = "/default-avatar.png";
export const ANONYMOUS_AVATAR = "/anonymous-avatar.png";

const sizes = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 80,
  xl: 96,
  "2xl": 128,
};

export function Avatar({
  url,
  anonymous = false,
  size = "sm",
  alt = "",
}: {
  url?: string | null;
  anonymous?: boolean;
  size?: keyof typeof sizes;
  alt?: string;
}) {
  const px = sizes[size];
  const src = anonymous ? ANONYMOUS_AVATAR : (url ?? DEFAULT_AVATAR);

  return (
    <Image
      src={src}
      alt={alt}
      width={px}
      height={px}
      className="shrink-0 rounded-full object-cover ring-1 ring-border"
      style={{ width: px, height: px }}
      unoptimized={src.startsWith("http")}
    />
  );
}
