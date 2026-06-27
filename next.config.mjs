/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ảnh KH/dịch vụ là link Drive/CDN bên ngoài — dùng <img> thường (có onerror fallback),
  // không qua next/image để tránh cấu hình domain.
  images: { unoptimized: true },
  // Cho phép popup "Sign in with Google" postMessage credential về trang.
  // Không có header này → Chrome chặn postMessage từ popup → đăng nhập kẹt ở màn login.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
    ]
  },
};

export default nextConfig;
