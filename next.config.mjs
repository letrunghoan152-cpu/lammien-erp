/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ảnh KH/dịch vụ là link Drive/CDN bên ngoài — dùng <img> thường (có onerror fallback),
  // không qua next/image để tránh cấu hình domain.
  images: { unoptimized: true },
};

export default nextConfig;
