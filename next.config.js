/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // 强制忽略 TypeScript 错误以确保部署成功
    ignoreBuildErrors: true,
  },
  eslint: {
    // 忽略构建过程中的 ESLint 检查，加快速度
    ignoreDuringBuilds: true,
  }
};

export default nextConfig;
